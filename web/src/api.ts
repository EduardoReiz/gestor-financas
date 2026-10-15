import { useCallback, useEffect, useState } from 'react'

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

async function pedir<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`/api${caminho}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  if (!resposta.ok) throw new Error(`A API respondeu ${resposta.status}`)
  return resposta.status === 204 ? (undefined as T) : resposta.json()
}

export const api = {
  resumo: (mes: string) => pedir<Resumo>(`/resumo?mes=${mes}`),
  lancamentos: (filtro: Record<string, string | undefined>) => {
    const params = new URLSearchParams(
      Object.entries(filtro).filter((par): par is [string, string] => !!par[1]),
    )
    return pedir<Lancamento[]>(`/lancamentos?${params}`)
  },
  categorias: () => pedir<Categoria[]>('/categorias'),
  cartoes: () => pedir<Cartao[]>('/cartoes'),
  confirmarCategoria: (id: string) => pedir<void>(`/lancamentos/${id}/confirmar`, { method: 'PATCH' }),
  trocarCategoria: (
    id: string,
    dados: { categoriaId: string; apelido?: string; aplicarAosProximos?: boolean; contem?: string },
  ) => pedir<{ ajustados: number }>(`/lancamentos/${id}/categoria`, { method: 'PATCH', body: JSON.stringify(dados) }),
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
