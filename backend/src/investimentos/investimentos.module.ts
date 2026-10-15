import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { intervaloDoMes } from '../comum/mes';

// Nomes amigáveis para os tipos que o Pluggy usa.
const TIPOS: Record<string, string> = {
  TREASURE: 'Tesouro Direto',
  FIXED_INCOME: 'Renda fixa',
  MUTUAL_FUND: 'Fundo',
  EQUITY: 'Ações',
  SECURITY: 'Previdência',
  ETF: 'ETF',
  COE: 'COE',
};

@Injectable()
class InvestimentosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar() {
    const { inicio } = intervaloDoMes();
    const investimentos = await this.prisma.investimento.findMany({
      include: {
        conexao: { select: { banco: true } },
        // a última foto do saldo antes do mês começar
        historico: { where: { data: { lt: inicio } }, orderBy: { data: 'desc' }, take: 1 },
      },
      orderBy: { saldo: 'desc' },
    });

    const total = investimentos.reduce((s, i) => s.plus(i.saldo), new Prisma.Decimal(0));
    const itens = investimentos.map((i) => {
      const antes = i.historico[0]?.saldo ?? i.saldo;
      return {
        id: i.id,
        nome: i.nome,
        banco: i.conexao.banco,
        tipo: TIPOS[i.tipo] ?? i.tipo,
        saldo: i.saldo.toNumber(),
        rendeuNoMes: i.saldo.minus(antes).toNumber(),
        // rendimento do mês em % do saldo de antes
        taxaNoMes: antes.isZero() ? 0 : i.saldo.minus(antes).div(antes).toNumber(),
        fracao: total.isZero() ? 0 : i.saldo.div(total).toNumber(),
        vencimento: i.vencimento,
      };
    });

    return {
      total: total.toNumber(),
      rendeuNoMes: itens.reduce((s, i) => s.plus(i.rendeuNoMes), new Prisma.Decimal(0)).toNumber(),
      itens,
      dica: dicaDeRendimento(itens),
    };
  }
}

// Se um investimento rendeu bem menos que o melhor, quanto ganharia trocando.
function dicaDeRendimento(itens: { nome: string; saldo: number; taxaNoMes: number }[]) {
  if (itens.length < 2) return null;
  const melhor = itens.reduce((a, b) => (b.taxaNoMes > a.taxaNoMes ? b : a));
  const pior = itens.reduce((a, b) => (b.taxaNoMes < a.taxaNoMes ? b : a));
  const ganho = pior.saldo * (melhor.taxaNoMes - pior.taxaNoMes);
  if (pior === melhor || ganho < 1) return null;
  return {
    texto: `${pior.nome} rendeu menos que ${melhor.nome} este mês. Mover os ${brl(pior.saldo)} renderia cerca de ${brl(ganho)} a mais por mês.`,
  };
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

@Controller('investimentos')
class InvestimentosController {
  constructor(private readonly investimentos: InvestimentosService) {}

  @Get()
  listar() {
    return this.investimentos.listar();
  }
}

@Module({
  controllers: [InvestimentosController],
  providers: [InvestimentosService],
})
export class InvestimentosModule {}
