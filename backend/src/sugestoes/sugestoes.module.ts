import { Body, Controller, Get, Injectable, Module, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { Prisma, StatusSugestao, TipoSugestao } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsPositive, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.module';

class Responder {
  @IsIn(['ACEITA', 'IGNORADA']) status!: 'ACEITA' | 'IGNORADA';
}

class NovoLimite {
  @IsString() categoriaId!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() valorMensal!: number;
}

interface Ideia {
  chave: string;
  tipo: TipoSugestao;
  titulo: string;
  texto: string;
  impactoMensal?: number;
  categoriaId?: string;
}

const DIA = 86_400_000;
// descrições que os bancos usam para cobrança de atraso
const ENCARGO = /JUROS|MULTA|ENCARGO|MORA\b|ATRASO|ROTATIV/i;
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const ddmm = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const centavos = (v: number) => Math.round(v * 100) / 100;
const nomeDoMes = (d: Date) => d.toLocaleDateString('pt-BR', { month: 'long' });

@Injectable()
export class SugestoesService {
  constructor(private readonly prisma: PrismaService) {}

  // Olha os dados e cria as sugestões que ainda não existem. As que você já
  // aceitou ou ignorou continuam como estão: a chave impede repetir.
  async gerar(hoje = new Date()) {
    const ideias = [
      ...(await this.jurosEAtraso(hoje)),
      ...(await this.categoriasEmAlta(hoje)),
      ...(await this.limitesEstourados(hoje)),
      ...(await this.assinaturas(hoje)),
      ...(await this.melhorDiaDeCompra(hoje)),
    ];

    for (const ideia of ideias) {
      const { chave, ...resto } = ideia;
      await this.prisma.sugestao.upsert({
        where: { chave },
        create: ideia,
        // atualiza os números, mas nunca a resposta que você já deu
        update: { titulo: resto.titulo, texto: resto.texto, impactoMensal: resto.impactoMensal },
      });
    }
  }

  async novas() {
    await this.gerar();
    const sugestoes = await this.prisma.sugestao.findMany({
      where: { status: 'NOVA', criadaEm: { gte: new Date(Date.now() - 40 * DIA) } },
      include: { categoria: { select: { id: true, nome: true, limite: true } } },
      orderBy: [{ tipo: 'asc' }, { criadaEm: 'desc' }],
    });

    return sugestoes.map((s) => ({
      id: s.id,
      tipo: s.tipo,
      regra: s.chave.split('-')[0], // alta, limite, assinaturas, melhor
      titulo: s.titulo,
      texto: s.texto,
      impactoMensal: s.impactoMensal?.toNumber() ?? null,
      categoria: s.categoria && {
        id: s.categoria.id,
        nome: s.categoria.nome,
        limiteAtual: s.categoria.limite?.valorMensal.toNumber() ?? null,
      },
    }));
  }

  async responder(id: string, status: StatusSugestao) {
    const sugestao = await this.prisma.sugestao.findUnique({ where: { id } });
    if (!sugestao) throw new NotFoundException('sugestão não encontrada');
    await this.prisma.sugestao.update({ where: { id }, data: { status } });
  }

  definirLimite(dados: NovoLimite) {
    return this.prisma.limite.upsert({
      where: { categoriaId: dados.categoriaId },
      create: dados,
      update: { valorMensal: dados.valorMensal },
    });
  }

  // ---------- as regras ----------

  // Juros, multa, encargos ou IOF de atraso em qualquer conta ou cartão.
  // Pouco dinheiro, mas é sinal de conta esquecida (e atraso pesa no score).
  private async jurosEAtraso(hoje: Date): Promise<Ideia[]> {
    const encargos = await this.prisma.lancamento.findMany({
      where: { sentido: 'SAIDA', data: { gte: new Date(hoje.getTime() - 45 * DIA) } },
      select: { descricao: true, valor: true, data: true, conta: { select: { id: true, nome: true, conexao: { select: { banco: true } } } } },
    });
    const porConta = new Map<string, { nome: string; total: number; ultimo: Date }>();
    for (const l of encargos.filter((e) => ENCARGO.test(e.descricao))) {
      const atual = porConta.get(l.conta.id) ?? { nome: `${l.conta.conexao.banco} · ${l.conta.nome}`, total: 0, ultimo: l.data };
      atual.total += l.valor.toNumber();
      if (l.data > atual.ultimo) atual.ultimo = l.data;
      porConta.set(l.conta.id, atual);
    }

    return [...porConta].map(([contaId, { nome, total, ultimo }]) => ({
      chave: `atraso-${contaId}-${chaveMes(ultimo)}`,
      tipo: 'ONDE' as const,
      titulo: `Cobrança de atraso: ${nome}`,
      texto:
        `${brl(total)} em juros, multa ou IOF de atraso (último em ${ddmm(ultimo)}). ` +
        'Pague o saldo devedor atualizado no app do banco e veja se não há alguma cobrança recorrente esquecida.',
      impactoMensal: centavos(total),
    }));
  }

  // Categoria que, no meio do mês, já passou do mês anterior inteiro (+10%, +R$ 30).
  private async categoriasEmAlta(hoje: Date): Promise<Ideia[]> {
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const inicioAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const [atual, anterior] = await Promise.all([
      this.saidasPorCategoria(inicioMes, hoje),
      this.saidasPorCategoria(inicioAnterior, inicioMes),
    ]);

    const ideias: Ideia[] = [];
    for (const [categoriaId, { nome, total }] of atual) {
      const antes = anterior.get(categoriaId)?.total ?? 0;
      if (antes <= 0 || total < antes * 1.1 || total - antes < 30) continue;
      const alta = Math.round((total / antes - 1) * 100);
      ideias.push({
        chave: `alta-${categoriaId}-${chaveMes(inicioMes)}`,
        tipo: 'ONDE',
        categoriaId,
        titulo: `${nome} já passou de ${nomeDoMes(inicioAnterior)} (+${alta}%)`,
        texto: `${brl(total)} até agora em ${nomeDoMes(inicioMes)}, contra ${brl(antes)} em ${nomeDoMes(inicioAnterior)} inteiro.`,
        impactoMensal: centavos(total - antes),
      });
    }
    return ideias;
  }

  private async limitesEstourados(hoje: Date): Promise<Ideia[]> {
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const [limites, gastos] = await Promise.all([
      this.prisma.limite.findMany({ include: { categoria: true } }),
      this.saidasPorCategoria(inicioMes, hoje),
    ]);
    return limites
      .filter((l) => (gastos.get(l.categoriaId)?.total ?? 0) > l.valorMensal.toNumber())
      .map((l) => {
        const gasto = gastos.get(l.categoriaId)!.total;
        return {
          chave: `limite-${l.categoriaId}-${chaveMes(inicioMes)}`,
          tipo: 'ONDE' as const,
          categoriaId: l.categoriaId,
          titulo: `Você passou do limite de ${l.categoria.nome}`,
          texto: `${brl(gasto)} gastos para um limite de ${brl(l.valorMensal.toNumber())} no mês.`,
          impactoMensal: centavos(gasto - l.valorMensal.toNumber()),
        };
      });
  }

  // Três ou mais assinaturas diferentes cobradas nos últimos 35 dias.
  private async assinaturas(hoje: Date): Promise<Ideia[]> {
    const lancamentos = await this.prisma.lancamento.findMany({
      where: { sentido: 'SAIDA', categoria: { nome: 'Assinaturas' }, data: { gte: new Date(hoje.getTime() - 35 * DIA) } },
      select: { descricao: true, valor: true, categoriaId: true },
    });
    const porServico = new Map(lancamentos.map((l) => [l.descricao, l]));
    if (porServico.size < 3) return [];

    const total = [...porServico.values()].reduce((s, l) => s + l.valor.toNumber(), 0);
    const media = total / porServico.size;
    return [
      {
        chave: `assinaturas-${chaveMes(hoje)}`,
        tipo: 'ONDE',
        categoriaId: lancamentos[0].categoriaId ?? undefined,
        titulo: `${porServico.size} assinaturas ao mesmo tempo`,
        texto: `Juntas custam ${brl(total)} por mês. Cancelar uma economiza cerca de ${brl(media)}.`,
        impactoMensal: centavos(media),
      },
    ];
  }

  // Fatura fechando nos próximos 14 dias: comprar depois do fechamento dá mais prazo.
  private async melhorDiaDeCompra(hoje: Date): Promise<Ideia[]> {
    const faturas = await this.prisma.fatura.findMany({
      where: { paga: false, fechamento: { gte: inicioDoDia(hoje), lte: new Date(hoje.getTime() + 14 * DIA) } },
      include: { conta: { include: { conexao: true } } },
    });

    return faturas.map((f) => {
      const melhorDia = new Date(f.fechamento.getTime() + DIA);
      const venceDepois = new Date(f.vencimento);
      venceDepois.setUTCMonth(venceDepois.getUTCMonth() + 1);
      // aqui o ganho é prazo, não dinheiro: vai no texto
      const prazo = Math.round((venceDepois.getTime() - melhorDia.getTime()) / DIA);
      return {
        chave: `melhor-dia-${f.contaId}-${f.fechamento.toISOString().slice(0, 10)}`,
        tipo: 'QUANDO' as const,
        titulo: `Compra grande? Espere até ${ddmm(melhorDia)}`,
        texto:
          `A fatura do ${f.conta.conexao.banco} fecha em ${ddmm(f.fechamento)}. ` +
          `O que você comprar a partir do dia ${ddmm(melhorDia)} só vence em ${ddmm(venceDepois)}: ${prazo} dias para pagar, sem juros.`,
      };
    });
  }

  private async saidasPorCategoria(de: Date, ate: Date) {
    const linhas = await this.prisma.$queryRaw<{ categoriaId: string; nome: string; total: Prisma.Decimal }[]>`
      SELECT c.id AS "categoriaId", c.nome, SUM(l.valor) AS total
      FROM "Lancamento" l
      JOIN "Categoria" c ON c.id = l."categoriaId"
      WHERE l.sentido = 'SAIDA' AND c."ignorarNosTotais" = false
        AND l.data >= ${de} AND l.data < ${ate}
      GROUP BY c.id, c.nome`;
    return new Map(linhas.map((l) => [l.categoriaId, { nome: l.nome, total: l.total.toNumber() }]));
  }
}

const chaveMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const inicioDoDia = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

@Controller()
class SugestoesController {
  constructor(private readonly sugestoes: SugestoesService) {}

  @Get('sugestoes')
  novas() {
    return this.sugestoes.novas();
  }

  @Patch('sugestoes/:id')
  responder(@Param('id') id: string, @Body() dados: Responder) {
    return this.sugestoes.responder(id, dados.status);
  }

  @Post('limites')
  definirLimite(@Body() dados: NovoLimite) {
    return this.sugestoes.definirLimite(dados);
  }
}

@Module({
  controllers: [SugestoesController],
  providers: [SugestoesService],
  exports: [SugestoesService],
})
export class SugestoesModule {}
