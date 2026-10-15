import {
  BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, Patch, Post,
} from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.module';
import { CodigoInvalido, lerCodigo } from './codigos';

class NovaCobranca {
  @IsString() @MaxLength(2000) codigo!: string;
  @IsOptional() @IsString() @MaxLength(60) descricao?: string;
  @IsOptional() @IsString() contaFixaId?: string;
}

class MarcarPaga {
  @IsBoolean() paga!: boolean;
}

const DIA = 86_400_000;

@Injectable()
class CobrancasService {
  constructor(private readonly prisma: PrismaService) {}

  // Só lê o código, sem salvar: a tela mostra o que entendeu antes de você confirmar.
  async conferir(codigo: string) {
    const lido = this.ler(codigo);
    const recebedor = lido.tipo === 'PIX' ? lido.recebedor : null;
    const anterior = recebedor
      ? await this.prisma.cobranca.findFirst({ where: { recebedor, contaFixaId: { not: null } }, orderBy: { criadaEm: 'desc' } })
      : null;
    return { ...lido, contaFixaSugerida: anterior?.contaFixaId ?? null };
  }

  async criar(dados: NovaCobranca) {
    const lido = this.ler(dados.codigo);
    if (await this.prisma.cobranca.findUnique({ where: { codigo: lido.codigo } })) {
      throw new ConflictException('Esse código já está na lista.');
    }
    const recebedor = lido.tipo === 'PIX' ? lido.recebedor : null;
    const vencimento = lido.tipo === 'BOLETO' ? lido.vencimento : null;

    // Golpe comum: Pix "da Claro" que paga outra pessoa. O nome de quem recebe
    // fica guardado na conta fixa e é comparado a cada código novo.
    let aviso: string | null = null;
    if (dados.contaFixaId && recebedor) {
      const fixa = await this.prisma.contaFixa.findUnique({ where: { id: dados.contaFixaId }, select: { recebedor: true } });
      if (fixa?.recebedor && fixa.recebedor !== recebedor) {
        aviso = `Atenção: o recebedor mudou. Antes era "${fixa.recebedor}", agora é "${recebedor}". Confira antes de pagar.`;
      }
    }

    const contaAPagarId = dados.contaFixaId
      ? await this.contaDoMes(dados.contaFixaId, vencimento, lido.valor)
      : null;

    const cobranca = await this.prisma.cobranca.create({
      data: {
        tipo: lido.tipo,
        codigo: lido.codigo,
        descricao: dados.descricao?.trim() || null,
        valor: lido.valor,
        vencimento,
        recebedor,
        contaFixaId: dados.contaFixaId ?? null,
        contaAPagarId,
      },
    });
    // só guarda o primeiro nome visto: um recebedor diferente continua gerando aviso
    if (dados.contaFixaId && recebedor) {
      await this.prisma.contaFixa.updateMany({ where: { id: dados.contaFixaId, recebedor: null }, data: { recebedor } });
    }
    return { id: cobranca.id, aviso };
  }

  async listar() {
    await this.ligarPagamentos();
    const cobrancas = await this.prisma.cobranca.findMany({
      where: { OR: [{ pagaEm: null }, { pagaEm: { gte: new Date(Date.now() - 30 * DIA) } }] },
      include: {
        contaFixa: { select: { nome: true } },
        contaAPagar: { select: { vencimento: true, pagaEm: true } },
      },
      orderBy: [{ pagaEm: { sort: 'desc', nulls: 'first' } }, { vencimento: { sort: 'asc', nulls: 'last' } }, { criadaEm: 'desc' }],
    });

    return cobrancas.map((c) => ({
      id: c.id,
      tipo: c.tipo,
      codigo: c.codigo,
      titulo: c.descricao ?? c.contaFixa?.nome ?? c.recebedor ?? (c.tipo === 'PIX' ? 'Pix' : 'Boleto'),
      recebedor: c.recebedor,
      valor: c.valor?.toNumber() ?? null,
      // boleto traz o vencimento; Pix usa o da conta fixa, se tiver
      vencimento: c.vencimento ?? c.contaAPagar?.vencimento ?? null,
      pagaEm: c.pagaEm ?? c.contaAPagar?.pagaEm ?? null,
      pagaAutomaticamente: !!c.lancamentoId,
    }));
  }

  async marcar(id: string, paga: boolean) {
    const cobranca = await this.prisma.cobranca.findUnique({ where: { id } });
    if (!cobranca) throw new NotFoundException('código não encontrado');
    const pagaEm = paga ? new Date() : null;
    await this.prisma.cobranca.update({ where: { id }, data: { pagaEm, ...(!paga && { lancamentoId: null }) } });
    if (cobranca.contaAPagarId) {
      await this.prisma.contaAPagar.update({
        where: { id: cobranca.contaAPagarId },
        data: { pagaEm, ...(!paga && { lancamentoId: null }) },
      });
    }
  }

  async remover(id: string) {
    await this.prisma.cobranca.deleteMany({ where: { id } });
  }

  private ler(codigo: string) {
    try {
      return lerCodigo(codigo);
    } catch (erro) {
      if (erro instanceof CodigoInvalido) throw new BadRequestException(erro.message);
      throw erro;
    }
  }

  // A conta fixa daquele mês ganha o valor de verdade (o da fatura que chegou).
  private async contaDoMes(contaFixaId: string, vencimento: Date | null, valor: number | null) {
    const fixa = await this.prisma.contaFixa.findUnique({ where: { id: contaFixaId } });
    if (!fixa) throw new NotFoundException('conta fixa não encontrada');

    const referencia = vencimento ?? new Date();
    const ano = referencia.getUTCFullYear();
    const mes = referencia.getUTCMonth();
    const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
    const venceNoMes = new Date(Date.UTC(ano, mes, Math.min(fixa.diaVencimento, ultimoDia)));

    // o vencimento da conta do mês continua o da conta fixa: é ele que impede
    // o gerador mensal de criar a mesma conta duas vezes
    const chave = { contaFixaId_vencimento: { contaFixaId, vencimento: venceNoMes } };
    const existente = await this.prisma.contaAPagar.findUnique({ where: chave, include: { cobranca: { select: { id: true } } } });
    if (existente?.cobranca) throw new ConflictException(`A conta "${fixa.nome}" deste mês já tem um código. Apague o antigo antes.`);

    const conta = await this.prisma.contaAPagar.upsert({
      where: chave,
      create: { contaFixaId, nome: fixa.nome, valor: valor ?? fixa.valorPrevisto, vencimento: venceNoMes },
      update: { ...(valor !== null && { valor }) },
    });
    return conta.id;
  }

  // Pagou pelo app do banco? Quando o débito de mesmo valor aparece no extrato
  // (do dia em que o código chegou até 10 dias depois), marca como paga.
  private async ligarPagamentos() {
    const pendentes = await this.prisma.cobranca.findMany({ where: { pagaEm: null, valor: { not: null } } });
    for (const c of pendentes) {
      const pagamento = await this.prisma.lancamento.findFirst({
        where: {
          sentido: 'SAIDA',
          valor: c.valor!,
          data: { gte: new Date(c.criadaEm.getTime() - 3 * DIA), lte: new Date(c.criadaEm.getTime() + 10 * DIA) },
          cobranca: null,
          ...(c.contaAPagarId ? { OR: [{ contaAPagar: null }, { contaAPagar: { id: c.contaAPagarId } }] } : { contaAPagar: null }),
        },
        orderBy: { data: 'asc' },
      });
      if (!pagamento) continue;

      await this.prisma.cobranca.update({ where: { id: c.id }, data: { pagaEm: pagamento.data, lancamentoId: pagamento.id } });
      if (c.contaAPagarId) {
        await this.prisma.contaAPagar.update({
          where: { id: c.contaAPagarId },
          data: { pagaEm: pagamento.data, lancamentoId: pagamento.id },
        });
      }
    }
  }
}

@Controller('cobrancas')
class CobrancasController {
  constructor(private readonly cobrancas: CobrancasService) {}

  @Get()
  listar() {
    return this.cobrancas.listar();
  }

  @Post('conferir')
  @HttpCode(200)
  conferir(@Body() dados: NovaCobranca) {
    return this.cobrancas.conferir(dados.codigo);
  }

  @Post()
  criar(@Body() dados: NovaCobranca) {
    return this.cobrancas.criar(dados);
  }

  @Patch(':id')
  marcar(@Param('id') id: string, @Body() dados: MarcarPaga) {
    return this.cobrancas.marcar(id, dados.paga);
  }

  @Delete(':id')
  @HttpCode(204)
  remover(@Param('id') id: string) {
    return this.cobrancas.remover(id);
  }
}

@Module({
  controllers: [CobrancasController],
  providers: [CobrancasService],
})
export class CobrancasModule {}
