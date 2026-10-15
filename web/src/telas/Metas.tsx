import { useState } from 'react'
import { api, useApi, type Meta } from '../api'
import { Barra, Cabecalho, Carregando } from '../componentes/Base'
import { BotaoAdicionar, Campo, botaoPrincipal } from '../componentes/Formulario'
import { brl, paraNumero } from '../formatos'

const SITUACAO = {
  'no-ritmo': { texto: 'no ritmo', selo: 'bg-floresta-clara text-floresta-escura', barra: 'bg-floresta' },
  atrasada: { texto: 'atrasada', selo: 'bg-ambar-claro text-ambar-texto', barra: 'bg-ambar' },
  concluida: { texto: 'concluída', selo: 'bg-floresta text-white', barra: 'bg-floresta' },
} as const

const mesAno = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

export function Metas() {
  const { dados, erro, recarregar } = useApi(api.metas, [])
  const [criando, setCriando] = useState(false)

  return (
    <>
      <Cabecalho sobre={dados ? `${brl(dados.guardadoNoMes)} guardados este mês` : 'Metas'} titulo="Metas">
        <BotaoAdicionar rotulo="Nova meta" aberto={criando} aoAlternar={() => setCriando(!criando)} />
      </Cabecalho>

      {criando && (
        <NovaMeta
          aoSalvar={() => {
            setCriando(false)
            recarregar()
          }}
        />
      )}

      {!dados ? (
        <Carregando erro={erro} />
      ) : dados.metas.length === 0 ? (
        <p className="text-sm text-suave">Nenhuma meta ainda. Toque no + para criar a primeira.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {dados.metas.map((m) => (
            <CartaoMeta key={m.id} meta={m} aoGuardar={recarregar} />
          ))}
        </div>
      )}
    </>
  )
}

function CartaoMeta({ meta: m, aoGuardar }: { meta: Meta; aoGuardar: () => void }) {
  const [guardando, setGuardando] = useState(false)
  const [valor, setValor] = useState('')
  const s = SITUACAO[m.situacao]

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    await api.guardarNaMeta(m.id, paraNumero(valor))
    setValor('')
    setGuardando(false)
    aoGuardar()
  }

  return (
    <section className="flex flex-col gap-2.5 rounded-2xl border border-borda bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold">{m.nome}</h2>
          <span className="text-[13px] text-suave">até {mesAno(m.prazo)}</span>
        </span>
        <span className={`rounded-[10px] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${s.selo}`}>{s.texto}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-titulo text-[22px] font-bold">{brl(m.guardado)}</span>
        <span className="text-sm text-suave">de {brl(m.alvo)}</span>
      </div>
      <Barra fracao={m.guardado / m.alvo} cor={s.barra} altura="h-2.5" />
      <span className="text-[13px] text-suave">
        {m.situacao === 'concluida'
          ? 'Meta alcançada.'
          : `Guardando ${brl(m.porMes)} por mês, você chega lá no prazo.${m.guardadoNoMes ? ` Este mês: ${brl(m.guardadoNoMes)}.` : ''}`}
      </span>

      {m.situacao !== 'concluida' &&
        (guardando ? (
          <form onSubmit={guardar} className="flex items-end gap-2">
            <Campo rotulo="Quanto guardou (R$)" valor={valor} aoMudar={setValor} inputMode="decimal" className="flex-1" />
            <button className={botaoPrincipal} disabled={!(paraNumero(valor) > 0)}>Guardar</button>
          </form>
        ) : (
          <button className="h-10 self-start rounded-[10px] border border-borda-forte px-3.5 text-sm font-medium" onClick={() => setGuardando(true)}>
            Guardei dinheiro
          </button>
        ))}
    </section>
  )
}

function NovaMeta({ aoSalvar }: { aoSalvar: () => void }) {
  const [nome, setNome] = useState('')
  const [alvo, setAlvo] = useState('')
  const [prazo, setPrazo] = useState('')
  const [erro, setErro] = useState<string>()

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api.novaMeta({ nome, valorAlvo: paraNumero(alvo), prazo })
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  return (
    <form onSubmit={salvar} className="mb-4 grid gap-3 rounded-2xl border border-borda bg-white p-4 sm:grid-cols-3 sm:items-end">
      <Campo rotulo="Nome da meta" valor={nome} aoMudar={setNome} placeholder="Ex.: Notebook novo" />
      <Campo rotulo="Quanto quer juntar (R$)" valor={alvo} aoMudar={setAlvo} inputMode="decimal" />
      <Campo rotulo="Até quando" valor={prazo} aoMudar={setPrazo} tipo="date" />
      <button className={`${botaoPrincipal} sm:col-span-3`} disabled={!nome.trim() || !(paraNumero(alvo) > 0) || !prazo}>
        Criar meta
      </button>
      {erro && <p role="alert" className="text-sm text-ambar-texto sm:col-span-3">{erro}</p>}
    </form>
  )
}
