import { useState } from 'react'
import { Link } from 'react-router'
import { api, useApi, type Sugestao } from '../api'
import { Cabecalho, Carregando } from '../componentes/Base'
import { Campo, botaoPrincipal } from '../componentes/Formulario'
import { brl, paraNumero } from '../formatos'

export function Sugestoes() {
  const { dados, erro, recarregar } = useApi(api.sugestoes, [])

  const economia = dados?.reduce((s, x) => s + (x.impactoMensal ?? 0), 0) ?? 0
  const sobre = !dados
    ? 'Sugestões'
    : dados.length === 0
      ? 'Nada novo por enquanto'
      : `${dados.length} ${dados.length === 1 ? 'ideia' : 'ideias'}${economia ? ` · até ${brl(economia)} por mês de economia` : ''}`

  return (
    <>
      <Cabecalho sobre={sobre} titulo="Sugestões" />

      {!dados ? (
        <Carregando erro={erro} />
      ) : dados.length === 0 ? (
        <p className="text-sm text-suave">
          Quando algum gasto fugir do normal, uma fatura estiver para fechar ou um limite estourar, a ideia aparece aqui.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {dados.map((s) => (
            <CartaoSugestao key={s.id} sugestao={s} aoResponder={recarregar} />
          ))}
        </div>
      )}
    </>
  )
}

function CartaoSugestao({ sugestao: s, aoResponder }: { sugestao: Sugestao; aoResponder: () => void }) {
  const [limiteAberto, setLimiteAberto] = useState(false)
  const [limite, setLimite] = useState(String(s.categoria?.limiteAtual ?? ''))

  const responder = (status: 'ACEITA' | 'IGNORADA') => api.responderSugestao(s.id, status).then(aoResponder)

  async function criarLimite(e: React.FormEvent) {
    e.preventDefault()
    await api.definirLimite(s.categoria!.id, paraNumero(limite))
    await responder('ACEITA')
  }

  const onde = s.tipo === 'ONDE'

  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
      <span
        className={`self-start rounded-[10px] px-2.5 py-0.5 text-xs font-semibold ${
          onde ? 'bg-ambar-claro text-ambar-texto' : 'bg-[#E8EEF8] text-[#234A80]'
        }`}
      >
        {onde ? 'Onde economizar' : 'Quando comprar'}
      </span>
      <h2 className="text-base font-semibold">{s.titulo}</h2>
      <p className="text-sm text-suave">{s.texto}</p>
      {s.impactoMensal ? (
        <span className="text-sm font-semibold text-floresta">Até {brl(s.impactoMensal)} por mês</span>
      ) : null}

      {limiteAberto ? (
        <form onSubmit={criarLimite} className="mt-1 flex items-end gap-2">
          <Campo rotulo={`Limite mensal para ${s.categoria?.nome} (R$)`} valor={limite} aoMudar={setLimite} inputMode="decimal" className="flex-1" />
          <button className={botaoPrincipal} disabled={!(paraNumero(limite) > 0)}>Salvar</button>
        </form>
      ) : (
        <div className="mt-1 flex flex-wrap gap-2">
          {s.regra === 'assinaturas' && s.categoria && (
            <Link
              to={`/extrato?categoria=${s.categoria.id}`}
              onClick={() => responder('ACEITA')}
              className="flex h-10 items-center rounded-[10px] bg-floresta px-4 text-sm font-medium text-white"
            >
              Ver assinaturas
            </Link>
          )}
          {(s.regra === 'alta' || s.regra === 'limite') && s.categoria && (
            <button className="h-10 rounded-[10px] bg-floresta px-4 text-sm font-medium text-white" onClick={() => setLimiteAberto(true)}>
              {s.categoria.limiteAtual ? 'Ajustar limite' : 'Criar limite'}
            </button>
          )}
          {s.regra === 'melhor' && (
            <button className="h-10 rounded-[10px] bg-floresta px-4 text-sm font-medium text-white" onClick={() => responder('ACEITA')}>
              Entendi
            </button>
          )}
          <button className="h-10 rounded-[10px] border border-borda-forte px-4 text-sm" onClick={() => responder('IGNORADA')}>
            Ignorar
          </button>
        </div>
      )}
    </section>
  )
}
