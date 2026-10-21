import { BadRequestException } from '@nestjs/common';
import { intervaloDoMes, mesesAntes } from './mes';

describe('intervaloDoMes', () => {
  it('"2026-10" vai do dia 1º de outubro (incluso) ao dia 1º de novembro (excluso)', () => {
    const { inicio, fim } = intervaloDoMes('2026-10');
    expect(inicio).toEqual(new Date(2026, 9, 1));
    expect(fim).toEqual(new Date(2026, 10, 1));
  });

  it('dezembro termina em janeiro do ano seguinte', () => {
    const { inicio, fim } = intervaloDoMes('2026-12');
    expect(inicio).toEqual(new Date(2026, 11, 1));
    expect(fim).toEqual(new Date(2027, 0, 1));
  });

  it('fevereiro de ano bissexto e não bissexto fecham no dia 1º de março', () => {
    expect(intervaloDoMes('2028-02').fim).toEqual(new Date(2028, 2, 1));
    expect(intervaloDoMes('2026-02').fim).toEqual(new Date(2026, 2, 1));
  });

  it.each([
    '2026-13',
    '2026-00',
    '2026-1',
    '26-10',
    'outubro',
    '2026/10',
    ' 2026-10',
  ])('recusa "%s"', (mes) => {
    expect(() => intervaloDoMes(mes)).toThrow(BadRequestException);
  });

  describe('sem parâmetro', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
    });
    afterEach(() => jest.useRealTimers());

    it('usa o mês atual', () => {
      const { inicio, fim } = intervaloDoMes();
      expect(inicio).toEqual(new Date(2026, 5, 1));
      expect(fim).toEqual(new Date(2026, 6, 1));
    });
  });
});

describe('mesesAntes', () => {
  it('volta N meses a partir do início do intervalo', () => {
    const intervalo = intervaloDoMes('2026-03');
    expect(mesesAntes(intervalo, 0)).toEqual(new Date(2026, 2, 1));
    expect(mesesAntes(intervalo, 1)).toEqual(new Date(2026, 1, 1));
    expect(mesesAntes(intervalo, 3)).toEqual(new Date(2025, 11, 1)); // atravessa o ano
  });

  it('não altera o intervalo original', () => {
    const intervalo = intervaloDoMes('2026-03');
    mesesAntes(intervalo, 5);
    expect(intervalo.inicio).toEqual(new Date(2026, 2, 1));
  });
});
