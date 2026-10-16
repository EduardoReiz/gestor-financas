import { useState } from 'react'
import { api, useApi, type Categoria, type Orcamento, type Receita } from '../api'
import { Barra, Cabecalho, Carregando, Cartao } from '../componentes/Base'
import { BotaoAdicionar, Campo, botaoPrincipal } from '../componentes/Formulario'
import { brl, diaMes, mesAtual, nomeDoMes, paraNumero } from '../formatos'

// Planejamento do mês: quanto entra, quanto já está comprometido e o que sobra.
export function Planejamento() {
  const [mes] = useState(mesAtual)
  const { dados, erro, recarregar } = useApi(() => api.planejamento(mes), [mes])
  const { dados: categorias = [] } = useApi(api.categorias, [])

  if (!dados) return <Carregando erro={erro} />
  const r = dados.resumo

  return (
    <>
      <Cabecalho sobre={nomeDoMes(mes)} titulo="Planejamento" />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
        <section className="flex flex-col gap-3 rounded-[20px] bg-floresta p-5 text-white lg:w-96 lg:shrink-0">
          <span className="text-sm">Sobra estimada do mês</span>
          <span className="font-titulo text-4xl font-bold">{brl(r.sobraEstimada)}</span>
          <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
            <dt>Renda prevista</dt>
            <dd className="text-right">+ {brl(r.rendaPrevista)}</dd>
            <dt>Contas do mês</dt>
            <dd className="text-right">− {brl(r.contasDoMes)}</dd>
            <dt>Fatura do cartão {dados.faturas[0] && `(vence ${diaMes(dados.faturas[0].vencimento)})`}</dt>
            <dd className="text-right">− {brl(r.faturasCartao)}</dd>
          </dl>
          <span className="text-xs text-[#D5E8DD]">
            Igual à sua planilha: o que entra menos o que já está comprometido. Já caíram {brl(r.rendaRecebida)} da renda prevista.
          </span>
        </section>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Receitas receitas={dados.receitas} aoMudar={recarregar} />
          <Orcamentos orcamentos={dados.orcamentos} categorias={categorias} aoMudar={recarregar} />
        </div>
      </div>
    </>
  )
}

// ---------- receitas ----------

function Receitas({ receitas, aoMudar }: { receitas: Receita[]; aoMudar: () => void }) {
  const [editando, setEditando] = useState<string | 'nova'>()
  const fechar = () => {
    setEditando(undefined)
    aoMudar()
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-suave">Renda do mês</h2>
        <BotaoAdicionar
          rotulo="Nova receita"
          aberto={editando === 'nova'}
          aoAlternar={() => setEditando(editando === 'nova' ? undefined : 'nova')}
        />
      </div>
      {editando === 'nova' && <FormReceita aoSalvar={fechar} aoCancelar={() => setEditando(undefined)} />}
      <Cartao className="px-4">
        {receitas.length === 0 && <p className="py-4 text-sm text-suave">Nenhuma receita cadastrada.</p>}
        {receitas.map((rc, i) => (
          <div key={rc.id} className={i > 0 ? 'border-t border-divisor' : ''}>
            {editando === rc.id ? (
              <div className="py-4">
                <FormReceita receita={rc} aoSalvar={fechar} aoCancelar={() => setEditando(undefined)} />
              </div>
            ) : (
              <div className="flex min-h-16 items-center justify-between gap-3 py-2">
                <span className="flex min-w-0 flex-col">
                  <span className="text-[15px] font-medium">{rc.nome}</span>
                  <span className="text-[13px] text-suave">
                    {rc.recebida
                      ? `caiu em ${diaMes(rc.recebida.data)}: ${brl(rc.recebida.valor)}`
                      : rc.contem
                        ? `ainda não caiu${rc.dia ? ` · costuma cair dia ${rc.dia}` : ''}`
                        : `${rc.dia ? `dia ${rc.dia} · ` : ''}conta não conectada`}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className={`mr-2 text-[15px] font-semibold ${rc.recebida ? 'text-floresta' : ''}`}>{brl(rc.valor)}</span>
                  <button className="h-10 rounded-[10px] px-3 text-sm font-medium text-floresta" onClick={() => setEditando(rc.id)}>
                    Editar
                  </button>
                </span>
              </div>
            )}
          </div>
        ))}
      </Cartao>
    </section>
  )
}

function FormReceita({ receita, aoSalvar, aoCancelar }: { receita?: Receita; aoSalvar: () => void; aoCancelar: () => void }) {
  const [nome, setNome] = useState(receita?.nome ?? '')
  const [valor, setValor] = useState(receita ? String(receita.valor).replace('.', ',') : '')
  const [dia, setDia] = useState(receita?.dia ? String(receita.dia) : '')
  const [contem, setContem] = useState(receita?.contem ?? '')
  const [erro, setErro] = useState<string>()

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api.salvarReceita(
        { nome: nome.trim(), valor: paraNumero(valor), dia: dia ? Number(dia) : undefined, contem: contem.trim() },
        receita?.id,
      )
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function remover() {
    if (!receita || !confirm(`Remover "${receita.nome}" da renda?`)) return
    await api.removerReceita(receita.id)
    aoSalvar()
  }

  return (
    <form onSubmit={salvar} className={`grid gap-3 sm:grid-cols-2 ${receita ? '' : 'rounded-2xl border border-borda bg-white p-4'}`}>
      <Campo rotulo="Nome" valor={nome} aoMudar={setNome} placeholder="Ex.: Salário" />
      <Campo rotulo="Valor (R$)" valor={valor} aoMudar={setValor} inputMode="decimal" />
      <Campo rotulo="Dia em que cai (opcional)" valor={dia} aoMudar={setDia} inputMode="numeric" />
      <Campo rotulo="Como aparece no extrato (opcional)" valor={contem} aoMudar={setContem} placeholder="Ex.: FAPEG" />
      <div className="flex gap-2 sm:col-span-2">
        <button className={`${botaoPrincipal} flex-1`} disabled={!nome.trim() || !(paraNumero(valor) > 0)}>
          Salvar
        </button>
        <button type="button" className="h-11.5 rounded-xl border border-borda-forte px-4 text-sm" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
      {receita && (
        <button type="button" className="justify-self-start text-sm text-ambar-texto" onClick={remover}>
          Remover esta receita
        </button>
      )}
      {erro && (
        <p role="alert" className="text-sm text-ambar-texto sm:col-span-2">
          {erro}
        </p>
      )}
    </form>
  )
}

// ---------- orçamentos ----------

function Orcamentos({ orcamentos, categorias, aoMudar }: { orcamentos: Orcamento[]; categorias: Categoria[]; aoMudar: () => void }) {
  const [editando, setEditando] = useState<string | 'novo'>()
  const fechar = () => {
    setEditando(undefined)
    aoMudar()
  }
  const total = orcamentos.reduce((s, o) => s + o.valorMensal, 0)
  const gasto = orcamentos.reduce((s, o) => s + o.gasto, 0)

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-suave">
          Orçamentos · {brl(gasto)} de {brl(total)}
        </h2>
        <BotaoAdicionar
          rotulo="Novo orçamento"
          aberto={editando === 'novo'}
          aoAlternar={() => setEditando(editando === 'novo' ? undefined : 'novo')}
        />
      </div>
      {editando === 'novo' && <FormOrcamento categorias={categorias} aoSalvar={fechar} aoCancelar={() => setEditando(undefined)} />}
      <Cartao className="flex flex-col px-4">
        {orcamentos.length === 0 && <p className="py-4 text-sm text-suave">Nenhum orçamento ainda.</p>}
        {orcamentos.map((o, i) => {
          const fracao = o.gasto / o.valorMensal
          const estourou = fracao > 1
          return (
            <div key={o.id} className={`py-3 ${i > 0 ? 'border-t border-divisor' : ''}`}>
              {editando === o.id ? (
                <FormOrcamento orcamento={o} categorias={categorias} aoSalvar={fechar} aoCancelar={() => setEditando(undefined)} />
              ) : (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[15px] font-medium">{o.nome}</span>
                    <span className="flex items-baseline gap-2 text-sm">
                      <span className={estourou ? 'font-semibold text-ambar-texto' : ''}>
                        {brl(o.gasto)} <span className="text-suave">de {brl(o.valorMensal)}</span>
                      </span>
                      <button className="font-medium text-floresta" onClick={() => setEditando(o.id)}>
                        Editar
                      </button>
                    </span>
                  </div>
                  <Barra fracao={fracao} cor={estourou ? 'bg-ambar' : fracao > 0.85 ? 'bg-[#C98A2E]' : 'bg-floresta'} />
                  {o.categorias.length > 1 && <span className="text-xs text-suave">{o.categorias.map((c) => c.nome).join(', ')}</span>}
                </div>
              )}
            </div>
          )
        })}
      </Cartao>
    </section>
  )
}

function FormOrcamento({
  orcamento,
  categorias,
  aoSalvar,
  aoCancelar,
}: {
  orcamento?: Orcamento
  categorias: Categoria[]
  aoSalvar: () => void
  aoCancelar: () => void
}) {
  const [nome, setNome] = useState(orcamento?.nome ?? '')
  const [valor, setValor] = useState(orcamento ? String(orcamento.valorMensal).replace('.', ',') : '')
  const [marcadas, setMarcadas] = useState(new Set(orcamento?.categorias.map((c) => c.id) ?? []))
  const [erro, setErro] = useState<string>()
  const deSaida = categorias.filter((c) => c.sentido === 'SAIDA')

  function alternar(id: string) {
    const novo = new Set(marcadas)
    if (novo.has(id)) novo.delete(id)
    else novo.add(id)
    setMarcadas(novo)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api.salvarOrcamento({ nome: nome.trim(), valorMensal: paraNumero(valor), categoriaIds: [...marcadas] }, orcamento?.id)
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function remover() {
    if (!orcamento || !confirm(`Remover o orçamento "${orcamento.nome}"?`)) return
    await api.removerOrcamento(orcamento.id)
    aoSalvar()
  }

  return (
    <form onSubmit={salvar} className={`flex flex-col gap-3 ${orcamento ? '' : 'rounded-2xl border border-borda bg-white p-4'}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Nome" valor={nome} aoMudar={setNome} placeholder="Ex.: Lazer" />
        <Campo rotulo="Limite por mês (R$)" valor={valor} aoMudar={setValor} inputMode="decimal" />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[13px] text-suave">Categorias que entram neste orçamento</legend>
        <div className="flex flex-wrap gap-2">
          {deSaida.map((c) => (
            <label
              key={c.id}
              className={`flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-floresta ${
                marcadas.has(c.id) ? 'border-floresta bg-floresta-clara text-floresta-escura' : 'border-borda-forte bg-white'
              }`}
            >
              <input type="checkbox" className="sr-only" checked={marcadas.has(c.id)} onChange={() => alternar(c.id)} />
              {c.nome}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-2">
        <button className={`${botaoPrincipal} flex-1`} disabled={!nome.trim() || !(paraNumero(valor) > 0) || marcadas.size === 0}>
          Salvar
        </button>
        <button type="button" className="h-11.5 rounded-xl border border-borda-forte px-4 text-sm" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
      {orcamento && (
        <button type="button" className="self-start text-sm text-ambar-texto" onClick={remover}>
          Remover este orçamento
        </button>
      )}
      {erro && (
        <p role="alert" className="text-sm text-ambar-texto">
          {erro}
        </p>
      )}
    </form>
  )
}
