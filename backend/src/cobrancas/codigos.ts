// Lê o que dá para tirar de um código de pagamento, sem chamar banco nenhum:
//  - Pix copia e cola (BR Code / EMV): valor, recebedor, cidade.
//  - Boleto bancário (47 dígitos na linha digitável, 44 no código de barras):
//    valor e vencimento.
//  - Conta de consumo / concessionária (48 dígitos, começa com 8): valor.

export type CodigoLido =
  | { tipo: 'PIX'; codigo: string; valor: number | null; recebedor: string | null; cidade: string | null }
  | { tipo: 'BOLETO'; codigo: string; valor: number | null; vencimento: Date | null; banco: string | null }
  | { tipo: 'CONCESSIONARIA'; codigo: string; valor: number | null };

export class CodigoInvalido extends Error {}

export function lerCodigo(texto: string): CodigoLido {
  const limpo = texto.trim();
  if (/^000201/.test(limpo)) return lerPix(limpo);

  const digitos = limpo.replace(/\D/g, '');
  if (digitos.length === 48 && digitos.startsWith('8')) return lerConcessionaria(digitos);
  if (digitos.length === 47) return lerBoleto(digitos);
  if (digitos.length === 44) return digitos.startsWith('8') ? lerConcessionariaBarras(digitos, digitos) : lerBoletoBarras(digitos, digitos);

  throw new CodigoInvalido('Não reconheci o código. Cole o Pix copia e cola ou a linha digitável do boleto.');
}

// ---------- Pix ----------

// O BR Code é uma sequência de campos "ID(2) + tamanho(2) + valor".
function campos(texto: string) {
  const mapa = new Map<string, string>();
  for (let i = 0; i + 4 <= texto.length; ) {
    const id = texto.slice(i, i + 2);
    const tamanho = Number(texto.slice(i + 2, i + 4));
    if (Number.isNaN(tamanho)) throw new CodigoInvalido('Código Pix com formato inválido.');
    mapa.set(id, texto.slice(i + 4, i + 4 + tamanho));
    i += 4 + tamanho;
  }
  return mapa;
}

function lerPix(codigo: string): CodigoLido {
  // os últimos 4 caracteres são o CRC de tudo o que vem antes (incluindo "6304")
  const corpo = codigo.slice(0, -4);
  const crc = codigo.slice(-4).toUpperCase();
  if (!corpo.endsWith('6304') || crc16(corpo) !== crc) {
    throw new CodigoInvalido('O código Pix não confere (faltou ou sobrou algum caractere ao copiar).');
  }

  const c = campos(codigo);
  const valor = c.get('54');
  return {
    tipo: 'PIX',
    codigo,
    valor: valor ? Number(valor) : null, // Pix sem valor: você digita no banco
    recebedor: c.get('59')?.trim() || null,
    cidade: c.get('60')?.trim() || null,
  };
}

// CRC16-CCITT (polinômio 0x1021, início 0xFFFF), o que o Banco Central usa no Pix.
export function crc16(texto: string) {
  let crc = 0xffff;
  for (const byte of Buffer.from(texto, 'utf8')) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// ---------- Boleto bancário ----------

// Linha digitável (47) -> código de barras (44), conferindo os dígitos de cada campo.
function lerBoleto(linha: string): CodigoLido {
  const campo1 = linha.slice(0, 10);
  const campo2 = linha.slice(10, 21);
  const campo3 = linha.slice(21, 32);
  for (const campo of [campo1, campo2, campo3]) {
    if (modulo10(campo.slice(0, -1)) !== Number(campo.slice(-1))) {
      throw new CodigoInvalido('A linha digitável não confere (algum número foi digitado errado).');
    }
  }
  const barras = linha.slice(0, 4) + linha.slice(32, 47) + linha.slice(4, 9) + linha.slice(10, 20) + linha.slice(21, 31);
  return lerBoletoBarras(barras, linha);
}

function lerBoletoBarras(barras: string, codigo: string): CodigoLido {
  const semDv = barras.slice(0, 4) + barras.slice(5);
  if (modulo11Boleto(semDv) !== Number(barras[4])) {
    throw new CodigoInvalido('O código do boleto não confere (dígito verificador errado).');
  }
  const fator = Number(barras.slice(5, 9));
  const valor = Number(barras.slice(9, 19)) / 100;
  return {
    tipo: 'BOLETO',
    codigo,
    valor: valor > 0 ? valor : null,
    vencimento: fator > 0 ? vencimentoDoFator(fator) : null,
    banco: barras.slice(0, 3),
  };
}

// O fator conta dias desde 07/10/1997. Em 22/02/2025 chegou a 9999 e
// recomeçou em 1000, então hoje todo fator vale a partir dessa nova base.
export function vencimentoDoFator(fator: number) {
  const base = Date.UTC(2025, 1, 22); // 22/02/2025 = 1000
  return new Date(base + (fator - 1000) * 86_400_000);
}

function modulo10(numero: string) {
  let soma = 0;
  let peso = 2;
  for (let i = numero.length - 1; i >= 0; i--) {
    let parcial = Number(numero[i]) * peso;
    if (parcial > 9) parcial = Math.floor(parcial / 10) + (parcial % 10);
    soma += parcial;
    peso = peso === 2 ? 1 : 2;
  }
  return (10 - (soma % 10)) % 10;
}

function modulo11Boleto(numero: string) {
  let soma = 0;
  let peso = 2;
  for (let i = numero.length - 1; i >= 0; i--) {
    soma += Number(numero[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = 11 - (soma % 11);
  return resto === 0 || resto === 10 || resto === 11 ? 1 : resto;
}

// ---------- Contas de consumo (água, luz, telefone...) ----------

// 48 dígitos = 4 blocos de 11 + 1 dígito verificador cada.
function lerConcessionaria(linha: string): CodigoLido {
  const blocos = [0, 1, 2, 3].map((i) => linha.slice(i * 12, i * 12 + 12));
  const usaModulo10 = ['6', '7'].includes(linha[2]);
  for (const bloco of blocos) {
    const dv = usaModulo10 ? modulo10(bloco.slice(0, 11)) : modulo11Concessionaria(bloco.slice(0, 11));
    if (dv !== Number(bloco[11])) {
      throw new CodigoInvalido('O código da conta não confere (algum número foi digitado errado).');
    }
  }
  return lerConcessionariaBarras(blocos.map((b) => b.slice(0, 11)).join(''), linha);
}

function lerConcessionariaBarras(barras: string, codigo: string): CodigoLido {
  // o 3º dígito diz se o campo de valor é dinheiro (6 ou 7) ou outra unidade
  const valorEmReais = ['6', '7'].includes(barras[2]);
  const valor = Number(barras.slice(4, 15)) / 100;
  return { tipo: 'CONCESSIONARIA', codigo, valor: valorEmReais && valor > 0 ? valor : null };
}

function modulo11Concessionaria(numero: string) {
  let soma = 0;
  let peso = 2;
  for (let i = numero.length - 1; i >= 0; i--) {
    soma += Number(numero[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto === 0 || resto === 1 ? 0 : resto === 10 ? 1 : 11 - resto;
}
