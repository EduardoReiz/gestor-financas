import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { intervaloDoMes } from '../comum/mes';
import { FiltroLancamentos, TrocarCategoria } from './lancamentos.dto';

@Injectable()
export class LancamentosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtro: FiltroLancamentos) {
    const intervalo = intervaloDoMes(filtro.mes);
    const where: Prisma.LancamentoWhereInput = {
      data: { gte: intervalo.inicio, lt: intervalo.fim },
      contaId: filtro.contaId,
      sentido: filtro.sentido,
      ...(filtro.categoriaId === 'nenhuma' ? { categoriaId: null } : { categoriaId: filtro.categoriaId }),
      ...(filtro.busca && {
        OR: [
          { descricao: { contains: filtro.busca, mode: 'insensitive' } },
          { apelido: { contains: filtro.busca, mode: 'insensitive' } },
        ],
      }),
    };

    const lancamentos = await this.prisma.lancamento.findMany({
      where,
      include: { conta: { include: { conexao: true } }, categoria: true },
      orderBy: { data: 'desc' },
    });

    return lancamentos.map((l) => ({
      id: l.id,
      data: l.data,
      descricao: l.apelido ?? l.descricao,
      descricaoOriginal: l.descricao,
      valor: l.valor.toNumber(),
      sentido: l.sentido,
      categoria: l.categoria && { id: l.categoria.id, nome: l.categoria.nome, foraDosTotais: l.categoria.ignorarNosTotais },
      origemCategoria: l.origemCategoria,
      categoriaConfirmada: l.categoriaConfirmada,
      conta: {
        id: l.conta.id,
        banco: l.conta.conexao.banco,
        tipo: l.conta.tipo,
      },
      parcela: l.parcelasTotal ? `${l.parcelaAtual} de ${l.parcelasTotal}` : null,
    }));
  }

  async confirmarCategoria(id: string) {
    await this.existe(id);
    await this.prisma.lancamento.update({ where: { id }, data: { categoriaConfirmada: true } });
  }

  // Corrige a categoria. Com "aplicar aos próximos", vira uma regra que também
  // arruma, de uma vez, os lançamentos parecidos que você ainda não confirmou.
  async trocarCategoria(id: string, dados: TrocarCategoria) {
    await this.existe(id);
    if (dados.aplicarAosProximos && !dados.contem?.trim()) {
      throw new BadRequestException('informe o trecho da descrição para a regra (contem)');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.lancamento.update({
        where: { id },
        data: {
          categoriaId: dados.categoriaId,
          origemCategoria: 'MANUAL',
          categoriaConfirmada: true,
          apelido: dados.apelido?.trim() || undefined,
        },
      });

      if (!dados.aplicarAosProximos) return { ajustados: 1 };

      const contem = dados.contem!.trim();
      // a regra nova substitui a antiga do mesmo lugar (senão as duas brigam)
      await tx.regraCategoria.deleteMany({ where: { contem: { equals: contem, mode: 'insensitive' } } });
      await tx.regraCategoria.create({ data: { contem, categoriaId: dados.categoriaId } });
      // vale para tudo desse lugar, passado e futuro, menos o que você
      // escolheu na mão e os pagamentos de contas fixas
      const { count } = await tx.lancamento.updateMany({
        where: {
          id: { not: id },
          descricao: { contains: contem, mode: 'insensitive' },
          OR: [{ origemCategoria: null }, { origemCategoria: { in: ['PLUGGY', 'REGRA'] } }],
        },
        data: { categoriaId: dados.categoriaId, origemCategoria: 'REGRA', categoriaConfirmada: true },
      });
      return { ajustados: count + 1 };
    });
  }

  categorias() {
    return this.prisma.categoria.findMany({
      select: { id: true, nome: true, sentido: true, cor: true },
      orderBy: { nome: 'asc' },
    });
  }

  private async existe(id: string) {
    const achado = await this.prisma.lancamento.findUnique({ where: { id }, select: { id: true } });
    if (!achado) throw new NotFoundException('lançamento não encontrado');
  }
}
