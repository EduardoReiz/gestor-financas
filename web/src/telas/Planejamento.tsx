import { useState } from 'react'
import { Link } from 'react-router'
import { api, useApi, type Planejamento as TPlanejamento, type Receita } from '../api'
import { Cabecalho, Carregando, Cartao } from '../componentes/Base'
import { BotaoAdicionar, Campo, botaoPrincipal } from '../componentes/Formulario'
import { brl, diaMes, mesAtual, nomeDoMes, paraNumero } from '../formatos'

// Planejamento do mês: de onde sai a sobra, linha por linha.
export function Planejamento() {
  const [mes] = useState(mesAtual)
  const { dados, erro, recarregar } = useApi(() => api.planejamento(mes), [mes])

  if (!dados) return <Carregando erro={erro} />

  return (
    <>
      <Cabecalho sobre={nomeDoMes(mes)} titulo="Planejamento" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
        <div className="flex flex-col gap-4 lg:w-[440px] lg:shrink-0">
          <Sobra dados={dados} />
          <CartaoDoMesQueVem dados={dados} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Receitas receitas={dados.receitas} aoMudar={recarregar} />
          <Link to="/limites" className="rounded-2xl border border-borda bg-white p-4 text-sm">
            Os limites de gasto (lanche, mercado, combustível…) estão na tela <b className="text-floresta">Limites</b>.
          </Link>
        </div>
      </div>
    </>
  )
}

function Linha({ rotulo, valor, sinal, explica }: { rotulo: string; valor: number; sinal: '+' | '−' | ''; explica?: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-white/15 py-2.5 first:border-t-0">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>{rotulo}</span>
        <span className="shrink-0 font-semibold">
          {sinal} {brl(valor)}
        </span>
      </div>
      {explica && <span className="text-xs text-[#D5E8DD]">{explica}</span>}
    </div>
  )
}

function Sobra({ dados }: { dados: TPlanejamento }) {
  const s = dados.sobra
  const d = dados.detalhes
  const lista = (itens: { nome: string }[]) => itens.map((i) => i.nome).join(', ')

  return (
    <section className="flex flex-col gap-2 rounded-[20px] bg-floresta p-5 text-white">
      <span className="text-sm">Vai sobrar até o fim do mês</span>
      <span className={`font-titulo text-4xl font-bold ${s.sobraEstimada < 0 ? 'text-[#FFD9A8]' : ''}`}>{brl(s.sobraEstimada)}</span>
      <span className="text-xs text-[#D5E8DD]">se nada mais for gasto além das contas abaixo</span>

      <div className="mt-2 flex flex-col">
        <Linha
          rotulo="Dinheiro nas contas hoje"
          valor={s.saldoHoje}
          sinal=""
          explica="Saldo real dos bancos conectados. O que você já gastou no Pix e no débito já saiu daqui."
        />
        <Linha
          rotulo="Ainda vai cair"
          valor={s.aReceber}
          sinal="+"
          explica={d.aReceber.length ? lista(d.aReceber) : 'Nada mais previsto para este mês.'}
        />
        <Linha
          rotulo="Contas que faltam pagar"
          valor={s.contasEmAberto}
          sinal="−"
          explica={
            d.contasEmAberto.length ? d.contasEmAberto.map((c) => `${c.nome}${c.estimado ? ' (estimada)' : ''}`).join(', ') : 'Todas pagas.'
          }
        />
        <Linha
          rotulo="Fatura do cartão que vence neste mês"
          valor={s.faturaNoMes}
          sinal="−"
          explica={
            d.faturaNoMes.length
              ? d.faturaNoMes.map((f) => `${f.banco}, vence ${diaMes(f.vencimento)}`).join('; ')
              : 'A deste mês já foi paga.'
          }
        />
      </div>

      {d.foraDasContas.length > 0 && (
        <p className="mt-1 rounded-xl bg-white/10 p-3 text-xs">
          Não entram na conta: {lista(d.foraDasContas)}. Elas caem numa conta que não está conectada (Santander), então o app não vê esse
          dinheiro. Conectando o Santander no Meu Pluggy, ele passa a contar.
        </p>
      )}
    </section>
  )
}

// A fatura que está correndo sai do dinheiro do mês que vem: fica à parte.
function CartaoDoMesQueVem({ dados }: { dados: TPlanejamento }) {
  const { faturaSeguinte, cartoes } = dados.detalhes
  if (faturaSeguinte.length === 0 && cartoes.length === 0) return null

  return (
    <Cartao className="flex flex-col gap-3 p-4">
      <h2 className="text-base font-semibold">Cartão: o que já é do mês que vem</h2>
      {faturaSeguinte.map((f) => (
        <div key={f.banco + f.vencimento} className="flex items-baseline justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-sm">Fatura atual {f.banco}</span>
            <span className="text-xs text-suave">
              fecha {diaMes(f.fechamento)} · vence {diaMes(f.vencimento)}
            </span>
          </span>
          <span className="font-titulo text-lg font-bold">{brl(f.total)}</span>
        </div>
      ))}
      {cartoes.map((c) => (
        <div key={c.banco} className="flex flex-col gap-1 border-t border-divisor pt-3 text-sm">
          <div className="flex justify-between">
            <span>
              Limite {c.banco}
              {c.final && ` · final ${c.final}`}
            </span>
            <span className="font-semibold text-floresta">{c.disponivel !== null ? `${brl(c.disponivel)} livres` : ''}</span>
          </div>
          {c.usado !== null && (
            <span className="text-xs text-suave">
              O banco diz {brl(c.usado)} usados de {brl(c.limite)}: isso inclui parcelas que ainda vão cair e compras dos últimos dias.
            </span>
          )}
        </div>
      ))}
    </Cartao>
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
