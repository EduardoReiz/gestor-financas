import { CodigoInvalido, crc16, lerCodigo, vencimentoDoFator } from './codigos';

// Monta um Pix copia e cola de verdade: campos EMV + CRC no fim.
function montarPix(valor?: string) {
  const campo = (id: string, v: string) => id + String(v.length).padStart(2, '0') + v;
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', 'claro@exemplo.com.br');
  let corpo =
    campo('00', '01') +
    campo('26', conta) +
    campo('52', '0000') +
    campo('53', '986') +
    (valor ? campo('54', valor) : '') +
    campo('58', 'BR') +
    campo('59', 'CLARO S A') +
    campo('60', 'SAO PAULO') +
    campo('62', campo('05', 'FATURA102026')) +
    '6304';
  return corpo + crc16(corpo);
}

describe('lerCodigo', () => {
  it('calcula o CRC16 do Pix (CCITT-FALSE)', () => {
    expect(crc16('123456789')).toBe('29B1'); // vetor de teste clássico do CRC16-CCITT-FALSE
  });

  it('lê valor e recebedor do Pix', () => {
    const lido = lerCodigo(montarPix('129.90'));
    expect(lido).toMatchObject({ tipo: 'PIX', valor: 129.9, recebedor: 'CLARO S A', cidade: 'SAO PAULO' });
  });

  it('aceita Pix sem valor', () => {
    expect(lerCodigo(montarPix())).toMatchObject({ tipo: 'PIX', valor: null });
  });

  it('recusa Pix com um caractere a menos', () => {
    const pix = montarPix('129.90');
    expect(() => lerCodigo(pix.slice(0, 30) + pix.slice(31))).toThrow(CodigoInvalido);
  });

  it('lê valor do boleto bancário e confere os dígitos', () => {
    // exemplo de linha digitável da documentação do Banco do Brasil (R$ 1,00)
    const lido = lerCodigo('00190.50095 40144.816069 06809.350314 3 37370000000100');
    expect(lido).toMatchObject({ tipo: 'BOLETO', valor: 1, banco: '001' });
  });

  it('recusa linha digitável com número trocado', () => {
    expect(() => lerCodigo('00190.50095 40144.816069 06809.350314 3 37370000000200')).toThrow(CodigoInvalido);
    expect(() => lerCodigo('00190.50096 40144.816069 06809.350314 3 37370000000100')).toThrow(CodigoInvalido);
  });

  it('usa a nova base do fator de vencimento (22/02/2025 = 1000)', () => {
    expect(vencimentoDoFator(1000).toISOString().slice(0, 10)).toBe('2025-02-22');
    expect(vencimentoDoFator(1001).toISOString().slice(0, 10)).toBe('2025-02-23');
  });

  it('diz o que fazer quando não reconhece', () => {
    expect(() => lerCodigo('qualquer coisa')).toThrow(/Pix copia e cola/);
  });
});
