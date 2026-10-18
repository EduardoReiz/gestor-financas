import { Sentido } from '@prisma/client';

// Tradução das categorias do Pluggy para as do app.
// A chave é o começo do id do Pluggy: o mais específico ganha
// ("05100000" antes de "05", "1102" antes de "11").
interface Destino {
  nome: string;
  cor: string;
  ignorarNosTotais?: boolean;
}

const MAPA: Record<string, Destino> = {
  // dinheiro que só muda de lugar: contar entraria em dobro
  '05100000': { nome: 'Pagamento de fatura', cor: '#C9D2CE', ignorarNosTotais: true },
  '04': { nome: 'Entre contas suas', cor: '#C9D2CE', ignorarNosTotais: true },
  '03': { nome: 'Aplicação em investimento', cor: '#C9D2CE', ignorarNosTotais: true },

  '19050001': { nome: 'Combustível', cor: '#3D7EA6' },
  '19050005': { nome: 'Manutenção do veículo', cor: '#4F6D8A' },
  '19050004': { nome: 'Taxas e multas do veículo', cor: '#8A5B5B' },
  '19050006': { nome: 'Taxas e multas do veículo', cor: '#8A5B5B' },
  '1102': { nome: 'Delivery', cor: '#B86E00' },
  '1101': { nome: 'Lanche', cor: '#C98A2E' }, // restaurantes, bares e lanchonetes
  '11': { nome: 'Alimentação', cor: '#C98A2E' },
  '10': { nome: 'Mercado', cor: '#2E8B5E' },
  '09': { nome: 'Assinaturas', cor: '#A64D79' },
  '17': { nome: 'Moradia e contas', cor: '#1F6F4A' },
  '19': { nome: 'Transporte', cor: '#3D7EA6' },
  '21': { nome: 'Lazer', cor: '#7A5BA6' },
  '18020000': { nome: 'Farmácia', cor: '#4F8F8A' },
  '18': { nome: 'Saúde', cor: '#4F8F8A' },
  '08': { nome: 'Compras', cor: '#5B6B64' },
  '07': { nome: 'Serviços', cor: '#6B7F8A' },
  '12': { nome: 'Viagens', cor: '#3D7EA6' },
  '16': { nome: 'Taxas bancárias', cor: '#8A5B5B' },
  '15': { nome: 'Impostos', cor: '#8A5B5B' },
  '20': { nome: 'Seguros', cor: '#6B7F8A' },
  '06': { nome: 'Obrigações legais', cor: '#6B7F8A' },
  '02': { nome: 'Empréstimos', cor: '#8A5B5B' },
  '13': { nome: 'Doações', cor: '#7A5BA6' },
  '14': { nome: 'Apostas', cor: '#8A5B5B' },
  '05': { nome: 'Transferências', cor: '#8A9690' },
};

const RENDA: Destino = { nome: 'Renda', cor: '#1F6F4A' };
const OUTRAS_ENTRADAS: Destino = { nome: 'Outras entradas', cor: '#7FD1A6' };

// O banco não sabe se o abastecimento foi do carro ou da moto (o posto é o
// mesmo). O padrão da casa: a moto abastece até R$ 30 e o carro, R$ 120.
export const ABASTECIMENTO_MAXIMO_DA_MOTO = 30;
export const ABASTECIMENTO_DO_CARRO = 120;
export const COMBUSTIVEL_CARRO: Destino = { nome: 'Combustível carro', cor: '#3D7EA6' };
export const COMBUSTIVEL_MOTO: Destino = { nome: 'Combustível moto', cor: '#6FA8C8' };

// O cartão manda o tipo da loja (MCC, padrão das bandeiras). Serve para
// mostrar "onde" foi a compra e para saber quando a categoria é certa.
export const TIPO_DO_LUGAR: Record<number, string> = {
  4111: 'Transporte',
  4121: 'Táxi ou app de corrida',
  4722: 'Agência de viagem ou ingressos',
  4814: 'Telefonia',
  4899: 'TV e streaming',
  5045: 'Informática',
  5065: 'Eletrônicos',
  5099: 'Loja (diversos)',
  5199: 'Loja (diversos)',
  5200: 'Material de construção',
  5251: 'Ferragens',
  5311: 'Loja de departamento',
  5331: 'Variedades',
  5399: 'Loja (diversos)',
  5411: 'Supermercado',
  5422: 'Açougue',
  5441: 'Doceria',
  5451: 'Laticínios',
  5462: 'Padaria',
  5499: 'Mercearia ou conveniência',
  5533: 'Autopeças',
  5541: 'Posto de combustível',
  5542: 'Posto de combustível',
  5651: 'Roupas',
  5655: 'Artigos esportivos',
  5661: 'Calçados',
  5691: 'Roupas',
  5699: 'Roupas e acessórios',
  5712: 'Móveis',
  5732: 'Eletrônicos',
  5734: 'Software',
  5735: 'Música',
  5812: 'Restaurante',
  5813: 'Bar',
  5814: 'Lanchonete',
  5815: 'Conteúdo digital',
  5816: 'Jogos digitais',
  5817: 'Aplicativos',
  5818: 'Conteúdo digital',
  5912: 'Farmácia',
  5942: 'Livraria',
  5945: 'Brinquedos e jogos',
  5977: 'Cosméticos',
  5992: 'Floricultura',
  5995: 'Pet shop',
  5999: 'Loja (diversos)',
  7011: 'Hotel',
  7230: 'Salão ou barbearia',
  7298: 'Estética',
  7311: 'Publicidade',
  7372: 'Serviço de internet',
  7523: 'Estacionamento',
  7538: 'Oficina mecânica',
  7542: 'Lava-jato',
  7832: 'Cinema',
  7922: 'Shows e teatro',
  7941: 'Esportes',
  7997: 'Academia ou clube',
  8011: 'Médico',
  8021: 'Dentista',
  8062: 'Hospital',
  8099: 'Saúde',
  8220: 'Faculdade',
  8299: 'Cursos e serviços',
};

// Tipos de loja em que a categoria não tem dúvida. Fora destes, a categoria
// do Pluggy é um chute e o app pergunta.
const CATEGORIA_CERTA_PELO_LUGAR: Record<number, string> = {
  5411: 'Mercado',
  5912: 'Farmácia',
  5812: 'Lanche',
  5814: 'Lanche',
  4899: 'Assinaturas',
};
const POSTO = new Set([5541, 5542]);

// Devolve a categoria do app (ou null: "sem categoria", o app pergunta).
export function traduzirCategoria(pluggyId: string | null, sentido: Sentido, valor = 0, mcc?: number | null): Destino | null {
  // posto é posto, mesmo quando o Pluggy chama de outra coisa
  if (sentido === 'SAIDA' && mcc && POSTO.has(mcc)) pluggyId = '19050001';

  if (sentido === 'ENTRADA') {
    if (pluggyId?.startsWith('01')) return RENDA;
    const especial = pluggyId && ['05100000', '04', '03'].find((p) => pluggyId.startsWith(p));
    // estorno, Pix recebido de alguém, reembolso...
    return especial ? MAPA[especial] : OUTRAS_ENTRADAS;
  }

  if (!pluggyId) return null;
  for (const tamanho of [8, 4, 2]) {
    const destino = MAPA[pluggyId.slice(0, tamanho)];
    // a moto nunca passa de R$ 30: acima disso é carro (fora dos R$ 120, o app pergunta)
    if (destino?.nome === 'Combustível') return valor <= ABASTECIMENTO_MAXIMO_DA_MOTO ? COMBUSTIVEL_MOTO : COMBUSTIVEL_CARRO;
    if (destino) return destino;
  }
  return null;
}

// Abastecimento no padrão (moto até R$ 30, carro R$ 120) não precisa perguntar.
export const combustivelNoPadrao = (valor: number) =>
  valor <= ABASTECIMENTO_MAXIMO_DA_MOTO || Math.abs(valor - ABASTECIMENTO_DO_CARRO) < 0.005;

// Numa compra (cartão ou débito), a categoria só é certa quando o tipo da
// loja confirma. Sem isso o app pergunta, e o "sempre neste lugar" aprende.
export const compraComCategoriaCerta = (categoria: string, mcc: number | null | undefined) =>
  !!mcc && CATEGORIA_CERTA_PELO_LUGAR[mcc] === categoria;
