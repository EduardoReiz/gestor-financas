import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Sentido, TipoConta } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { PluggyClient, type PluggyConta } from './pluggy.client';
import { traduzirCategoria } from './categorias';

const DIA = 86_400_000;
const soData = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);

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
      const faturaAberta = contaPluggy.subtype === 'CREDIT_CARD' ? await this.salvarFaturas(conta.id, contaPluggy) : null;
      novos += await this.salvarLancamentos(conta.id, contaPluggy.id, faturaAberta, regras);
    }
    await this.salvarInvestimentos(conexao.id, itemId);

    await this.prisma.conexao.update({
      where: { id: conexao.id },
      data: { sincronizadaEm: item.lastUpdatedAt ? new Date(item.lastUpdatedAt) : new Date() },
    });
    return novos;
  }

  private salvarConta(conexaoId: string, c: PluggyConta) {
    const tipo: TipoConta =
      c.subtype === 'CREDIT_CARD' ? 'CARTAO_CREDITO' : c.subtype === 'SAVINGS_ACCOUNT' ? 'POUPANCA' : 'CORRENTE';
    const cartao = c.creditData;
    const dados = {
      conexaoId,
      tipo,
      nome: c.marketingName ?? c.name,
      numeroFinal: c.number?.replace(/\D/g, '').slice(-4) || null,
      // no cartão o saldo é a dívida (negativa); a conta guarda o que tem
      saldo: tipo === 'CARTAO_CREDITO' ? 0 : c.balance,
      limite: cartao?.creditLimit ?? null,
      diaFechamento: cartao?.balanceCloseDate ? Number(cartao.balanceCloseDate.slice(8, 10)) : null,
      diaVencimento: cartao?.balanceDueDate ? Number(cartao.balanceDueDate.slice(8, 10)) : null,
    };
    return this.prisma.conta.upsert({
      where: { pluggyAccountId: c.id },
      create: { pluggyAccountId: c.id, ...dados },
      update: dados,
    });
  }

  // Faturas fechadas vêm de /bills; a aberta vem dos dados do próprio cartão.
  private async salvarFaturas(contaId: string, c: PluggyConta) {
    for (const f of await this.pluggy.faturas(c.id)) {
      const vencimento = soData(f.dueDate);
      await this.prisma.fatura.upsert({
        where: { pluggyBillId: f.id },
        // o Pluggy não manda o fechamento das antigas: ~7 dias antes do vencimento
        create: { contaId, pluggyBillId: f.id, vencimento, fechamento: new Date(vencimento.getTime() - 7 * DIA), total: Math.abs(f.totalAmount), paga: true },
        update: { vencimento, total: Math.abs(f.totalAmount) },
      });
    }

    const { balanceCloseDate, balanceDueDate } = c.creditData ?? {};
    if (!balanceCloseDate || !balanceDueDate) return null;

    const idAberta = `aberta-${c.id}`;
    const fechamento = soData(balanceCloseDate);
    const vencimento = soData(balanceDueDate);
    const anterior = await this.prisma.fatura.findUnique({ where: { pluggyBillId: idAberta } });

    // virou o ciclo: a aberta de antes fecha e ganha um id próprio
    if (anterior && anterior.vencimento.getTime() !== vencimento.getTime()) {
      await this.prisma.fatura.update({
        where: { id: anterior.id },
        data: { pluggyBillId: `${idAberta}-${anterior.vencimento.toISOString().slice(0, 10)}` },
      });
    }

    return this.prisma.fatura.upsert({
      where: { pluggyBillId: idAberta },
      create: { contaId, pluggyBillId: idAberta, fechamento, vencimento, total: Math.abs(c.balance), paga: false },
      update: { fechamento, vencimento, total: Math.abs(c.balance), paga: false },
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
      const sentido: Sentido = l.amount < 0 ? 'SAIDA' : 'ENTRADA';
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
