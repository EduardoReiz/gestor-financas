// Contas da "Sobra do mês": função pura, sem banco, para testar a regra.
//
// A conta é de um mês por vez e não usa média nem suposição de gasto:
// renda total, menos as contas fixas, menos a fatura do cartão do mês.

export const centavos = (v: number) => Math.round(v * 100) / 100;

// Quanto sobra no mês: toda a renda, menos as contas fixas e menos a fatura
// do cartão que vence no mês (o valor real, não uma projeção).
export function sobraDoMes(m: { receitas: number; contas: number; faturas: number }) {
  return centavos(m.receitas - m.contas - m.faturas);
}
