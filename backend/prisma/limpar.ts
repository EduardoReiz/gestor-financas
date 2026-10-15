// Apaga TODOS os dados financeiros (os de exemplo e o que foi criado em cima
// deles: metas, contas fixas, limites, regras). Mantém os aparelhos e sessões.
//
//   npm run db:limpar -- --sim
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  if (!process.argv.includes('--sim')) {
    console.log('Isto apaga todos os dados financeiros. Rode de novo com --sim para confirmar.');
    return;
  }
  await prisma.$transaction([
    prisma.sugestao.deleteMany(),
    prisma.contaAPagar.deleteMany(),
    prisma.contaFixa.deleteMany(),
    prisma.lancamento.deleteMany(),
    prisma.regraCategoria.deleteMany(),
    prisma.limite.deleteMany(),
    prisma.fatura.deleteMany(),
    prisma.conta.deleteMany(),
    prisma.historicoInvestimento.deleteMany(),
    prisma.investimento.deleteMany(),
    prisma.conexao.deleteMany(),
    prisma.categoria.deleteMany(),
    prisma.aporte.deleteMany(),
    prisma.meta.deleteMany(),
    prisma.sincronizacao.deleteMany(),
  ]);
  console.log('Dados financeiros apagados. Aparelhos mantidos.');
}

main().finally(() => prisma.$disconnect());
