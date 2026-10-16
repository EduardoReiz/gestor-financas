import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Sentido, TipoConta } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { PluggyClient, type PluggyConta } from './pluggy.client';
import { traduzirCategoria } from './categorias';

const DIA = 86_400_000;
const soData = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);

// A fatura aberta é a que ainda não fechou. Sem dia de fechamento informado,
// considera 7 dias antes do vencimento (o comum nos bancos brasileiros).
export function cicloAberto(hoje: Date, diaVencimento: number, diaFechamento: number | null) {
  const dia = (ano: number, mes: number, d: number) =>
    new Date(Date.UTC(ano, mes, Math.min(d, new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate())));

  for (let m = -1; m <= 2; m++) {
    const vencimento = dia(hoje.getUTCFullYear(), hoje.getUTCMonth() + m, diaVencimento);
    const fechamento = diaFechamento
      ? dia(vencimento.getUTCFullYear(), vencimento.getUTCMonth() - (diaFechamento > diaVencimento ? 1 : 0), diaFechamento)
      : new Date(vencimento.getTime() - 7 * DIA);
    if (fechamento >= hoje) return { fechamento, vencimento };
  }
  throw new Error('não foi possível calcular o ciclo da fatura');
}

// PLUGGY_ITENS=itemId:Itaú,itemId:Bradesco
// O conector MeuPluggy não diz qual é o banco, então o nome vem daqui.
export function itensConfigurados() {
  return (process.env.PLUGGY_ITENS ?? '')
    .split(',')
    .map((par) => par.trim())
    .filter(Boolean)
    .map((par) => {
      const [id, ...banco] = par.split(':');
      return { id: id.trim(), banco: banco.join(':').trim() || 'Banco' };
    });
}

@Injectable()
export class SincronizacaoService {
  private readonly log = new Logger('Sincronização');
  private rodando = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pluggy: PluggyClient,
  ) {}

  // O Meu Pluggy atualiza os bancos uma vez por dia, de madrugada.
  @Cron('0 6 * * *', { timeZone: 'America/Sao_Paulo' })
  async todoDia() {
    if (this.pluggy.configurado && itensConfigurados().length) await this.sincronizar();
  }

  async sincronizar() {
    if (this.rodando) return { jaEstavaRodando: true };
    this.rodando = true;
    const registro = await this.prisma.sincronizacao.create({ data: {} });
    let novos = 0;

    try {
      const exemplo = await this.prisma.conexao.count({ where: { pluggyItemId: { startsWith: 'exemplo-' } } });
      if (exemplo > 0) throw new Error('Ainda há dados de exemplo no banco. Apague-os antes da primeira sincronização real.');

      const regras = await this.prisma.regraCategoria.findMany();
      for (const { id, banco } of itensConfigurados()) {
        novos += await this.sincronizarItem(id, banco, regras);
      }
      await this.pareaTransferenciasEntreBancos();
      await this.marcaPagamentosDeFatura();
      await this.prisma.sincronizacao.update({
        where: { id: registro.id },
        data: { terminadaEm: new Date(), sucesso: true, novos },
      });
      this.log.log(`concluída: ${novos} lançamentos novos`);
      return { novos };
    } catch (erro) {
      const mensagem = (erro as Error).message;
      await this.prisma.sincronizacao.update({
        where: { id: registro.id },
        data: { terminadaEm: new Date(), sucesso: false, erro: mensagem.slice(0, 500) },
      });
      this.log.error(mensagem);
      throw erro;
    } finally {
      this.rodando = false;
    }
  }

  private async sincronizarItem(itemId: string, banco: string, regras: { contem: string; categoriaId: string }[]) {
    const item = await this.pluggy.item(itemId);
    const conexao = await this.prisma.conexao.upsert({
      where: { pluggyItemId: itemId },
      create: { pluggyItemId: itemId, banco, status: item.status },
      update: { banco, status: item.status },
    });

    let novos = 0;
    for (const contaPluggy of await this.pluggy.contas(itemId)) {
      const conta = await this.salvarConta(conexao.id, contaPluggy);
      const faturaAberta = contaPluggy.subtype === 'CREDIT_CARD' ? await this.salvarFaturas(conta, contaPluggy) : null;
      novos += await this.salvarLancamentos(conta.id, contaPluggy.id, faturaAberta, regras);
      if (faturaAberta) await this.recalcularFaturaAberta(faturaAberta.id);
    }
    await this.salvarInvestimentos(conexao.id, itemId);

    await this.prisma.conexao.update({
      where: { id: conexao.id },
      data: { sincronizadaEm: item.lastUpdatedAt ? new Date(item.lastUpdatedAt) : new Date() },
    });
    return novos;
  }

  private async salvarConta(conexaoId: string, c: PluggyConta) {
    const tipo: TipoConta =
      c.subtype === 'CREDIT_CARD' ? 'CARTAO_CREDITO' : c.subtype === 'SAVINGS_ACCOUNT' ? 'POUPANCA' : 'CORRENTE';
    const cartao = c.creditData;
    const dados = {
      conexaoId,
      tipo,
      nome: c.marketingName ?? c.name,
      numeroFinal: c.number?.replace(/\D/g, '').slice(-4) || null,
      // no cartão o "saldo" é a dívida; quem mostra isso é a fatura
      saldo: tipo === 'CARTAO_CREDITO' ? 0 : c.balance,
      limite: cartao?.creditLimit || null, // alguns cartões vêm com limite 0
      // só sobrescreve os dias quando o banco manda; senão vale o que você corrigiu
      ...(cartao?.balanceCloseDate && { diaFechamento: Number(cartao.balanceCloseDate.slice(8, 10)) }),
      ...(cartao?.balanceDueDate && { diaVencimento: Number(cartao.balanceDueDate.slice(8, 10)) }),
    };
    return this.prisma.conta.upsert({
      where: { pluggyAccountId: c.id },
      create: { pluggyAccountId: c.id, ...dados },
      update: dados,
    });
  }

  // Faturas fechadas vêm de /bills. A aberta é calculada: muitos bancos não
  // mandam o fechamento, então ele é estimado 7 dias antes do vencimento.
  private async salvarFaturas(conta: { id: string; diaFechamento: number | null; diaVencimento: number | null }, c: PluggyConta) {
    const hoje = soData(new Date().toISOString());
    const fechadas = await this.pluggy.faturas(c.id);
    for (const f of fechadas) {
      const vencimento = soData(f.dueDate);
      const dados = { vencimento, total: Math.abs(f.totalAmount), paga: vencimento < hoje };
      await this.prisma.fatura.upsert({
        where: { pluggyBillId: f.id },
        create: { contaId: conta.id, pluggyBillId: f.id, fechamento: new Date(vencimento.getTime() - 7 * DIA), ...dados },
        update: dados,
      });
    }

    const ultimaFechada = fechadas.map((f) => soData(f.dueDate)).sort((a, b) => b.getTime() - a.getTime())[0];
    const diaVencimento = conta.diaVencimento ?? (ultimaFechada ? ultimaFechada.getUTCDate() : null);
    if (!diaVencimento) return null; // sem nenhuma data: falta você informar o dia (tela Cartões)

    const { fechamento, vencimento } = cicloAberto(hoje, diaVencimento, conta.diaFechamento);
    const idAberta = `aberta-${c.id}`;
    const anterior = await this.prisma.fatura.findUnique({ where: { pluggyBillId: idAberta } });

    // virou o ciclo: a aberta de antes fecha e ganha um id próprio
    if (anterior && anterior.vencimento.getTime() !== vencimento.getTime()) {
      await this.prisma.fatura.update({
        where: { id: anterior.id },
        data: { pluggyBillId: `${idAberta}-${anterior.vencimento.toISOString().slice(0, 10)}` },
      });
    }

    // o total é recalculado depois, com as compras do ciclo
    return this.prisma.fatura.upsert({
      where: { pluggyBillId: idAberta },
      create: { contaId: conta.id, pluggyBillId: idAberta, fechamento, vencimento, total: 0, paga: false },
      update: { fechamento, vencimento, paga: false },
    });
  }

  // Total da fatura aberta = compras do ciclo menos estornos (sem contar o pagamento).
  private async recalcularFaturaAberta(faturaId: string) {
    const linhas = await this.prisma.lancamento.groupBy({
      by: ['sentido'],
      where: { faturaId, OR: [{ categoriaId: null }, { categoria: { ignorarNosTotais: false } }] },
      _sum: { valor: true },
    });
    const soma = (s: Sentido) => linhas.find((l) => l.sentido === s)?._sum.valor?.toNumber() ?? 0;
    await this.prisma.fatura.update({
      where: { id: faturaId },
      data: { total: Math.max(0, soma('SAIDA') - soma('ENTRADA')) },
    });
  }

  private async salvarLancamentos(
    contaId: string,
    pluggyContaId: string,
    faturaAberta: { id: string; fechamento: Date } | null,
    regras: { contem: string; categoriaId: string }[],
  ) {
    const lancamentos = await this.pluggy.lancamentos(pluggyContaId);
    const faturasPorPluggy = new Map(
      (await this.prisma.fatura.findMany({ where: { contaId, pluggyBillId: { not: null } } })).map((f) => [f.pluggyBillId!, f.id]),
    );
    const existentes = new Map(
      (
        await this.prisma.lancamento.findMany({
          where: { pluggyTransactionId: { in: lancamentos.map((l) => l.id) } },
          select: { pluggyTransactionId: true, origemCategoria: true },
        })
      ).map((l) => [l.pluggyTransactionId!, l]),
    );
    // a fatura aberta junta o que foi comprado no mês até o dia do fechamento;
    // o que vem depois já é da próxima
    const ciclo = faturaAberta && {
      de: new Date(faturaAberta.fechamento.getTime() - 31 * DIA),
      ate: new Date(faturaAberta.fechamento.getTime() + DIA),
    };

    let novos = 0;
    for (const l of lancamentos) {
      const sentido: Sentido = l.type === 'DEBIT' ? 'SAIDA' : 'ENTRADA';
      const data = new Date(l.date);
      const meta = l.creditCardMetadata;

      let faturaId: string | null = null;
      if (meta?.billId && faturasPorPluggy.has(meta.billId)) faturaId = faturasPorPluggy.get(meta.billId)!;
      else if (faturaAberta && ciclo && data > ciclo.de && data < ciclo.ate) faturaId = faturaAberta.id;

      const doBanco = {
        contaId,
        data,
        descricao: l.description,
        valor: Math.abs(l.amount),
        sentido,
        faturaId,
        parcelaAtual: meta?.installmentNumber ?? null,
        parcelasTotal: meta?.totalInstallments ?? null,
      };

      const existente = existentes.get(l.id);
      // categoria que você escolheu na mão nunca é trocada pela sincronização
      const categoria = existente?.origemCategoria === 'MANUAL' ? null : await this.categoriaPara(l.description, l.categoryId, sentido, regras);

      if (existente) {
        await this.prisma.lancamento.update({
          where: { pluggyTransactionId: l.id },
          data: { ...doBanco, ...(categoria && categoria) },
        });
      } else {
        await this.prisma.lancamento.create({
          data: {
            pluggyTransactionId: l.id,
            ...doBanco,
            ...(categoria ?? { categoriaId: null, origemCategoria: null, categoriaConfirmada: false }),
          },
        });
        novos++;
      }
    }
    return novos;
  }

  // Ordem: suas regras > categoria do Pluggy > sem categoria (o app pergunta).
  private async categoriaPara(
    descricao: string,
    pluggyId: string | null,
    sentido: Sentido,
    regras: { contem: string; categoriaId: string }[],
  ) {
    const regra = regras.find((r) => descricao.toLowerCase().includes(r.contem.toLowerCase()));
    if (regra) return { categoriaId: regra.categoriaId, origemCategoria: 'REGRA' as const, categoriaConfirmada: true };

    const destino = traduzirCategoria(pluggyId, sentido);
    if (!destino) return null;

    const categoria = await this.prisma.categoria.upsert({
      where: { nome: destino.nome },
      create: { ...destino, ignorarNosTotais: !!destino.ignorarNosTotais, sentido },
      update: {},
    });
    return { categoriaId: categoria.id, origemCategoria: 'PLUGGY' as const, categoriaConfirmada: true };
  }

  // Pix do Sicredi para o Bradesco aparece como saída num banco e entrada no
  // outro. Nem sempre o Pluggy reconhece que é a mesma pessoa, e aí entrava em
  // dobro nos totais. Mesmo valor, bancos diferentes, até 2 dias: é a mesma
  // transferência. Não mexe no que você categorizou na mão.
  private async pareaTransferenciasEntreBancos() {
    const candidatos = await this.prisma.lancamento.findMany({
      where: {
        conta: { tipo: { not: 'CARTAO_CREDITO' } },
        OR: [{ origemCategoria: null }, { origemCategoria: { not: 'MANUAL' } }],
      },
      select: { id: true, data: true, valor: true, sentido: true, conta: { select: { conexaoId: true } } },
      orderBy: { data: 'asc' },
    });

    const entradas = candidatos.filter((l) => l.sentido === 'ENTRADA');
    const usados = new Set<string>();
    const pares: string[] = [];

    for (const saida of candidatos.filter((l) => l.sentido === 'SAIDA')) {
      const par = entradas.find(
        (e) =>
          !usados.has(e.id) &&
          e.conta.conexaoId !== saida.conta.conexaoId &&
          e.valor.equals(saida.valor) &&
          Math.abs(e.data.getTime() - saida.data.getTime()) <= 2 * DIA,
      );
      if (!par) continue;
      usados.add(par.id);
      pares.push(saida.id, par.id);
    }
    if (pares.length === 0) return;

    const entreContas = await this.prisma.categoria.upsert({
      where: { nome: 'Entre contas suas' },
      create: { nome: 'Entre contas suas', sentido: 'SAIDA', cor: '#C9D2CE', ignorarNosTotais: true },
      update: {},
    });
    await this.prisma.lancamento.updateMany({
      where: { id: { in: pares } },
      data: { categoriaId: entreContas.id, origemCategoria: 'REGRA', categoriaConfirmada: true },
    });
    this.log.log(`${pares.length / 2} transferências entre seus bancos marcadas`);
  }

  // O pagamento da fatura sai da conta corrente e às vezes vem do Pluggy como
  // "Empréstimos" ou "Transferência". As compras já contaram no cartão, então
  // um débito com o valor exato de uma fatura, perto do vencimento, sai dos totais.
  private async marcaPagamentosDeFatura() {
    const faturas = await this.prisma.fatura.findMany({ where: { total: { gt: 0 } } });
    const pagamentoDeFatura = await this.prisma.categoria.upsert({
      where: { nome: 'Pagamento de fatura' },
      create: { nome: 'Pagamento de fatura', sentido: 'SAIDA', cor: '#C9D2CE', ignorarNosTotais: true },
      update: {},
    });

    let marcados = 0;
    for (const f of faturas) {
      const { count } = await this.prisma.lancamento.updateMany({
        where: {
          sentido: 'SAIDA',
          valor: f.total,
          data: { gte: new Date(f.vencimento.getTime() - 10 * DIA), lte: new Date(f.vencimento.getTime() + 3 * DIA) },
          conta: { tipo: { not: 'CARTAO_CREDITO' } },
          OR: [{ origemCategoria: null }, { origemCategoria: { not: 'MANUAL' } }],
          NOT: { categoriaId: pagamentoDeFatura.id },
        },
        data: { categoriaId: pagamentoDeFatura.id, origemCategoria: 'REGRA', categoriaConfirmada: true },
      });
      marcados += count;
    }
    if (marcados) this.log.log(`${marcados} pagamentos de fatura tirados dos totais`);
  }

  private async salvarInvestimentos(conexaoId: string, itemId: string) {
    const hoje = soData(new Date().toISOString());
    for (const i of await this.pluggy.investimentos(itemId)) {
      const dados = { conexaoId, nome: i.name, tipo: i.type, saldo: i.balance, vencimento: i.dueDate ? soData(i.dueDate) : null };
      const investimento = await this.prisma.investimento.upsert({
        where: { pluggyInvestmentId: i.id },
        create: { pluggyInvestmentId: i.id, ...dados },
        update: dados,
      });
      // a foto do dia: é dela que sai o "rendeu no mês"
      await this.prisma.historicoInvestimento.upsert({
        where: { investimentoId_data: { investimentoId: investimento.id, data: hoje } },
        create: { investimentoId: investimento.id, data: hoje, saldo: i.balance },
        update: { saldo: i.balance },
      });
    }
  }
}
