import { Prisma } from '@prisma/client';
import { totalDaFatura } from './fatura';

const d = (v: string | number) => new Prisma.Decimal(v);

describe('totalDaFatura', () => {
  it('sem valor informado, vale a soma das compras que chegaram', () => {
    expect(totalDaFatura({ total: d('812.35'), totalInformado: null })).toBe(
      812.35,
    );
  });

  it('com valor informado maior ou igual, vale o informado (o app do banco)', () => {
    expect(
      totalDaFatura({ total: d('800'), totalInformado: d('850.10') }),
    ).toBe(850.1);
    expect(
      totalDaFatura({ total: d('850.10'), totalInformado: d('850.10') }),
    ).toBe(850.1);
  });

  it('se chegaram compras depois do valor informado, a soma passa e vale a soma', () => {
    expect(
      totalDaFatura({ total: d('900.40'), totalInformado: d('850.10') }),
    ).toBe(900.4);
  });

  it('valor informado zero não esconde as compras', () => {
    expect(totalDaFatura({ total: d('120'), totalInformado: d('0') })).toBe(
      120,
    );
  });

  it('fatura sem nada devolve zero', () => {
    expect(totalDaFatura({ total: d(0), totalInformado: null })).toBe(0);
  });
});
