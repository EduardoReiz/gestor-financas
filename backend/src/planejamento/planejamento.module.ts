import { Body, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt, IsNumber, IsOptional, IsPositive, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.module';
import { intervaloDoMes } from '../comum/mes';
import { ContasModule, ContasService } from '../contas/contas.module';

class DadosReceita {
  @IsString() @MaxLength(60) nome!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() valor!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(31) dia?: number;
  @IsOptional() @IsString() @MaxLength(40) contem?: string;
}

class DadosOrcamento {
  @IsString() @MaxLength(40) nome!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() valorMensal!: number;
  @IsArray() @ArrayNotEmpty() @IsString({ each: true }) categoriaIds!: string[];
}

class FiltroMes {
  @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) mes?: string;
}

const centavos = (v: number) => Math.round(v * 100) / 100;

@Injectable()
class PlanejamentoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contas: ContasService,
  ) {}

  // A sobra do mês parte do dinheiro que existe HOJE, não da renda do mês
  // inteiro (senão o que você já gastou no Pix e no débito some da conta):
  //
  //   saldo de hoje nas contas conectadas
  // + renda que ainda vai cair neste mês
  // − contas do mês que ainda não foram pagas
  // − fatura do cartão que ainda vence neste mês
  // = quanto sobra no fim do mês, se nada mais for gasto
  //
  // A fatura que está correndo (vence no mês que vem) aparece à parte: ela
  // sai do dinheiro do mês que vem.
  async doMes(mes?: string) {
    const { inicio, fim } = intervaloDoMes(mes);
    const hoje = new Date();
    const inicioDeHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const mesAtual = hoje >= inicio && hoje < fim;

    const [receitas, contasDoMes, contas, faturas] = await Promise.all([
      this.receitasDoMes(inicio, fim),
      this.contas.doMes(mes),
      this.prisma.conta.findMany({ include: { conexao: { select: { banco: true } } } }),
      this.prisma.fatura.findMany({
        where: { paga: false },
        include: { conta: { include: { conexao: { select: { banco: true } } } } },
        orderBy: { vencimento: 'asc' },
      }),
    ]);

    const saldoHoje = centavos(contas.filter((c) => c.tipo !== 'CARTAO_CREDITO').reduce((s, c) => s + c.saldo.toNumber(), 0));
    // renda que ainda vai cair: não caiu e o dia ainda não passou
    const aReceber = receitas.filter((r) => !r.recebida && (!mesAtual || r.dia === null || r.dia > hoje.getDate()));
    // receita sem nome no extrato e com o dia já passado: caiu numa conta não conectada (Santander)
    const foraDasContas = receitas.filter((r) => !r.recebida && !r.contem && mesAtual && r.dia !== null && r.dia <= hoje.getDate());
    const faturaNoMes = faturas.filter((f) => f.vencimento >= inicioDeHoje && f.vencimento < fim);
    const faturaSeguinte = faturas.filter((f) => f.vencimento >= fim);

    const totalAReceber = centavos(aReceber.reduce((s, r) => s + r.valor, 0));
    const totalFaturaNoMes = centavos(faturaNoMes.reduce((s, f) => s + f.total.toNumber(), 0));

    const cartoes = contas
      .filter((c) => c.tipo === 'CARTAO_CREDITO' && c.limite)
      .map((c) => ({
        banco: c.conexao.banco,
        final: c.numeroFinal,
        limite: c.limite!.toNumber(),
        usado: c.usado?.toNumber() ?? null,
        disponivel: c.limiteDisponivel?.toNumber() ?? null,
      }));

    return {
      mesAtual,
      sobra: {
        saldoHoje,
        aReceber: totalAReceber,
        contasEmAberto: contasDoMes.falta,
        faturaNoMes: totalFaturaNoMes,
        sobraEstimada: centavos(saldoHoje + totalAReceber - contasDoMes.falta - totalFaturaNoMes),
      },
      detalhes: {
        aReceber: aReceber.map((r) => ({ nome: r.nome, valor: r.valor, dia: r.dia })),
        foraDasContas: foraDasContas.map((r) => ({ nome: r.nome, valor: r.valor, dia: r.dia })),
        contasEmAberto: contasDoMes.aVencer.map((c) => ({ nome: c.nome, valor: c.valor, vencimento: c.vencimento, estimado: c.estimado })),
        faturaNoMes: faturaNoMes.map((f) => ({ banco: f.conta.conexao.banco, vencimento: f.vencimento, total: f.total.toNumber() })),
        faturaSeguinte: faturaSeguinte.map((f) => ({
          banco: f.conta.conexao.banco,
          fechamento: f.fechamento,
          vencimento: f.vencimento,
          total: f.total.toNumber(),
        })),
        cartoes,
      },
      receitas,
    };
  }

  // Quanto já foi gasto de cada limite, quanto resta e quanto dá por dia.
  async limites(mes?: string) {
    const { inicio, fim } = intervaloDoMes(mes);
    const hoje = new Date();
    const diasNoMes = Math.round((fim.getTime() - inicio.getTime()) / 86_400_000);
    const mesAtual = hoje >= inicio && hoje < fim;
    const diaDeHoje = mesAtual ? hoje.getDate() : hoje < inicio ? 0 : diasNoMes;
    const diasRestantes = mesAtual ? diasNoMes - diaDeHoje + 1 : 0; // conta hoje

    const [orcamentos, ultimoCartao] = await Promise.all([
      this.orcamentosDoMes(inicio, fim),
      // até quando chegaram as compras do cartão: o banco manda com atraso
      this.prisma.lancamento.findFirst({
        where: { conta: { tipo: 'CARTAO_CREDITO' } },
        orderBy: { data: 'desc' },
        select: { data: true },
      }),
    ]);

    return {
      diasNoMes,
      diasRestantes,
      comprasDoCartaoAte: ultimoCartao?.data ?? null,
      limites: orcamentos.map((o) => {
        const resta = centavos(o.valorMensal - o.gasto);
        const fracao = o.valorMensal ? o.gasto / o.valorMensal : 0;
        // no ritmo de agora, quanto vai dar no fim do mês (só depois de alguns dias)
        const projecao = mesAtual && diaDeHoje >= 5 ? centavos((o.gasto / diaDeHoje) * diasNoMes) : null;
        const situacao = fracao >= 1 ? 'estourou' : fracao >= 0.8 || (projecao !== null && projecao > o.valorMensal) ? 'atencao' : 'ok';
        return {
          ...o,
          resta,
          fracao,
          porDia: diasRestantes > 0 ? centavos(Math.max(0, resta) / diasRestantes) : null,
          projecao,
          situacao,
        };
      }),
    };
  }

  // Receita "caiu" quando aparece uma entrada com o nome dela perto do dia esperado.
  private async receitasDoMes(inicio: Date, fim: Date) {
    const receitas = await this.prisma.receita.findMany({ where: { ativa: true }, orderBy: [{ dia: 'asc' }, { nome: 'asc' }] });
    const usados = new Set<string>();

    const lista = [];
    for (const r of receitas) {
      let recebida: { valor: number; data: Date } | null = null;
      if (r.contem) {
        const entradas = await this.prisma.lancamento.findMany({
          where: { sentido: 'ENTRADA', data: { gte: inicio, lt: fim }, descricao: { contains: r.contem, mode: 'insensitive' } },
        });
        const alvo = r.valor.toNumber();
        const melhor = entradas
          .filter((e) => !usados.has(e.id))
          .sort((a, b) => Math.abs(a.valor.toNumber() - alvo) - Math.abs(b.valor.toNumber() - alvo))[0];
        if (melhor) {
          usados.add(melhor.id);
          recebida = { valor: melhor.valor.toNumber(), data: melhor.data };
        }
      }
      lista.push({ id: r.id, nome: r.nome, valor: r.valor.toNumber(), dia: r.dia, contem: r.contem, recebida });
    }
    return lista;
  }

  private async orcamentosDoMes(inicio: Date, fim: Date) {
    const limites = await this.prisma.limite.findMany({
      include: { categorias: { select: { id: true, nome: true } } },
      orderBy: { nome: 'asc' },
    });
    // estorno (entrada na mesma categoria) devolve ao limite
    const gastos = await this.prisma.lancamento.groupBy({
      by: ['categoriaId', 'sentido'],
      where: { data: { gte: inicio, lt: fim }, categoriaId: { not: null } },
      _sum: { valor: true },
    });
    const porCategoria = new Map<string, number>();
    for (const g of gastos) {
      const valor = (g._sum.valor ?? new Prisma.Decimal(0)).toNumber() * (g.sentido === 'SAIDA' ? 1 : -1);
      porCategoria.set(g.categoriaId!, (porCategoria.get(g.categoriaId!) ?? 0) + valor);
    }

    return limites.map((l) => ({
      id: l.id,
      nome: l.nome,
      valorMensal: l.valorMensal.toNumber(),
      gasto: centavos(Math.max(0, l.categorias.reduce((s, c) => s + (porCategoria.get(c.id) ?? 0), 0))),
      categorias: l.categorias,
    }));
  }

  // ---------- receitas ----------

  criarReceita(dados: DadosReceita) {
    return this.prisma.receita.create({ data: { ...dados, contem: dados.contem?.trim() || null } });
  }

  async editarReceita(id: string, dados: Partial<DadosReceita>) {
    await this.existe('receita', id);
    await this.prisma.receita.update({
      where: { id },
      data: { ...dados, ...(dados.contem !== undefined && { contem: dados.contem.trim() || null }) },
    });
  }

  async removerReceita(id: string) {
    await this.existe('receita', id);
    await this.prisma.receita.update({ where: { id }, data: { ativa: false } });
  }

  // ---------- orçamentos ----------

  criarOrcamento(dados: DadosOrcamento) {
    return this.prisma.limite.create({
      data: { nome: dados.nome, valorMensal: dados.valorMensal, categorias: { connect: dados.categoriaIds.map((id) => ({ id })) } },
    });
  }

  async editarOrcamento(id: string, dados: Partial<DadosOrcamento>) {
    await this.existe('limite', id);
    await this.prisma.limite.update({
      where: { id },
      data: {
        nome: dados.nome,
        valorMensal: dados.valorMensal,
        ...(dados.categoriaIds && { categorias: { set: dados.categoriaIds.map((c) => ({ id: c })) } }),
      },
    });
  }

  async removerOrcamento(id: string) {
    await this.existe('limite', id);
    await this.prisma.limite.delete({ where: { id } });
  }

  private async existe(tabela: 'receita' | 'limite', id: string) {
    const achado =
      tabela === 'receita'
        ? await this.prisma.receita.findUnique({ where: { id }, select: { id: true } })
        : await this.prisma.limite.findUnique({ where: { id }, select: { id: true } });
    if (!achado) throw new NotFoundException(`${tabela === 'receita' ? 'receita' : 'orçamento'} não encontrado`);
  }
}

@Controller()
class PlanejamentoController {
  constructor(private readonly planejamento: PlanejamentoService) {}

  @Get('planejamento')
  doMes(@Query() filtro: FiltroMes) {
    return this.planejamento.doMes(filtro.mes);
  }

  @Get('limites')
  limites(@Query() filtro: FiltroMes) {
    return this.planejamento.limites(filtro.mes);
  }

  @Post('receitas')
  criarReceita(@Body() dados: DadosReceita) {
    return this.planejamento.criarReceita(dados);
  }

  @Patch('receitas/:id')
  @HttpCode(204)
  editarReceita(@Param('id') id: string, @Body() dados: DadosReceita) {
    return this.planejamento.editarReceita(id, dados);
  }

  @Delete('receitas/:id')
  @HttpCode(204)
  removerReceita(@Param('id') id: string) {
    return this.planejamento.removerReceita(id);
  }

  @Post('orcamentos')
  criarOrcamento(@Body() dados: DadosOrcamento) {
    return this.planejamento.criarOrcamento(dados);
  }

  @Patch('orcamentos/:id')
  @HttpCode(204)
  editarOrcamento(@Param('id') id: string, @Body() dados: DadosOrcamento) {
    return this.planejamento.editarOrcamento(id, dados);
  }

  @Delete('orcamentos/:id')
  @HttpCode(204)
  removerOrcamento(@Param('id') id: string) {
    return this.planejamento.removerOrcamento(id);
  }
}

@Module({
  imports: [ContasModule],
  controllers: [PlanejamentoController],
  providers: [PlanejamentoService],
})
export class PlanejamentoModule {}

