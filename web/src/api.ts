import { useCallback, useEffect, useState } from 'react'
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser'

export type Sentido = 'ENTRADA' | 'SAIDA'

export interface Resumo {
  mes: string
  atualizadoEm: string | null
  saldoContas: number
  entradas: number
  saidas: number
  porCategoria: { categoria: string; valor: number }[]
  saidasUltimosMeses: { mes: string; total: number }[]
  faturasAbertas: { id: string; banco: string; vencimento: string; total: number }[]
  proximasContas: { id: string; nome: string; vencimento: string; valor: number }[]
  metas: { id: string; nome: string; alvo: number; guardado: number; prazo: string }[]
  investimentos: { total: number; rendimentoNoMes: number }
  sugestao: { id: string; titulo: string; texto: string } | null
}

export interface Lancamento {
  id: string
  data: string
  descricao: string
  descricaoOriginal: string
  valor: number
  sentido: Sentido
  categoria: { id: string; nome: string } | null
  categoriaConfirmada: boolean
  conta: { id: string; banco: string; tipo: 'CORRENTE' | 'POUPANCA' | 'CARTAO_CREDITO' }
  parcela: string | null
}

export interface Categoria {
  id: string
  nome: string
  sentido: Sentido
  cor: string
}

export interface Cartao {
  id: string
  banco: string
  final: string | null
  limite: number | null
  usoDoLimite: number | null
  fatura: {
    id: string
    total: number
    fechamento: string
    vencimento: string
    melhorDiaDeCompra: string
  } | null
  porCategoria: { categoria: string; valor: number }[]
  parcelamentos: { descricao: string; parcelaAtual: number; parcelasTotal: number; valor: number }[]
}

export interface ContaAPagar {
  id: string
  nome: string
  valor: number
  vencimento: string
  pagaEm: string | null
  formaPagamento: string | null
  pagaAutomaticamente: boolean
  temCodigo: boolean
  estimado: boolean
}

export interface Cobranca {
  id: string
  tipo: 'PIX' | 'BOLETO' | 'CONCESSIONARIA'
  codigo: string
  titulo: string
  recebedor: string | null
  valor: number | null
  vencimento: string | null
  pagaEm: string | null
  pagaAutomaticamente: boolean
}

export interface CodigoConferido {
  tipo: Cobranca['tipo']
  codigo: string
  valor: number | null
  vencimento?: string | null
  recebedor?: string | null
  contaFixaSugerida: string | null
}

export interface ContaFixa {
  id: string
  nome: string
  valorPrevisto: number
  diaVencimento: number
  formaPagamento: string
  recebedor: string | null
  contem: string | null
  valorVariavel: boolean
}

export interface Receita {
  id: string
  nome: string
  valor: number
  dia: number | null
  contem: string | null
  recebida: { valor: number; data: string } | null
}

export interface Orcamento {
  id: string
  nome: string
  valorMensal: number
  gasto: number
  categorias: { id: string; nome: string }[]
}

export interface Planejamento {
  resumo: { rendaPrevista: number; rendaRecebida: number; contasDoMes: number; faturasCartao: number; sobraEstimada: number }
  faturas: { banco: string; vencimento: string; total: number }[]
  receitas: Receita[]
  orcamentos: Orcamento[]
}

export interface Contas {
  total: number
  pago: number
  falta: number
  aVencer: ContaAPagar[]
  pagas: ContaAPagar[]
}

export interface Meta {
  id: string
  nome: string
  alvo: number
  guardado: number
  guardadoNoMes: number
  prazo: string
  porMes: number
  mesesRestantes: number
  situacao: 'concluida' | 'no-ritmo' | 'atrasada'
}

export interface Investimentos {
  total: number
  rendeuNoMes: number
  itens: {
    id: string
    nome: string
    banco: string
    tipo: string
    saldo: number
    rendeuNoMes: number
    fracao: number
    vencimento: string | null
  }[]
  dica: { texto: string } | null
}

export interface Sugestao {
  id: string
  tipo: 'ONDE' | 'QUANDO'
  regra: 'alta' | 'limite' | 'assinaturas' | 'melhor'
  titulo: string
  texto: string
  impactoMensal: number | null
  categoria: { id: string; nome: string; limiteAtual: number | null } | null
}

async function pedir<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`/api${caminho}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  if (resposta.status === 401 && !caminho.startsWith('/auth/')) {
    // sessão venceu ou foi encerrada: volta para a tela de entrar
    window.dispatchEvent(new Event('gf:sessao-encerrada'))
  }
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => null)
    throw new Error(corpo?.message ?? `A API respondeu ${resposta.status}`)
  }
  return resposta.status === 204 ? (undefined as T) : resposta.json()
}

export interface Aparelho {
  id: string
  aparelho: string
  criadaEm: string
  usadaEm: string | null
}

const postar = (corpo: unknown) => ({ method: 'POST', body: JSON.stringify(corpo) })

export const auth = {
  estado: () => pedir<{ logado: boolean; primeiroAcesso: boolean }>('/auth/estado'),
  opcoesCadastro: (codigo?: string) => pedir<PublicKeyCredentialCreationOptionsJSON>('/auth/cadastro/opcoes', postar({ codigo })),
  verificarCadastro: (resposta: unknown, aparelho: string) => pedir<void>('/auth/cadastro/verificar', postar({ resposta, aparelho })),
  opcoesEntrada: () => pedir<PublicKeyCredentialRequestOptionsJSON>('/auth/entrar/opcoes', postar({})),
  verificarEntrada: (resposta: unknown) => pedir<void>('/auth/entrar/verificar', postar({ resposta })),
  sair: () => pedir<void>('/auth/sair', { method: 'POST' }),
  aparelhos: () => pedir<Aparelho[]>('/auth/aparelhos'),
  removerAparelho: (id: string) => pedir<void>(`/auth/aparelhos/${id}`, { method: 'DELETE' }),
}

export interface EstadoSincronizacao {
  configurado: boolean
  bancos: string[]
  ultima: { quando: string; sucesso: boolean | null; erro: string | null; novos: number } | null
}

export const api = {
  sincronizacao: () => pedir<EstadoSincronizacao>('/sincronizacao'),
  sincronizar: () => pedir<{ novos?: number; jaEstavaRodando?: boolean }>('/sincronizacao', { method: 'POST' }),
  resumo: (mes: string) => pedir<Resumo>(`/resumo?mes=${mes}`),
  lancamentos: (filtro: Record<string, string | undefined>) => {
    const params = new URLSearchParams(Object.entries(filtro).filter((par): par is [string, string] => !!par[1]))
    return pedir<Lancamento[]>(`/lancamentos?${params}`)
  },
  categorias: () => pedir<Categoria[]>('/categorias'),
  cartoes: () => pedir<Cartao[]>('/cartoes'),
  contas: (mes: string) => pedir<Contas>(`/contas?mes=${mes}`),
  novaContaFixa: (dados: {
    nome: string
    valorPrevisto: number
    diaVencimento: number
    formaPagamento: string
    contem?: string
    valorVariavel?: boolean
  }) => pedir('/contas/fixas', postar(dados)),
  planejamento: (mes: string) => pedir<Planejamento>(`/planejamento?mes=${mes}`),
  salvarReceita: (dados: { nome: string; valor: number; dia?: number; contem?: string }, id?: string) =>
    id ? pedir<void>(`/receitas/${id}`, { method: 'PATCH', body: JSON.stringify(dados) }) : pedir('/receitas', postar(dados)),
  removerReceita: (id: string) => pedir<void>(`/receitas/${id}`, { method: 'DELETE' }),
  salvarOrcamento: (dados: { nome: string; valorMensal: number; categoriaIds: string[] }, id?: string) =>
    id ? pedir<void>(`/orcamentos/${id}`, { method: 'PATCH', body: JSON.stringify(dados) }) : pedir('/orcamentos', postar(dados)),
  removerOrcamento: (id: string) => pedir<void>(`/orcamentos/${id}`, { method: 'DELETE' }),
  contasFixas: () =>
    pedir<(Omit<ContaFixa, 'valorPrevisto'> & { valorPrevisto: string | number })[]>('/contas/fixas').then((fixas) =>
      // o Prisma manda Decimal como texto
      fixas.map((f) => ({ ...f, valorPrevisto: Number(f.valorPrevisto) }) as ContaFixa),
    ),
  editarContaFixa: (id: string, dados: Partial<Omit<ContaFixa, 'id' | 'recebedor'>>) =>
    pedir<void>(`/contas/fixas/${id}`, { method: 'PATCH', body: JSON.stringify(dados) }),
  desativarContaFixa: (id: string) => pedir<void>(`/contas/fixas/${id}`, { method: 'DELETE' }),
  cobrancas: () => pedir<Cobranca[]>('/cobrancas'),
  conferirCodigo: (codigo: string) => pedir<CodigoConferido>('/cobrancas/conferir', postar({ codigo })),
  novaCobranca: (dados: { codigo: string; descricao?: string; contaFixaId?: string }) =>
    pedir<{ id: string; aviso: string | null }>('/cobrancas', postar(dados)),
  marcarCobranca: (id: string, paga: boolean) => pedir<void>(`/cobrancas/${id}`, { method: 'PATCH', body: JSON.stringify({ paga }) }),
  removerCobranca: (id: string) => pedir<void>(`/cobrancas/${id}`, { method: 'DELETE' }),
  informarValorConta: (id: string, valor: number) =>
    pedir<void>(`/contas/${id}/valor`, { method: 'PATCH', body: JSON.stringify({ valor }) }),
  marcarConta: (id: string, paga: boolean) => pedir<void>(`/contas/${id}`, { method: 'PATCH', body: JSON.stringify({ paga }) }),
  metas: () => pedir<{ guardadoNoMes: number; metas: Meta[] }>('/metas'),
  novaMeta: (dados: { nome: string; valorAlvo: number; prazo: string }) => pedir('/metas', postar(dados)),
  guardarNaMeta: (id: string, valor: number) => pedir(`/metas/${id}/aportes`, postar({ valor })),
  investimentos: () => pedir<Investimentos>('/investimentos'),
  sugestoes: () => pedir<Sugestao[]>('/sugestoes'),
  responderSugestao: (id: string, status: 'ACEITA' | 'IGNORADA') =>
    pedir<void>(`/sugestoes/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  definirLimite: (categoriaId: string, valorMensal: number) => pedir('/limites', postar({ categoriaId, valorMensal })),
  confirmarCategoria: (id: string) => pedir<void>(`/lancamentos/${id}/confirmar`, { method: 'PATCH' }),
  trocarCategoria: (id: string, dados: { categoriaId: string; apelido?: string; aplicarAosProximos?: boolean; contem?: string }) =>
    pedir<{ ajustados: number }>(`/lancamentos/${id}/categoria`, { method: 'PATCH', body: JSON.stringify(dados) }),
}

// Carrega algo da API e devolve { dados, erro, recarregar }.
export function useApi<T>(carregar: () => Promise<T>, deps: unknown[]) {
  const [dados, setDados] = useState<T>()
  const [erro, setErro] = useState<string>()

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const buscar = useCallback(carregar, deps)

  const recarregar = useCallback(() => {
    buscar()
      .then((d) => {
        setDados(d)
        setErro(undefined)
      })
      .catch((e: Error) => setErro(e.message))
  }, [buscar])

  useEffect(recarregar, [recarregar])

  return { dados, erro, recarregar }
}
