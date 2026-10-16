import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';

@Injectable()
class CartoesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar() {
    const cartoes = await this.prisma.conta.findMany({
      where: { tipo: 'CARTAO_CREDITO' },
      include: {
        conexao: true,
        faturas: {
          where: { paga: false },
          orderBy: { vencimento: 'asc' },
          take: 1,
          include: { lancamentos: { include: { categoria: true } } },
        },
      },
    });

    return cartoes.map((c) => {
      const fatura = c.faturas[0];
      const total = fatura?.total.toNumber() ?? 0;
      const limite = c.limite?.toNumber() ?? null;

      const porCategoria = new Map<string, number>();
      for (const l of fatura?.lancamentos ?? []) {
        const nome = l.parcelasTotal ? 'Parcelas' : (l.categoria?.nome ?? 'Sem categoria');
        porCategoria.set(nome, (porCategoria.get(nome) ?? 0) + l.valor.toNumber());
      }

      return {
        id: c.id,
        banco: c.conexao.banco,
        final: c.numeroFinal,
        limite,
        usoDoLimite: limite ? total / limite : null,
        // o que o banco diz: inclui parcelas futuras e compras que ainda não chegaram aqui
        usadoNoBanco: c.usado?.toNumber() ?? null,
        disponivel: c.limiteDisponivel?.toNumber() ?? null,
        fatura: fatura && {
          id: fatura.id,
          total,
          fechamento: fatura.fechamento,
          vencimento: fatura.vencimento,
          // comprar no dia seguinte ao fechamento joga a compra para a próxima fatura
          melhorDiaDeCompra: diaSeguinte(fatura.fechamento),
        },
        porCategoria: [...porCategoria]
          .map(([categoria, valor]) => ({ categoria, valor: Math.round(valor * 100) / 100 }))
          .sort((a, b) => b.valor - a.valor),
        parcelamentos: (fatura?.lancamentos ?? [])
          .filter((l) => l.parcelasTotal)
          .map((l) => ({
            descricao: l.apelido ?? l.descricao,
            parcelaAtual: l.parcelaAtual,
            parcelasTotal: l.parcelasTotal,
            valor: l.valor.toNumber(),
          })),
      };
    });
  }
}

function diaSeguinte(d: Date) {
  const proximo = new Date(d);
  proximo.setUTCDate(proximo.getUTCDate() + 1);
  return proximo;
}

@Controller('cartoes')
class CartoesController {
  constructor(private readonly cartoes: CartoesService) {}

  @Get()
  listar() {
    return this.cartoes.listar();
  }
}

@Module({
  controllers: [CartoesController],
  providers: [CartoesService],
})
export class CartoesModule {}
