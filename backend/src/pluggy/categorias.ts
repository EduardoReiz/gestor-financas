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

// Devolve a categoria do app (ou null: "sem categoria", o app pergunta).
export function traduzirCategoria(pluggyId: string | null, sentido: Sentido, valor = 0): Destino | null {
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
