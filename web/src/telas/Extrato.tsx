import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { api, useApi, type Categoria, type Lancamento, type Sentido } from '../api'
import { Cabecalho, Carregando, Cartao } from '../componentes/Base'
import { brl, brlComSinal, diaMes, legivel, mesAtual, nomeDoMes } from '../formatos'

const campo = 'h-11 rounded-xl border border-borda-forte bg-white px-3.5 text-[15px] text-tinta'

export function Extrato() {
  const [mes] = useState(mesAtual)
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [sentido, setSentido] = useState<Sentido | ''>('')
  // /extrato?categoria=<id> já abre filtrado (vem das sugestões)
  const [parametros] = useSearchParams()
  const [categoriaId, setCategoriaId] = useState(parametros.get('categoria') ?? '')
  const [selecionadoId, setSelecionadoId] = useState<string>()

  // espera parar de digitar antes de buscar
  useEffect(() => {
    const t = setTimeout(() => setBuscaAplicada(busca.trim()), 250)
    return () => clearTimeout(t)
  }, [busca])

  const { dados: lancamentos, erro, recarregar } = useApi(
    () => api.lancamentos({ mes, busca: buscaAplicada, sentido, categoriaId }),
    [mes, buscaAplicada, sentido, categoriaId],
  )
  const { dados: categorias = [] } = useApi(api.categorias, [])

  const selecionado = lancamentos?.find((l) => l.id === selecionadoId)
  const semCategoria = lancamentos?.filter((l) => !l.categoriaConfirmada).length ?? 0

  return (
    <>
      <Cabecalho
        sobre={`${nomeDoMes(mes)} · todas as contas${lancamentos ? ` · ${lancamentos.length} lançamentos` : ''}`}
        titulo="Extrato"
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-[2_1_260px] flex-col gap-1.5">
          <span className="text-[13px] text-suave">Buscar lançamento</span>
          <input type="search" className={campo} placeholder="Ex.: mercado, Uber, Pix" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <label className="flex flex-[1_1_160px] flex-col gap-1.5">
          <span className="text-[13px] text-suave">Categoria</span>
          <select className={campo} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            <option value="">Todas</option>
            <option value="nenhuma">Sem categoria</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </label>
        <div role="group" aria-label="Tipo" className="flex h-11 flex-[1_1_220px] gap-1 rounded-xl bg-[#E3E8E6] p-1">
          {([['', 'Tudo'], ['ENTRADA', 'Entradas'], ['SAIDA', 'Saídas']] as const).map(([valor, nome]) => (
            <button
              key={nome}
              aria-pressed={sentido === valor}
              onClick={() => setSentido(valor)}
              className={`flex-1 rounded-[9px] text-sm ${sentido === valor ? 'bg-white font-semibold' : 'text-suave'}`}
            >
              {nome}
            </button>
          ))}
        </div>
      </div>

      {semCategoria > 0 && (
        <p className="mb-4 rounded-xl bg-ambar-claro px-4 py-3 text-sm text-ambar-texto">
          {semCategoria === 1 ? '1 lançamento precisa' : `${semCategoria} lançamentos precisam`} da sua confirmação.
        </p>
      )}

      {!lancamentos ? (
        <Carregando erro={erro} />
      ) : (
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <div className="min-w-0 lg:flex-[3]">
            <ListaCelular
              lancamentos={lancamentos}
              selecionadoId={selecionadoId}
              aoSelecionar={setSelecionadoId}
              categorias={categorias}
              aoSalvar={recarregar}
            />
            <TabelaMac lancamentos={lancamentos} selecionadoId={selecionadoId} aoSelecionar={setSelecionadoId} />
          </div>
          {selecionado && (
            <div className="hidden min-w-0 lg:block lg:flex-[2]">
              <Detalhe key={selecionado.id} lancamento={selecionado} categorias={categorias} aoSalvar={recarregar} />
            </div>
          )}
        </div>
      )}
    </>
  )
}

function porDia(lancamentos: Lancamento[]) {
  const grupos = new Map<string, Lancamento[]>()
  for (const l of lancamentos) {
    const dia = l.data.slice(0, 10)
    grupos.set(dia, [...(grupos.get(dia) ?? []), l])
  }
  return [...grupos]
}

function tituloDoDia(dia: string) {
  const d = new Date(`${dia}T12:00:00`)
  const hoje = new Date()
  const ontem = new Date(hoje.getTime() - 86_400_000)
  const mesmoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  const ddmm = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  if (mesmoDia(d, hoje)) return `Hoje, ${ddmm}`
  if (mesmoDia(d, ontem)) return `Ontem, ${ddmm}`
  const semana = d.toLocaleDateString('pt-BR', { weekday: 'long' }).replace('-feira', '')
  return `${semana[0].toUpperCase()}${semana.slice(1)}, ${ddmm}`
}

const totalDoDia = (itens: Lancamento[]) =>
  itens.reduce((s, l) => s + (l.sentido === 'ENTRADA' ? l.valor : -l.valor), 0)

const origem = (l: Lancamento) =>
  `${l.categoria?.nome ?? 'Sem categoria'} · ${l.conta.tipo === 'CARTAO_CREDITO' ? 'cartão' : 'conta'} ${l.conta.banco}`

function ListaCelular({
  lancamentos, selecionadoId, aoSelecionar, categorias, aoSalvar,
}: {
  lancamentos: Lancamento[]
  selecionadoId?: string
  aoSelecionar: (id?: string) => void
  categorias: Categoria[]
  aoSalvar: () => void
}) {
  const dias = useMemo(() => porDia(lancamentos), [lancamentos])
  if (lancamentos.length === 0) return <p className="text-sm text-suave lg:hidden">Nada encontrado.</p>

  return (
    <div className="flex flex-col gap-4 lg:hidden">
      {dias.map(([dia, itens]) => {
        const total = totalDoDia(itens)
        return (
          <section key={dia} className="flex flex-col gap-2">
            <div className="flex justify-between text-[13px] text-suave">
              <h2 className="font-semibold">{tituloDoDia(dia)}</h2>
              <span>{brlComSinal(total, total >= 0 ? 'ENTRADA' : 'SAIDA')}</span>
            </div>
            <Cartao className="px-4">
              {itens.map((l, i) => (
                <div key={l.id} className={i > 0 ? 'border-t border-divisor' : ''}>
                  <button
                    className="flex min-h-15 w-full items-center justify-between gap-3 text-left"
                    aria-expanded={selecionadoId === l.id}
                    onClick={() => aoSelecionar(selecionadoId === l.id ? undefined : l.id)}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[15px] font-medium">{legivel(l.descricao)}</span>
                      <span className="text-[13px] text-suave">{origem(l)}</span>
                    </span>
                    <span className={`shrink-0 text-[15px] font-semibold ${l.sentido === 'ENTRADA' ? 'text-floresta' : ''}`}>
                      {brlComSinal(l.valor, l.sentido)}
                    </span>
                  </button>
                  {!l.categoriaConfirmada && selecionadoId !== l.id && (
                    <Confirmacao lancamento={l} aoEscolherOutra={() => aoSelecionar(l.id)} aoSalvar={aoSalvar} />
                  )}
                  {selecionadoId === l.id && (
                    <div className="pb-4">
                      <Detalhe lancamento={l} categorias={categorias} aoSalvar={aoSalvar} embutido />
                    </div>
                  )}
                </div>
              ))}
            </Cartao>
          </section>
        )
      })}
    </div>
  )
}

function Confirmacao({ lancamento, aoEscolherOutra, aoSalvar }: { lancamento: Lancamento; aoEscolherOutra: () => void; aoSalvar: () => void }) {
  const sugerida = lancamento.categoria?.nome
  return (
    <div className="mb-3 flex flex-col gap-2 rounded-xl bg-ambar-claro px-3 py-2.5">
      <span className="text-[13px]">
        {sugerida ? <>Parece <b>{sugerida}</b>. Está certo?</> : 'Não reconheci este lançamento. Qual é a categoria?'}
      </span>
      <div className="flex gap-2">
        {sugerida && (
          <button
            className="h-9 rounded-[10px] bg-[#9A5B00] px-3.5 text-sm font-medium text-white"
            onClick={() => api.confirmarCategoria(lancamento.id).then(aoSalvar)}
          >
            Sim, é {sugerida}
          </button>
        )}
        <button className="h-9 rounded-[10px] border border-[#9A5B00] px-3.5 text-sm font-medium text-ambar-texto" onClick={aoEscolherOutra}>
          {sugerida ? 'Escolher outra' : 'Escolher'}
        </button>
      </div>
    </div>
  )
}

function TabelaMac({ lancamentos, selecionadoId, aoSelecionar }: { lancamentos: Lancamento[]; selecionadoId?: string; aoSelecionar: (id: string) => void }) {
  return (
    <Cartao className="hidden overflow-x-auto lg:block">
      <table className="w-full min-w-[600px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-[13px] text-suave">
            <th className="px-4 py-3.5 font-semibold">Data</th>
            <th className="px-2 py-3.5 font-semibold">Descrição</th>
            <th className="px-2 py-3.5 font-semibold">Categoria</th>
            <th className="px-2 py-3.5 font-semibold">Conta</th>
            <th className="px-4 py-3.5 text-right font-semibold">Valor</th>
          </tr>
        </thead>
        <tbody>
          {lancamentos.map((l) => {
            const ativo = l.id === selecionadoId
            return (
              <tr
                key={l.id}
                onClick={() => aoSelecionar(l.id)}
                className={`cursor-pointer border-t border-divisor ${ativo ? 'bg-[#FFF8EC]' : 'hover:bg-fundo'}`}
              >
                <td className="px-4 py-3.5 whitespace-nowrap text-suave">{diaMes(l.data)}</td>
                <td className="px-2 py-3.5 font-medium">
                  {/* botão de verdade para dar para chegar pelo teclado */}
                  <button className="text-left" onClick={() => aoSelecionar(l.id)}>{legivel(l.descricao)}</button>
                </td>
                <td className="px-2 py-3.5">
                  <span
                    className={`rounded-[10px] px-2.5 py-0.5 text-[13px] whitespace-nowrap ${
                      l.categoriaConfirmada ? 'bg-divisor text-[#3B4943]' : 'bg-ambar-claro font-semibold text-ambar-texto'
                    }`}
                  >
                    {l.categoria?.nome ?? 'Sem categoria'}
                    {!l.categoriaConfirmada && l.categoria && ' ?'}
                  </span>
                </td>
                <td className="px-2 py-3.5 text-suave">
                  {l.conta.tipo === 'CARTAO_CREDITO' ? 'cartão ' : ''}{l.conta.banco}
                </td>
                <td className={`px-4 py-3.5 text-right font-semibold whitespace-nowrap ${l.sentido === 'ENTRADA' ? 'text-floresta' : ''}`}>
                  {brlComSinal(l.valor, l.sentido)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Cartao>
  )
}

function Detalhe({
  lancamento, categorias, aoSalvar, embutido = false,
}: {
  lancamento: Lancamento
  categorias: Categoria[]
  aoSalvar: () => void
  embutido?: boolean
}) {
  const doMesmoSentido = categorias.filter((c) => c.sentido === lancamento.sentido)
  const [categoriaId, setCategoriaId] = useState(lancamento.categoria?.id ?? doMesmoSentido[0]?.id ?? '')
  const [apelido, setApelido] = useState(lancamento.descricao === lancamento.descricaoOriginal ? '' : lancamento.descricao)
  const [aplicar, setAplicar] = useState(!lancamento.categoriaConfirmada)
  const [contem, setContem] = useState(lancamento.descricaoOriginal)
  const [aviso, setAviso] = useState<string>()

  async function salvar() {
    const { ajustados } = await api.trocarCategoria(lancamento.id, {
      categoriaId,
      apelido: apelido || undefined,
      aplicarAosProximos: aplicar,
      contem: aplicar ? contem : undefined,
    })
    setAviso(ajustados > 1 ? `Salvo. ${ajustados} lançamentos ajustados.` : 'Salvo.')
    aoSalvar()
  }

  return (
    <aside
      aria-label="Lançamento selecionado"
      className={`flex flex-col gap-3.5 ${embutido ? '' : 'rounded-2xl border border-borda bg-white p-5'}`}
    >
      {!embutido && (
        <>
          <span className="text-[13px] text-suave">{diaMes(lancamento.data)} · {lancamento.conta.banco}</span>
          <h2 className="text-lg font-semibold">{legivel(lancamento.descricao)}</h2>
          <span className="font-titulo text-[26px] font-bold">{brlComSinal(lancamento.valor, lancamento.sentido)}</span>
        </>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] text-suave">Categoria</span>
        <select className={campo} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          {doMesmoSentido.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] text-suave">Nome para mostrar (opcional)</span>
        <input className={campo} placeholder={lancamento.descricaoOriginal} value={apelido} onChange={(e) => setApelido(e.target.value)} />
      </label>
      <label className="flex cursor-pointer items-start gap-2.5 text-sm">
        <input type="checkbox" className="mt-0.5 size-4.5 accent-floresta" checked={aplicar} onChange={(e) => setAplicar(e.target.checked)} />
        <span>Aplicar aos próximos lançamentos que contêm o texto abaixo</span>
      </label>
      {aplicar && (
        <input aria-label="Texto da regra" className={campo} value={contem} onChange={(e) => setContem(e.target.value)} />
      )}
      <button
        className="h-11.5 rounded-xl bg-floresta text-[15px] font-semibold text-white disabled:opacity-50"
        disabled={!categoriaId || (aplicar && !contem.trim())}
        onClick={salvar}
      >
        Salvar
      </button>
      {aviso && <p role="status" className="text-sm text-floresta-escura">{aviso}</p>}
      <p className="text-xs text-suave">Valor no banco: {brl(lancamento.valor)} · {lancamento.descricaoOriginal}</p>
    </aside>
  )
}
