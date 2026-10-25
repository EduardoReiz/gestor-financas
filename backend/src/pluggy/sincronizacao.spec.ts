// o agendador (@nestjs/schedule) é ESM e não é necessário para testar as funções puras
jest.mock('@nestjs/schedule', () => ({ Cron: () => () => undefined }));

import {
  cicloAberto,
  inicioDaSemana,
  itensConfigurados,
  terminouDeAtualizar,
} from './sincronizacao.service';

const dia = (d: Date) => d.toISOString().slice(0, 10);
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('cicloAberto', () => {
  it('antes do fechamento, a fatura aberta é a do mês', () => {
    const c = cicloAberto(utc('2026-10-10'), 20, 13);
    expect(dia(c.fechamento)).toBe('2026-10-13');
    expect(dia(c.vencimento)).toBe('2026-10-20');
  });

  it('depois do fechamento, a aberta passa a ser a do mês seguinte', () => {
    const c = cicloAberto(utc('2026-10-15'), 20, 13);
    expect(dia(c.fechamento)).toBe('2026-11-13');
    expect(dia(c.vencimento)).toBe('2026-11-20');
  });

  it('no dia do fechamento (à meia-noite) ainda é a mesma fatura', () => {
    const c = cicloAberto(utc('2026-10-13'), 20, 13);
    expect(dia(c.fechamento)).toBe('2026-10-13');
  });

  it('fechamento depois do dia do vencimento: a fatura fecha no mês anterior ao vencimento', () => {
    // fecha dia 28 e vence dia 5 do mês seguinte
    const c = cicloAberto(utc('2026-10-10'), 5, 28);
    expect(dia(c.fechamento)).toBe('2026-10-28');
    expect(dia(c.vencimento)).toBe('2026-11-05');
  });

  it('sem dia de fechamento, considera 7 dias antes do vencimento', () => {
    const c = cicloAberto(utc('2026-10-10'), 20, null);
    expect(dia(c.fechamento)).toBe('2026-10-13');
    expect(dia(c.vencimento)).toBe('2026-10-20');
  });

  it('vencimento dia 31 em mês curto cai no último dia do mês', () => {
    const c = cicloAberto(utc('2026-02-01'), 31, null);
    expect(dia(c.vencimento)).toBe('2026-02-28');
    expect(dia(c.fechamento)).toBe('2026-02-21');
  });

  it('atravessa a virada do ano', () => {
    const c = cicloAberto(utc('2026-12-20'), 10, 3);
    expect(dia(c.fechamento)).toBe('2027-01-03');
    expect(dia(c.vencimento)).toBe('2027-01-10');
  });
});

describe('inicioDaSemana', () => {
  it('devolve a segunda-feira da semana (meia-noite UTC)', () => {
    // quarta-feira, 21/10/2026, meio-dia em Brasília
    expect(dia(inicioDaSemana(new Date('2026-10-21T15:00:00Z')))).toBe(
      '2026-10-19',
    );
    // a própria segunda-feira
    expect(dia(inicioDaSemana(new Date('2026-10-19T15:00:00Z')))).toBe(
      '2026-10-19',
    );
  });

  it('domingo pertence à semana que começou na segunda anterior', () => {
    expect(dia(inicioDaSemana(new Date('2026-10-25T15:00:00Z')))).toBe(
      '2026-10-19',
    );
  });

  it('usa o fuso de Brasília: 23h de domingo em Brasília ainda é domingo, mesmo já sendo segunda em UTC', () => {
    // 19/10/2026 02:00 UTC = 18/10/2026 (domingo) 23:00 em Brasília
    expect(dia(inicioDaSemana(new Date('2026-10-19T02:00:00Z')))).toBe(
      '2026-10-12',
    );
  });
});

describe('itensConfigurados', () => {
  const original = process.env.PLUGGY_ITENS;
  afterEach(() => {
    if (original === undefined) delete process.env.PLUGGY_ITENS;
    else process.env.PLUGGY_ITENS = original;
  });

  it('lê "id:Banco" separados por vírgula, ignorando espaços', () => {
    process.env.PLUGGY_ITENS = 'abc:Itaú, def : Bradesco ,';
    expect(itensConfigurados()).toEqual([
      { id: 'abc', banco: 'Itaú' },
      { id: 'def', banco: 'Bradesco' },
    ]);
  });

  it('sem nome do banco usa "Banco", e nome com dois-pontos é preservado', () => {
    process.env.PLUGGY_ITENS = 'x1,y2:Banco: do Brasil';
    expect(itensConfigurados()).toEqual([
      { id: 'x1', banco: 'Banco' },
      { id: 'y2', banco: 'Banco: do Brasil' },
    ]);
  });

  it('sem variável de ambiente devolve lista vazia', () => {
    delete process.env.PLUGGY_ITENS;
    expect(itensConfigurados()).toEqual([]);
  });
});

describe('terminouDeAtualizar', () => {
  it('enquanto o Pluggy diz UPDATING, não terminou', () => {
    expect(terminouDeAtualizar({ status: 'UPDATING', lastUpdatedAt: '2026-10-25T10:00:00Z' }, '2026-10-25T09:00:00Z', 60_000)).toBe(false);
  });
  it('UPDATED com data nova: terminou', () => {
    expect(terminouDeAtualizar({ status: 'UPDATED', lastUpdatedAt: '2026-10-25T11:00:00Z' }, '2026-10-25T09:00:00Z', 8_000)).toBe(true);
  });
  it('UPDATED com a mesma data logo após o pedido: ainda não, pode ser o estado antigo', () => {
    expect(terminouDeAtualizar({ status: 'UPDATED', lastUpdatedAt: '2026-10-25T09:00:00Z' }, '2026-10-25T09:00:00Z', 5_000)).toBe(false);
  });
  it('UPDATED com a mesma data depois de 20 segundos: terminou (o banco não tinha nada novo)', () => {
    expect(terminouDeAtualizar({ status: 'UPDATED', lastUpdatedAt: '2026-10-25T09:00:00Z' }, '2026-10-25T09:00:00Z', 25_000)).toBe(true);
  });
  it('erro de login ou senha pedida: termina, mas não como atualizado', () => {
    expect(terminouDeAtualizar({ status: 'LOGIN_ERROR', lastUpdatedAt: null }, null, 1_000)).toBe(true);
  });
});
