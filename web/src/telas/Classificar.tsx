import { useMemo, useState } from 'react'
import { api, useApi, type Categoria, type Lancamento } from '../api'
import { Cabecalho, Carregando } from '../componentes/Base'
import { IconeAvancar, IconeVoltar } from '../componentes/Icones'
import { brl, diaMes, legivel, lugarDaCompra, mesAtual, nomeDoMes } from '../formatos'

// Os botões de um toque: o que mais se mistura no dia a dia.
const RAPIDAS = ['Mercado', 'Lanche', 'Lazer', 'Combustível carro', 'Combustível moto']
// combustível é o mesmo posto para carro e moto: "sempre neste lugar" não serve
const SEM_LUGAR_FIXO = ['Combustível carro', 'Combustível moto']

function mudarMes(mes: string, delta: number) {
  const [ano, m] = mes.split('-').map(Number)
  const d = new Date(ano, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// "Classificar gastos": tocar no que é mercado, lanche, lazer, carro ou moto.
export function Classificar() {
  const [mes, setMes] = useState(mesAtual)
  const { dados, erro, recarregar } = useApi(() => api.lancamentos({ mes, sentido: 'SAIDA' }), [mes])
  const { dados: categorias = [] } = useApi(api.categorias, [])
  const [filtro, setFiltro] = useState<string>('Todas')
  const [aviso, setAviso] = useState<string>()

  // só o que é gasto de verdade: fora transferências entre contas, faturas e contas fixas
  const gastos = useMemo(() => (dados ?? []).filter((l) => !l.categoria?.foraDosTotais && l.origemCategoria !== 'CONTA_FIXA'), [dados])
  const paraConfirmar = gastos.filter((l) => !l.categoriaConfirmada)
  const classificados = gastos.filter((l) => l.categoriaConfirmada && (filtro === 'Todas' || l.categoria?.nome === filtro))
  const nomesPresentes = ['Todas', ...new Set(gastos.filter((l) => l.categoriaConfirmada).map((l) => l.categoria?.nome ?? 'Sem categoria'))]

  async function classificar(l: Lancamento, categoria: Categoria, sempreAqui: boolean) {
    const lugar = lugarDaCompra(l.descricaoOriginal)
    const { ajustados } = await api.trocarCategoria(l.id, {
      categoriaId: categoria.id,
      aplicarAosProximos: sempreAqui,
      contem: sempreAqui ? lugar : undefined,
    })
    setAviso(
      sempreAqui && ajustados > 1
        ? `${legivel(lugar)} → ${categoria.nome} (${ajustados} compras, e as próximas também)`
        : `${legivel(l.descricao)} → ${categoria.nome}`,
    )
    recarregar()
  }

  const botaoMes = 'flex size-11 items-center justify-center rounded-xl border border-borda-forte bg-white'

  return (
    <>
      <Cabecalho sobre={`${nomeDoMes(mes)}${dados ? ` · ${paraConfirmar.length} para confirmar` : ''}`} titulo="Classificar gastos">
        <div className="flex gap-2">
          <button className={botaoMes} aria-label="Mês anterior" onClick={() => setMes(mudarMes(mes, -1))}>
            <IconeVoltar width={18} height={18} />
          </button>
          <button className={botaoMes} aria-label="Próximo mês" onClick={() => setMes(mudarMes(mes, 1))}>
            <IconeAvancar width={18} height={18} />
          </button>
        </div>
      </Cabecalho>

      <p className="mb-4 text-sm text-suave">
        Toque na categoria certa. Com <b>"sempre neste lugar"</b>, todas as compras desse lugar mudam juntas, as de antes e as próximas.
      </p>

      {aviso && (
        <p role="status" className="mb-4 rounded-xl bg-floresta-clara px-4 py-3 text-sm text-floresta-escura">
          {aviso}
        </p>
      )}

      {!dados ? (
        <Carregando erro={erro} />
      ) : (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-2">
            <h2 className="text-[13px] font-semibold text-suave">Para confirmar ({paraConfirmar.length})</h2>
            {paraConfirmar.length === 0 && (
              <p className="rounded-2xl border border-borda bg-white p-4 text-sm text-suave">Tudo confirmado neste mês.</p>
            )}
            <div className="grid gap-3 lg:grid-cols-2">
              {paraConfirmar.map((l) => (
                <ItemGasto key={l.id} lancamento={l} categorias={categorias} aoClassificar={classificar} />
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-[13px] font-semibold text-suave">Já classificados: confira se não está misturado</h2>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {nomesPresentes.map((n) => (
                <button
                  key={n}
                  aria-pressed={filtro === n}
                  onClick={() => setFiltro(n)}
                  className={`h-9 shrink-0 rounded-full border px-3 text-sm ${
                    filtro === n ? 'border-floresta bg-floresta text-white' : 'border-borda-forte bg-white'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {classificados.map((l) => (
                <ItemGasto key={l.id} lancamento={l} categorias={categorias} aoClassificar={classificar} />
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  )
}

function ItemGasto({
  lancamento: l,
  categorias,
  aoClassificar,
}: {
  lancamento: Lancamento
  categorias: Categoria[]
  aoClassificar: (l: Lancamento, c: Categoria, sempreAqui: boolean) => Promise<void>
}) {
  const lugar = lugarDaCompra(l.descricaoOriginal)
  const [sempreAqui, setSempreAqui] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const deSaida = categorias.filter((c) => c.sentido === 'SAIDA')
  const rapidas = RAPIDAS.map((n) => deSaida.find((c) => c.nome === n)).filter((c): c is Categoria => !!c)

  async function escolher(c: Categoria) {
    setOcupado(true)
    // combustível nunca vale para o lugar todo: o mesmo posto serve carro e moto
    await aoClassificar(l, c, sempreAqui && !SEM_LUGAR_FIXO.includes(c.nome))
    setOcupado(false)
  }

  return (
    <article className={`flex flex-col gap-3 rounded-2xl border border-borda bg-white p-4 ${ocupado ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-medium">{legivel(l.descricao)}</span>
          <span className="text-[13px] text-suave">
            {diaMes(l.data)} · {l.conta.tipo === 'CARTAO_CREDITO' ? 'cartão' : 'conta'} {l.conta.banco}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[15px] font-semibold">{brl(l.valor)}</span>
          <span
            className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${
              l.categoriaConfirmada ? 'bg-divisor text-suave' : 'bg-ambar-claro text-ambar-texto'
            }`}
          >
            {l.categoria?.nome ?? 'Sem categoria'}
            {!l.categoriaConfirmada && '?'}
          </span>
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {rapidas.map((c) => (
          <button
            key={c.id}
            disabled={ocupado}
            onClick={() => escolher(c)}
            aria-pressed={l.categoria?.id === c.id}
            className={`h-10 rounded-full border px-3.5 text-sm ${
              l.categoria?.id === c.id
                ? 'border-floresta bg-floresta-clara font-semibold text-floresta-escura'
                : 'border-borda-forte bg-white'
            }`}
          >
            {c.nome.replace('Combustível', 'Comb.')}
          </button>
        ))}
        <label className="sr-only" htmlFor={`outra-${l.id}`}>
          Outra categoria
        </label>
        <select
          id={`outra-${l.id}`}
          disabled={ocupado}
          value=""
          onChange={(e) => {
            const c = deSaida.find((x) => x.id === e.target.value)
            if (c) escolher(c)
          }}
          className="h-10 rounded-full border border-borda-forte bg-white px-3 text-sm"
        >
          <option value="">Outra…</option>
          {deSaida
            .filter((c) => !RAPIDAS.includes(c.nome))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
        </select>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-[13px] text-suave">
        <input type="checkbox" className="size-4 accent-floresta" checked={sempreAqui} onChange={(e) => setSempreAqui(e.target.checked)} />
        sempre neste lugar ({legivel(lugar)})
      </label>
    </article>
  )
}
