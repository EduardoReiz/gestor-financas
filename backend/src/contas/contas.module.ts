import { Body, Controller, Get, Injectable, Module, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsPositive, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.module';
import { intervaloDoMes } from '../comum/mes';

class NovaContaFixa {
  @IsString() @MaxLength(60) nome!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() valorPrevisto!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(31) diaVencimento!: number;
  @IsString() @MaxLength(40) formaPagamento!: string;
  @IsOptional() @IsString() categoriaId?: string;
  @IsOptional() @IsString() @MaxLength(40) contem?: string;
}

class MarcarPaga {
  @IsBoolean() paga!: boolean;
}

// Como achar o pagamento no extrato:
//  - conta com "contem": débito com esse nome até 10 dias antes/depois, de
//    valor mais próximo (conta de luz muda de valor; a Claro tem duas linhas);
//  - sem "contem": débito com o mesmo valor até 3 dias antes/depois.
const FOLGA_DIAS = 3;
const FOLGA_COM_NOME_DIAS = 10;

@Injectable()
class ContasService {
  constructor(private readonly prisma: PrismaService) {}

  async doMes(mes?: string) {
    const intervalo = intervaloDoMes(mes);
    await this.gerarOcorrencias(intervalo.inicio);
    await this.ligarPagamentos(intervalo.inicio, intervalo.fim);

    const contas = await this.prisma.contaAPagar.findMany({
      where: { vencimento: { gte: intervalo.inicio, lt: intervalo.fim } },
      include: { contaFixa: { select: { formaPagamento: true } }, cobranca: { select: { id: true } } },
      orderBy: { vencimento: 'asc' },
    });

    const total = contas.reduce((s, c) => s + c.valor.toNumber(), 0);
    const pago = contas.filter((c) => c.pagaEm).reduce((s, c) => s + c.valor.toNumber(), 0);
    const comoItem = (c: (typeof contas)[number]) => ({
      id: c.id,
      nome: c.nome,
      valor: c.valor.toNumber(),
      vencimento: c.vencimento,
      pagaEm: c.pagaEm,
      formaPagamento: c.contaFixa?.formaPagamento ?? null,
      pagaAutomaticamente: !!c.lancamentoId,
      temCodigo: !!c.cobranca,
    });

    return {
      total: centavos(total),
      pago: centavos(pago),
      falta: centavos(total - pago),
      aVencer: contas.filter((c) => !c.pagaEm).map(comoItem),
      pagas: contas.filter((c) => c.pagaEm).map(comoItem),
    };
  }

  fixas() {
    return this.prisma.contaFixa.findMany({
      where: { ativa: true },
      select: { id: true, nome: true, diaVencimento: true, recebedor: true, contem: true },
      orderBy: { nome: 'asc' },
    });
  }

  async criarFixa(dados: NovaContaFixa) {
    const fixa = await this.prisma.contaFixa.create({ data: dados });
    await this.gerarOcorrencias(intervaloDoMes().inicio);
    return fixa;
  }

  async marcar(id: string, paga: boolean) {
    const conta = await this.prisma.contaAPagar.findUnique({ where: { id } });
    if (!conta) throw new NotFoundException('conta não encontrada');
    await this.prisma.contaAPagar.update({
      where: { id },
      data: paga ? { pagaEm: new Date() } : { pagaEm: null, lancamentoId: null },
    });
  }

  // Cada conta fixa ativa ganha a sua ocorrência no mês (se ainda não tiver).
  private async gerarOcorrencias(inicioDoMes: Date) {
    const ano = inicioDoMes.getFullYear();
    const mes = inicioDoMes.getMonth();
    const ultimoDia = new Date(ano, mes + 1, 0).getDate();
    const fixas = await this.prisma.contaFixa.findMany({ where: { ativa: true } });

    await this.prisma.contaAPagar.createMany({
      data: fixas.map((f) => ({
        contaFixaId: f.id,
        nome: f.nome,
        valor: f.valorPrevisto,
        // dia 31 em fevereiro vira o último dia do mês
        vencimento: new Date(Date.UTC(ano, mes, Math.min(f.diaVencimento, ultimoDia))),
      })),
      skipDuplicates: true,
    });
  }

  // Liga sozinho a conta ao débito do extrato que a pagou.
  private async ligarPagamentos(inicio: Date, fim: Date) {
    const pendentes = await this.prisma.contaAPagar.findMany({
      where: { pagaEm: null, vencimento: { gte: inicio, lt: fim } },
      include: { contaFixa: { select: { contem: true } } },
    });

    for (const conta of pendentes) {
      const contem = conta.contaFixa?.contem?.trim();
      const folga = (contem ? FOLGA_COM_NOME_DIAS : FOLGA_DIAS) * 86_400_000;
      const candidatos = await this.prisma.lancamento.findMany({
        where: {
          sentido: 'SAIDA',
          data: { gte: new Date(conta.vencimento.getTime() - folga), lt: new Date(conta.vencimento.getTime() + folga + 86_400_000) },
          contaAPagar: null,
          ...(contem ? { descricao: { contains: contem, mode: 'insensitive' } } : { valor: conta.valor }),
        },
      });
      const alvo = conta.valor.toNumber();
      const pagamento = candidatos.sort(
        (a, b) => Math.abs(a.valor.toNumber() - alvo) - Math.abs(b.valor.toNumber() - alvo) || a.data.getTime() - b.data.getTime(),
      )[0];

      if (pagamento) {
        await this.prisma.contaAPagar.update({
          where: { id: conta.id },
          // o valor da conta passa a ser o que foi pago de verdade
          data: { pagaEm: pagamento.data, lancamentoId: pagamento.id, valor: pagamento.valor },
        });
      }
    }
  }
}

const centavos = (v: number) => Math.round(v * 100) / 100;

class FiltroMes {
  @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) mes?: string;
}

@Controller('contas')
class ContasController {
  constructor(private readonly contas: ContasService) {}

  @Get()
  doMes(@Query() filtro: FiltroMes) {
    return this.contas.doMes(filtro.mes);
  }

  @Get('fixas')
  fixas() {
    return this.contas.fixas();
  }

  @Post('fixas')
  criarFixa(@Body() dados: NovaContaFixa) {
    return this.contas.criarFixa(dados);
  }

  @Patch(':id')
  marcar(@Param('id') id: string, @Body() dados: MarcarPaga) {
    return this.contas.marcar(id, dados.paga);
  }
}

@Module({
  controllers: [ContasController],
  providers: [ContasService],
})
export class ContasModule {}
