import { Prisma } from '@prisma/client';

// O valor da fatura que vale: o que você informou (o app do banco) ou a soma
// das compras que chegaram, o que for maior. A soma passa do informado quando
// chegam compras feitas depois que você informou.
export function totalDaFatura(f: { total: Prisma.Decimal; totalInformado: Prisma.Decimal | null }) {
  const soma = f.total.toNumber();
  return f.totalInformado ? Math.max(f.totalInformado.toNumber(), soma) : soma;
}
