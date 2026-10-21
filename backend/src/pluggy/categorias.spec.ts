import {
  ABASTECIMENTO_DO_CARRO,
  ABASTECIMENTO_MAXIMO_DA_MOTO,
  COMBUSTIVEL_CARRO,
  COMBUSTIVEL_MOTO,
  TIPO_DO_LUGAR,
  combustivelNoPadrao,
  compraComCategoriaCerta,
  traduzirCategoria,
} from './categorias';

describe('traduzirCategoria', () => {
  it('escolhe a categoria mais específica: o prefixo maior ganha', () => {
    expect(traduzirCategoria('11020000', 'SAIDA')?.nome).toBe('Delivery');
    expect(traduzirCategoria('11010000', 'SAIDA')?.nome).toBe('Lanche');
    expect(traduzirCategoria('11030000', 'SAIDA')?.nome).toBe('Alimentação');
    expect(traduzirCategoria('18020000', 'SAIDA')?.nome).toBe('Farmácia');
    expect(traduzirCategoria('18010000', 'SAIDA')?.nome).toBe('Saúde');
  });

  it('não conta nos totais o dinheiro que só muda de lugar', () => {
    for (const id of ['05100000', '04000000', '03000000']) {
      expect(traduzirCategoria(id, 'SAIDA')).toMatchObject({
        ignorarNosTotais: true,
      });
    }
    expect(traduzirCategoria('05100000', 'SAIDA')?.nome).toBe(
      'Pagamento de fatura',
    );
    expect(traduzirCategoria('04000000', 'SAIDA')?.nome).toBe(
      'Entre contas suas',
    );
    expect(traduzirCategoria('03000000', 'SAIDA')?.nome).toBe(
      'Aplicação em investimento',
    );
  });

  it('transferência comum (05) conta nos totais', () => {
    const destino = traduzirCategoria('05000000', 'SAIDA');
    expect(destino?.nome).toBe('Transferências');
    expect(destino?.ignorarNosTotais).toBeUndefined();
  });

  it('devolve null (o app pergunta) quando não há categoria ou ela é desconhecida', () => {
    expect(traduzirCategoria(null, 'SAIDA')).toBeNull();
    expect(traduzirCategoria('99999999', 'SAIDA')).toBeNull();
  });

  describe('combustível', () => {
    it('até R$ 30 é moto, acima disso é carro', () => {
      expect(traduzirCategoria('19050001', 'SAIDA', 20)).toBe(COMBUSTIVEL_MOTO);
      expect(
        traduzirCategoria('19050001', 'SAIDA', ABASTECIMENTO_MAXIMO_DA_MOTO),
      ).toBe(COMBUSTIVEL_MOTO);
      expect(traduzirCategoria('19050001', 'SAIDA', 30.01)).toBe(
        COMBUSTIVEL_CARRO,
      );
      expect(
        traduzirCategoria('19050001', 'SAIDA', ABASTECIMENTO_DO_CARRO),
      ).toBe(COMBUSTIVEL_CARRO);
    });

    it('posto é posto, mesmo quando o Pluggy chama de outra coisa', () => {
      expect(traduzirCategoria('11010000', 'SAIDA', 100, 5541)).toBe(
        COMBUSTIVEL_CARRO,
      );
      expect(traduzirCategoria('08000000', 'SAIDA', 25, 5542)).toBe(
        COMBUSTIVEL_MOTO,
      );
    });

    it('o tipo de loja de posto só vale para saída', () => {
      expect(traduzirCategoria('01000000', 'ENTRADA', 100, 5541)?.nome).toBe(
        'Renda',
      );
    });
  });

  describe('entradas', () => {
    it('salário e rendas (01) viram Renda', () => {
      expect(traduzirCategoria('01010000', 'ENTRADA')?.nome).toBe('Renda');
    });

    it('estorno de fatura, entre contas e resgate de investimento não contam nos totais', () => {
      expect(traduzirCategoria('05100000', 'ENTRADA')).toMatchObject({
        nome: 'Pagamento de fatura',
        ignorarNosTotais: true,
      });
      expect(traduzirCategoria('04000000', 'ENTRADA')).toMatchObject({
        nome: 'Entre contas suas',
        ignorarNosTotais: true,
      });
      expect(traduzirCategoria('03000000', 'ENTRADA')).toMatchObject({
        nome: 'Aplicação em investimento',
        ignorarNosTotais: true,
      });
    });

    it('o resto (Pix recebido, reembolso...) é Outras entradas, inclusive sem categoria', () => {
      expect(traduzirCategoria('05000000', 'ENTRADA')?.nome).toBe(
        'Outras entradas',
      );
      expect(traduzirCategoria(null, 'ENTRADA')?.nome).toBe('Outras entradas');
    });
  });
});

describe('combustivelNoPadrao', () => {
  it('aceita a moto (até R$ 30) e o carro (R$ 120 exatos)', () => {
    expect(combustivelNoPadrao(10)).toBe(true);
    expect(combustivelNoPadrao(30)).toBe(true);
    expect(combustivelNoPadrao(120)).toBe(true);
    expect(combustivelNoPadrao(120.004)).toBe(true); // diferença menor que meio centavo
  });

  it('pergunta quando foge do padrão', () => {
    expect(combustivelNoPadrao(30.01)).toBe(false);
    expect(combustivelNoPadrao(50)).toBe(false);
    expect(combustivelNoPadrao(120.01)).toBe(false);
  });
});

describe('compraComCategoriaCerta', () => {
  it('é certa quando o tipo da loja confirma a categoria', () => {
    expect(compraComCategoriaCerta('Mercado', 5411)).toBe(true);
    expect(compraComCategoriaCerta('Farmácia', 5912)).toBe(true);
    expect(compraComCategoriaCerta('Lanche', 5812)).toBe(true);
    expect(compraComCategoriaCerta('Lanche', 5814)).toBe(true);
    expect(compraComCategoriaCerta('Assinaturas', 4899)).toBe(true);
  });

  it('não é certa quando a categoria não bate com a loja ou não há tipo de loja', () => {
    expect(compraComCategoriaCerta('Mercado', 5812)).toBe(false);
    expect(compraComCategoriaCerta('Mercado', 9999)).toBe(false);
    expect(compraComCategoriaCerta('Mercado', null)).toBe(false);
    expect(compraComCategoriaCerta('Mercado', undefined)).toBe(false);
  });
});

describe('TIPO_DO_LUGAR', () => {
  it('traduz o tipo da loja (MCC) para um nome legível', () => {
    expect(TIPO_DO_LUGAR[5411]).toBe('Supermercado');
    expect(TIPO_DO_LUGAR[5541]).toBe('Posto de combustível');
    expect(TIPO_DO_LUGAR[5542]).toBe('Posto de combustível');
  });
});
