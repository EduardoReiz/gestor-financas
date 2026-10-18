import { Body, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
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
  @IsOptional() @IsBoolean() valorVariavel?: boolean;
}

// Na edição tudo é opcional: só muda o que veio.
class EditarContaFixa {
  @IsOptional() @IsString() categoriaId?: string;
  @IsOptional() @IsString() @MaxLength(60) nome?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() valorPrevisto?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(31) diaVencimento?: number;
  @IsOptional() @IsString() @MaxLength(40) formaPagamento?: string;
  @IsOptional() @IsString() @MaxLength(40) contem?: string;
  @IsOptional() @IsBoolean() valorVariavel?: boolean;
}

class ValorDoMes {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() valor!: number;
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
export class ContasService {
  constructor(private readonly prisma: PrismaService) {}

  async doMes(mes?: string) {
    const intervalo = intervaloDoMes(mes);
    await this.gerarOcorrencias(intervalo.inicio);
    await this.ligarPagamentos(intervalo.inicio, intervalo.fim);
    await this.estimarVariaveis(intervalo.inicio, intervalo.fim);

    const contas = await this.prisma.contaAPagar.findMany({
      where: { vencimento: { gte: intervalo.inicio, lt: intervalo.fim } },
      include: { contaFixa: { select: { formaPagamento: true, valorVariavel: true } }, cobranca: { select: { id: true } } },
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
      // valor ainda é a média dos últimos meses, não o da fatura de verdade
      estimado: !!c.contaFixa?.valorVariavel && !c.valorInformado && !c.pagaEm,
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
      select: {
        id: true, nome: true, valorPrevisto: true, diaVencimento: true, formaPagamento: true, recebedor: true, contem: true, valorVariavel: true,
        categoria: { select: { id: true, nome: true } },
      },
      orderBy: [{ diaVencimento: 'asc' }, { nome: 'asc' }],
    });
  }

  // Editar mexe também nas contas deste mês em diante que ainda estão em
  // aberto: senão o gerador criaria a conta de novo no dia novo (duplicada).
  async editarFixa(id: string, dados: EditarContaFixa) {
    const fixa = await this.prisma.contaFixa.findUnique({ where: { id } });
    if (!fixa) throw new NotFoundException('conta fixa não encontrada');
    const contem = dados.contem === undefined ? undefined : dados.contem.trim() || null;

    await this.prisma.contaFixa.update({ where: { id }, data: { ...dados, contem, categoriaId: dados.categoriaId || undefined } });
    if (dados.categoriaId) await this.categorizarPagamentos(id);

    const abertas = await this.prisma.contaAPagar.findMany({
      where: { contaFixaId: id, pagaEm: null, vencimento: { gte: intervaloDoMes().inicio } },
      include: { cobranca: { select: { id: true } } },
    });
    for (const conta of abertas) {
      const ano = conta.vencimento.getUTCFullYear();
      const mes = conta.vencimento.getUTCMonth();
      const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
      await this.prisma.contaAPagar.update({
        where: { id: conta.id },
        data: {
          ...(dados.nome && { nome: dados.nome }),
          ...(dados.diaVencimento && { vencimento: new Date(Date.UTC(ano, mes, Math.min(dados.diaVencimento, ultimoDia))) }),
          // com código guardado, o valor certo é o do código
          ...(dados.valorPrevisto && !conta.cobranca && !conta.valorInformado && { valor: dados.valorPrevisto }),
        },
      });
    }
  }

  // Parar de pagar uma conta: some daqui pra frente, o histórico fica.
  async desativarFixa(id: string) {
    const fixa = await this.prisma.contaFixa.findUnique({ where: { id } });
    if (!fixa) throw new NotFoundException('conta fixa não encontrada');
    await this.prisma.$transaction([
      this.prisma.contaFixa.update({ where: { id }, data: { ativa: false } }),
      this.prisma.contaAPagar.deleteMany({
        where: { contaFixaId: id, pagaEm: null, cobranca: null, vencimento: { gte: intervaloDoMes().inicio } },
      }),
    ]);
  }

  async criarFixa(dados: NovaContaFixa) {
    const fixa = await this.prisma.contaFixa.create({ data: dados });
    await this.gerarOcorrencias(intervaloDoMes().inicio);
    return fixa;
  }

  // "Informar valor": a fatura fechou e você sabe quanto é este mês.
  async informarValor(id: string, valor: number) {
    const conta = await this.prisma.contaAPagar.findUnique({ where: { id } });
    if (!conta) throw new NotFoundException('conta não encontrada');
    await this.prisma.contaAPagar.update({ where: { id }, data: { valor, valorInformado: true } });
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
    // só a partir do mês em que a conta fixa foi criada
    const fimDoMes = new Date(ano, mes + 1, 1);
    const fixas = await this.prisma.contaFixa.findMany({ where: { ativa: true, criadaEm: { lt: fimDoMes } } });

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

  // Contas de valor variável sem valor real ainda: média dos últimos 3 meses com valor real.
  private async estimarVariaveis(inicio: Date, fim: Date) {
    const abertas = await this.prisma.contaAPagar.findMany({
      where: { vencimento: { gte: inicio, lt: fim }, pagaEm: null, valorInformado: false, cobranca: null, contaFixa: { valorVariavel: true } },
    });
    for (const conta of abertas) {
      const pagas = await this.prisma.contaAPagar.findMany({
        // meses com valor real: pagos ou com o valor informado por você
        where: { contaFixaId: conta.contaFixaId, OR: [{ pagaEm: { not: null } }, { valorInformado: true }], vencimento: { lt: inicio } },
        orderBy: { vencimento: 'desc' },
        take: 3,
        select: { valor: true },
      });
      if (pagas.length === 0) continue; // sem histórico: fica o valor de referência
      const media = pagas.reduce((s, p) => s + p.valor.toNumber(), 0) / pagas.length;
      await this.prisma.contaAPagar.update({ where: { id: conta.id }, data: { valor: centavos(media) } });
    }
  }

  // Liga sozinho a conta ao débito do extrato que a pagou.
  private async ligarPagamentos(inicio: Date, fim: Date) {
    // também a marcada como paga à mão antes de o Pix chegar do banco: o
    // valor dela precisa virar o que foi pago de verdade
    const pendentes = await this.prisma.contaAPagar.findMany({
      where: { lancamentoId: null, vencimento: { gte: inicio, lt: fim } },
      include: { contaFixa: { select: { contem: true } } },
    });

    const ligadas = new Set<string>();
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
          data: { pagaEm: pagamento.data, lancamentoId: pagamento.id, valor: pagamento.valor, valorInformado: true },
        });
        if (conta.contaFixaId) ligadas.add(conta.contaFixaId);
      }
    }
    for (const fixaId of ligadas) await this.categorizarPagamentos(fixaId);
  }

  // O Pix do aluguel sai do banco como "Transferência". Se a conta fixa tem
  // categoria, o lançamento que a pagou passa a ter essa categoria.
  async categorizarPagamentos(contaFixaId: string) {
    const fixa = await this.prisma.contaFixa.findUnique({ where: { id: contaFixaId }, select: { categoriaId: true } });
    if (!fixa?.categoriaId) return;
    await this.prisma.lancamento.updateMany({
      // (sem categoria também entra: NOT sozinho deixaria os vazios de fora)
      where: { contaAPagar: { contaFixaId }, OR: [{ origemCategoria: null }, { origemCategoria: { not: 'MANUAL' } }] },
      data: { categoriaId: fixa.categoriaId, origemCategoria: 'CONTA_FIXA', categoriaConfirmada: true },
    });
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

  @Patch('fixas/:id')
  @HttpCode(204)
  editarFixa(@Param('id') id: string, @Body() dados: EditarContaFixa) {
    return this.contas.editarFixa(id, dados);
  }

  @Delete('fixas/:id')
  @HttpCode(204)
  desativarFixa(@Param('id') id: string) {
    return this.contas.desativarFixa(id);
  }

  @Post('fixas')
  criarFixa(@Body() dados: NovaContaFixa) {
    return this.contas.criarFixa(dados);
  }

  @Patch(':id/valor')
  @HttpCode(204)
  informarValor(@Param('id') id: string, @Body() dados: ValorDoMes) {
    return this.contas.informarValor(id, dados.valor);
  }

  @Patch(':id')
  marcar(@Param('id') id: string, @Body() dados: MarcarPaga) {
    return this.contas.marcar(id, dados.paga);
  }
}

@Module({
  controllers: [ContasController],
  providers: [ContasService],
  exports: [ContasService],
})
export class ContasModule {}
