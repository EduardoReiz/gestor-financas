import { Body, Controller, Get, HttpCode, Injectable, Module, NotFoundException, Param, Patch } from '@nestjs/common';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.module';
import { totalDaFatura } from '../comum/fatura';

class ValorDaFatura {
  // vazio (null) apaga o valor informado e volta a valer a soma das compras
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(1_000_000) total!: number | null;
}

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
      const total = fatura ? totalDaFatura(fatura) : 0;
      const somaDasCompras = fatura?.total.toNumber() ?? 0;
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
          somaDasCompras,
          informado: fatura.totalInformado?.toNumber() ?? null,
          informadoEm: fatura.informadoEm,
          // o que o banco cobra e não detalhou ao app (compras que não chegaram)
          naoDetalhado: Math.round((total - somaDasCompras) * 100) / 100,
          fechamento: fatura.fechamento,
          vencimento: fatura.vencimento,
          // comprar no dia seguinte ao fechamento joga a compra para a próxima fatura
          melhorDiaDeCompra: diaSeguinte(fatura.fechamento),
        },
        porCategoria: [
          ...porCategoria,
          ...(fatura && total > somaDasCompras ? ([['Compras que o banco não mandou', total - somaDasCompras]] as const) : []),
        ]
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

  async informarValor(faturaId: string, total: number | null) {
    const fatura = await this.prisma.fatura.findUnique({ where: { id: faturaId }, select: { id: true } });
    if (!fatura) throw new NotFoundException('fatura não encontrada');
    await this.prisma.fatura.update({
      where: { id: faturaId },
      data: { totalInformado: total, informadoEm: total === null ? null : new Date() },
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

  @Patch('faturas/:id/valor')
  @HttpCode(204)
  informarValor(@Param('id') id: string, @Body() dados: ValorDaFatura) {
    return this.cartoes.informarValor(id, dados.total ?? null);
  }
}

@Module({
  controllers: [CartoesController],
  providers: [CartoesService],
})
export class CartoesModule {}
