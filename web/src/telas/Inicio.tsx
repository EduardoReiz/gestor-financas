import { useState } from 'react'
import { Link } from 'react-router'
import { api, useApi } from '../api'
import { Barra, Cabecalho, Carregando, Cartao } from '../componentes/Base'
import { IconeAvancar, IconeLampada, IconeVoltar } from '../componentes/Icones'
import { brl, diaMes, diasAte, horaDe, mesAtual, mesCurto, nomeDoMes } from '../formatos'

function mudarMes(mes: string, delta: number) {
  const [ano, m] = mes.split('-').map(Number)
  const d = new Date(ano, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function Inicio() {
  const [mes, setMes] = useState(mesAtual)
  const { dados: r, erro } = useApi(() => api.resumo(mes), [mes])

  const botaoMes = 'flex size-11 items-center justify-center rounded-xl border border-borda-forte bg-white'

  return (
    <>
      <Cabecalho sobre={nomeDoMes(mes)} titulo="Início">
        <div className="flex gap-2">
          <Link to="/ajustes" className={`${botaoMes} lg:hidden`} aria-label="Ajustes">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </Link>
          <button className={botaoMes} aria-label="Mês anterior" onClick={() => setMes(mudarMes(mes, -1))}>
            <IconeVoltar width={18} height={18} />
          </button>
          <button className={botaoMes} aria-label="Próximo mês" onClick={() => setMes(mudarMes(mes, 1))}>
            <IconeAvancar width={18} height={18} />
          </button>
        </div>
      </Cabecalho>

      {!r ? (
        <Carregando erro={erro} />
      ) : (
        <div className="flex flex-col gap-4 lg:gap-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <section className="col-span-2 flex flex-col gap-1.5 rounded-[20px] bg-floresta p-5 text-white lg:col-span-1">
              <span className="text-sm">Saldo nas contas</span>
              <span className="font-titulo text-4xl font-bold lg:text-[30px]">{brl(r.saldoContas)}</span>
              {r.atualizadoEm && (
                <span className="text-[13px]">Atualizado às {horaDe(r.atualizadoEm)}</span>
              )}
            </section>
            <Numero rotulo="Entradas no mês" valor={`+ ${brl(r.entradas)}`} cor="text-floresta" />
            <Numero rotulo="Saídas no mês" valor={`− ${brl(r.saidas)}`} />
            <Link to="/cartoes" className="col-span-2 lg:col-span-1">
              <Numero
                rotulo="Faturas abertas"
                valor={brl(r.faturasAbertas.reduce((s, f) => s + f.total, 0))}
              />
            </Link>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
            <div className="flex min-w-0 flex-col gap-4 lg:flex-[3] lg:gap-5">
              <GraficoMeses meses={r.saidasUltimosMeses} />
              <PorCategoria categorias={r.porCategoria} />
            </div>

            <div className="flex min-w-0 flex-col gap-4 lg:flex-[2] lg:gap-5">
              {r.sugestao && (
                <Link to="/sugestoes" className="flex gap-3 rounded-2xl bg-ambar-claro p-4">
                  <IconeLampada className="mt-0.5 shrink-0 text-ambar-texto" />
                  <span className="flex flex-col gap-1">
                    <span className="text-[15px] font-semibold">{r.sugestao.titulo}</span>
                    <span className="text-sm text-suave">{r.sugestao.texto}</span>
                    <span className="text-sm font-semibold text-ambar-texto">Ver sugestões</span>
                  </span>
                </Link>
              )}

              <Cartao className="px-4 pt-1">
                <div className="flex items-baseline justify-between pt-3 pb-1">
                  <h2 className="text-base font-semibold">Faturas abertas</h2>
                </div>
                {r.faturasAbertas.map((f) => (
                  <Link key={f.id} to="/cartoes" className="flex min-h-13 items-center justify-between border-t border-divisor">
                    <span className="flex flex-col">
                      <span className="text-[15px] font-medium">{f.banco}</span>
                      <span className="text-[13px] text-suave">vence {diaMes(f.vencimento)}</span>
                    </span>
                    <span className="text-[15px] font-medium">{brl(f.total)}</span>
                  </Link>
                ))}
              </Cartao>

              <Cartao className="px-4 pt-1">
                <h2 className="pt-3 pb-1 text-base font-semibold">A vencer</h2>
                {r.proximasContas.length === 0 && (
                  <p className="border-t border-divisor py-4 text-sm text-suave">Nada para pagar nos próximos dias.</p>
                )}
                {r.proximasContas.map((c) => (
                  <div key={c.id} className="flex min-h-14 items-center justify-between border-t border-divisor">
                    <span className="flex flex-col">
                      <span className="text-[15px] font-medium">{c.nome}</span>
                      <span className="text-[13px] text-suave">
                        {diaMes(c.vencimento)} · {prazo(diasAte(c.vencimento))}
                      </span>
                    </span>
                    <span className="text-[15px] font-semibold">{brl(c.valor)}</span>
                  </div>
                ))}
              </Cartao>

              <Cartao className="flex flex-col gap-3.5 p-4">
                <h2 className="text-base font-semibold">Metas</h2>
                {r.metas.map((m) => (
                  <div key={m.id} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-sm">
                      <span>{m.nome}</span>
                      <span className="text-suave">{Math.round((m.guardado / m.alvo) * 100)}%</span>
                    </div>
                    <Barra fracao={m.guardado / m.alvo} />
                  </div>
                ))}
              </Cartao>

              <Link to="/investimentos" className="flex items-center justify-between rounded-2xl border border-borda bg-white p-4">
                <span className="flex flex-col gap-0.5">
                  <span className="text-[13px] text-suave">Investimentos</span>
                  <span className="font-titulo text-xl font-bold">{brl(r.investimentos.total)}</span>
                </span>
                <span className="text-[13px] font-semibold text-floresta">
                  + {brl(r.investimentos.rendimentoNoMes)} no mês
                </span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function prazo(dias: number) {
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'amanhã'
  return `em ${dias} dias`
}

function Numero({ rotulo, valor, cor = '' }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div className="flex h-full flex-col gap-1 rounded-2xl border border-borda bg-white p-3.5 lg:p-5">
      <span className="text-[13px] text-suave lg:text-sm">{rotulo}</span>
      <span className={`font-titulo text-xl font-bold lg:text-[26px] ${cor}`}>{valor}</span>
    </div>
  )
}

function GraficoMeses({ meses }: { meses: { mes: string; total: number }[] }) {
  if (meses.length === 0) return null
  const maior = Math.max(...meses.map((m) => m.total))
  const media = meses.reduce((s, m) => s + m.total, 0) / meses.length
  const descricao = meses.map((m) => `${mesCurto(m.mes)} ${brl(m.total)}`).join(', ')

  return (
    <Cartao className="hidden flex-col gap-4 p-5 lg:flex">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[17px] font-semibold">Saídas nos últimos meses</h2>
        <span className="text-[13px] text-suave">média {brl(Math.round(media))}</span>
      </div>
      <div role="img" aria-label={`Saídas por mês: ${descricao}`} className="flex h-50 items-end gap-4">
        {meses.map((m, i) => {
          const atual = i === meses.length - 1
          return (
            <div key={m.mes} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className="text-xs text-suave">{brl(Math.round(m.total)).replace(',00', '')}</span>
              <div
                className={`w-full max-w-14 rounded-t-lg ${atual ? 'bg-floresta' : 'bg-[#A9CDB9]'}`}
                style={{ height: `${(m.total / maior) * 150}px` }}
              />
              <span className={`text-[13px] ${atual ? 'font-semibold' : 'text-suave'}`}>{mesCurto(m.mes)}</span>
            </div>
          )
        })}
      </div>
    </Cartao>
  )
}

function PorCategoria({ categorias }: { categorias: { categoria: string; valor: number }[] }) {
  const maior = categorias[0]?.valor ?? 1
  return (
    <Cartao className="flex flex-col gap-3.5 p-4 lg:p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold lg:text-[17px]">Para onde foi o dinheiro</h2>
        <Link to="/extrato" className="py-3 text-[13px] font-medium text-floresta lg:py-0 lg:text-sm">
          Ver extrato
        </Link>
      </div>
      {categorias.length === 0 && <p className="text-sm text-suave">Nenhuma saída neste mês.</p>}
      {categorias.map((c) => (
        <div key={c.categoria} className="flex flex-col gap-1.5 lg:grid lg:grid-cols-[160px_1fr_110px] lg:items-center lg:gap-4">
          <div className="flex justify-between text-sm lg:contents">
            <span>{c.categoria}</span>
            <span className="font-medium lg:order-last lg:text-right">{brl(c.valor)}</span>
          </div>
          <Barra fracao={c.valor / maior} />
        </div>
      ))}
    </Cartao>
  )
}
