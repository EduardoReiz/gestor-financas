import { Injectable } from '@nestjs/common';
import { Prisma, Sentido } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { intervaloDoMes, mesesAntes } from '../comum/mes';
import { SugestoesService } from '../sugestoes/sugestoes.module';

const num = (d: Prisma.Decimal | null | undefined) => (d ? d.toNumber() : 0);

// Soma em Decimal e só converte no fim: somar Number acumula erro de centavos.
const somar = (valores: (Prisma.Decimal | null | undefined)[]) =>
  valores.reduce<Prisma.Decimal>((soma, v) => (v ? soma.plus(v) : soma), new Prisma.Decimal(0));

@Injectable()
export class ResumoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sugestoes: SugestoesService,
  ) {}

  async doMes(mes?: string) {
    await this.sugestoes.gerar();
    const intervalo = intervaloDoMes(mes);
    const hoje = new Date();

    // Lançamentos que contam nos totais: fora pagamento de fatura e transferências.
    const contaNosTotais: Prisma.LancamentoWhereInput = {
      OR: [{ categoriaId: null }, { categoria: { ignorarNosTotais: false } }],
    };
    const doMes = { data: { gte: intervalo.inicio, lt: intervalo.fim }, ...contaNosTotais };

    const [contas, porSentido, porCategoria, categorias, faturas, contasAPagar, metas, investimentos, sugestao, ultimaSync] =
      await Promise.all([
        this.prisma.conta.findMany({ where: { tipo: { not: 'CARTAO_CREDITO' } }, select: { saldo: true } }),
        this.prisma.lancamento.groupBy({ by: ['sentido'], where: doMes, _sum: { valor: true } }),
        this.prisma.lancamento.groupBy({
          by: ['categoriaId'],
          where: { ...doMes, sentido: Sentido.SAIDA },
          _sum: { valor: true },
        }),
        this.prisma.categoria.findMany({ select: { id: true, nome: true } }),
        this.prisma.fatura.findMany({
          where: { paga: false },
          include: { conta: { include: { conexao: true } } },
          orderBy: { vencimento: 'asc' },
        }),
        // as atrasadas primeiro (ficavam de fora), depois as próximas
        this.prisma.contaAPagar.findMany({
          where: { pagaEm: null, vencimento: { lt: new Date(inicioDoDia(hoje).getTime() + 31 * 86_400_000) } },
          orderBy: { vencimento: 'asc' },
          take: 4,
        }),
        this.prisma.meta.findMany({
          where: { arquivada: false },
          include: { aportes: { select: { valor: true } } },
          orderBy: { prazo: 'asc' },
        }),
        this.prisma.investimento.findMany({
          include: {
            historico: { where: { data: { lt: intervalo.inicio } }, orderBy: { data: 'desc' }, take: 1 },
          },
        }),
        this.prisma.sugestao
          .findMany({ where: { status: 'NOVA', tipo: 'ONDE' }, orderBy: { impactoMensal: 'desc' } })
          // atraso primeiro, mesmo que valha pouco: é o que dói no score
          .then((s) => s.find((x) => x.chave.startsWith('atraso-')) ?? s[0] ?? null),
        this.prisma.sincronizacao.findFirst({ where: { sucesso: true }, orderBy: { iniciadaEm: 'desc' } }),
      ]);

    const nomeCategoria = new Map(categorias.map((c) => [c.id, c.nome]));
    const total = (s: Sentido) => num(porSentido.find((p) => p.sentido === s)?._sum.valor);

    const investido = somar(investimentos.map((i) => i.saldo));
    const investidoNoInicioDoMes = somar(investimentos.map((i) => i.historico[0]?.saldo ?? i.saldo));

    return {
      mes: `${intervalo.inicio.getFullYear()}-${String(intervalo.inicio.getMonth() + 1).padStart(2, '0')}`,
      atualizadoEm: ultimaSync?.terminadaEm ?? null,
      saldoContas: somar(contas.map((c) => c.saldo)).toNumber(),
      entradas: total(Sentido.ENTRADA),
      saidas: total(Sentido.SAIDA),
      porCategoria: porCategoria
        .map((p) => ({
          categoria: p.categoriaId ? nomeCategoria.get(p.categoriaId)! : 'Sem categoria',
          valor: num(p._sum.valor),
        }))
        .sort((a, b) => b.valor - a.valor),
      saidasUltimosMeses: await this.saidasPorMes(mesesAntes(intervalo, 5), intervalo.fim),
      faturasAbertas: faturas.map((f) => ({
        id: f.id,
        banco: f.conta.conexao.banco,
        vencimento: f.vencimento,
        total: num(f.total),
      })),
      proximasContas: contasAPagar.map((c) => ({
        id: c.id,
        nome: c.nome,
        vencimento: c.vencimento,
        valor: num(c.valor),
      })),
      metas: metas.map((m) => ({
        id: m.id,
        nome: m.nome,
        alvo: num(m.valorAlvo),
        guardado: somar(m.aportes.map((a) => a.valor)).toNumber(),
        prazo: m.prazo,
      })),
      investimentos: {
        total: investido.toNumber(),
        rendimentoNoMes: investido.minus(investidoNoInicioDoMes).toNumber(),
      },
      sugestao: sugestao && { id: sugestao.id, titulo: sugestao.titulo, texto: sugestao.texto },
      codigosParaPagar: await this.codigosParaPagar(),
    };
  }

  private async codigosParaPagar() {
    const pendentes = await this.prisma.cobranca.findMany({
      where: { pagaEm: null },
      select: { valor: true, enviadaPor: { select: { pessoa: true } } },
    });
    const enviadosPor = [...new Set(pendentes.map((c) => c.enviadaPor?.pessoa).filter((p): p is string => !!p))];
    return {
      quantidade: pendentes.length,
      total: pendentes.reduce((s, c) => s + (c.valor?.toNumber() ?? 0), 0),
      enviadosPor,
    };
  }

  // Saídas mês a mês, já sem pagamento de fatura e transferências.
  private async saidasPorMes(de: Date, ate: Date) {
    const linhas = await this.prisma.$queryRaw<{ mes: Date; total: Prisma.Decimal }[]>`
      SELECT date_trunc('month', l.data) AS mes, SUM(l.valor) AS total
      FROM "Lancamento" l
      LEFT JOIN "Categoria" c ON c.id = l."categoriaId"
      WHERE l.sentido = 'SAIDA'
        AND l.data >= ${de} AND l.data < ${ate}
        AND (c.id IS NULL OR c."ignorarNosTotais" = false)
      GROUP BY 1
      ORDER BY 1`;

    return linhas.map((l) => ({ mes: l.mes, total: num(l.total) }));
  }
}

function inicioDoDia(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
