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

  // Tudo o que a tela Planejamento mostra, e a sobra estimada do mês:
  // renda prevista − contas do mês − faturas de cartão que vencem no mês.
  async doMes(mes?: string) {
    const { inicio, fim } = intervaloDoMes(mes);
    const [receitas, orcamentos, contasDoMes, faturas] = await Promise.all([
      this.receitasDoMes(inicio, fim),
      this.orcamentosDoMes(inicio, fim),
      this.contas.doMes(mes),
      this.prisma.fatura.findMany({
        where: { vencimento: { gte: inicio, lt: fim } },
        include: { conta: { include: { conexao: { select: { banco: true } } } } },
      }),
    ]);

    const rendaPrevista = centavos(receitas.reduce((s, r) => s + r.valor, 0));
    const rendaRecebida = centavos(receitas.reduce((s, r) => s + (r.recebida?.valor ?? 0), 0));
    const faturasCartao = centavos(faturas.reduce((s, f) => s + f.total.toNumber(), 0));

    return {
      resumo: {
        rendaPrevista,
        rendaRecebida,
        contasDoMes: contasDoMes.total,
        faturasCartao,
        sobraEstimada: centavos(rendaPrevista - contasDoMes.total - faturasCartao),
      },
      faturas: faturas.map((f) => ({ banco: f.conta.conexao.banco, vencimento: f.vencimento, total: f.total.toNumber() })),
      receitas,
      orcamentos,
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
    const gastos = await this.prisma.lancamento.groupBy({
      by: ['categoriaId'],
      where: { sentido: 'SAIDA', data: { gte: inicio, lt: fim }, categoriaId: { not: null } },
      _sum: { valor: true },
    });
    const porCategoria = new Map(gastos.map((g) => [g.categoriaId!, g._sum.valor ?? new Prisma.Decimal(0)]));

    return limites.map((l) => ({
      id: l.id,
      nome: l.nome,
      valorMensal: l.valorMensal.toNumber(),
      gasto: centavos(l.categorias.reduce((s, c) => s + (porCategoria.get(c.id)?.toNumber() ?? 0), 0)),
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

