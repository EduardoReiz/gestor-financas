import { sobraDoMes, centavos } from './sobra';

describe('sobraDoMes', () => {
  it('é a renda menos as contas fixas menos as faturas dos cartões', () => {
    expect(sobraDoMes({ receitas: 5200, contas: 1240, faturas: 1684.2 })).toBe(2275.8);
  });

  it('arredonda em centavos (sem sobras de ponto flutuante)', () => {
    expect(sobraDoMes({ receitas: 0.3, contas: 0.1, faturas: 0.1 })).toBe(0.1);
  });

  it('pode ficar negativa quando o mês fecha no vermelho', () => {
    expect(sobraDoMes({ receitas: 1000, contas: 800, faturas: 450.5 })).toBe(-250.5);
  });
});

describe('centavos', () => {
  it('mantém duas casas', () => {
    expect(centavos(10.005)).toBe(10.01);
    expect(centavos(2.5)).toBe(2.5);
  });
});
