import { useState } from 'react'
import { api, useApi, type ContaAPagar } from '../api'
import { Barra, Cabecalho, Carregando, Cartao } from '../componentes/Base'
import { BotaoAdicionar, Campo, botaoPrincipal } from '../componentes/Formulario'
import { brl, diaMes, diasAte, mesAtual, nomeDoMes, paraNumero } from '../formatos'

export function Contas() {
  const [mes] = useState(mesAtual)
  const { dados, erro, recarregar } = useApi(() => api.contas(mes), [mes])
  const [criando, setCriando] = useState(false)

  return (
    <>
      <Cabecalho sobre={nomeDoMes(mes)} titulo="Contas a pagar">
        <BotaoAdicionar rotulo="Adicionar conta fixa" aberto={criando} aoAlternar={() => setCriando(!criando)} />
      </Cabecalho>

      {criando && (
        <NovaConta
          aoSalvar={() => {
            setCriando(false)
            recarregar()
          }}
        />
      )}

      {!dados ? (
        <Carregando erro={erro} />
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
          <Cartao className="flex flex-col gap-2 p-4 lg:order-last lg:w-80 lg:p-5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-suave">Ainda falta pagar</span>
              <span className="font-titulo text-[22px] font-bold">{brl(dados.falta)}</span>
            </div>
            <Barra fracao={dados.total ? dados.pago / dados.total : 0} />
            <span className="text-[13px] text-suave">
              {brl(dados.pago)} já pagos de {brl(dados.total)} em contas do mês
            </span>
          </Cartao>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <Lista titulo="A vencer" contas={dados.aVencer} aoMudar={recarregar} vazio="Tudo pago neste mês." />
            {dados.pagas.length > 0 && <Lista titulo="Pagas" contas={dados.pagas} aoMudar={recarregar} />}
          </div>
        </div>
      )}
    </>
  )
}

function prazo(dias: number) {
  if (dias < 0) return { texto: `atrasada ${-dias} ${dias === -1 ? 'dia' : 'dias'}`, perto: true }
  if (dias === 0) return { texto: 'vence hoje', perto: true }
  if (dias === 1) return { texto: 'amanhã', perto: true }
  return { texto: `em ${dias} dias`, perto: dias <= 7 }
}

function Lista({ titulo, contas, aoMudar, vazio }: { titulo: string; contas: ContaAPagar[]; aoMudar: () => void; vazio?: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[13px] font-semibold text-suave">{titulo}</h2>
      <Cartao className="px-4">
        {contas.length === 0 && <p className="py-4 text-sm text-suave">{vazio}</p>}
        {contas.map((c, i) => {
          const paga = !!c.pagaEm
          const p = prazo(diasAte(c.vencimento))
          return (
            <div key={c.id} className={`flex min-h-16 items-center justify-between gap-3 py-2 ${i > 0 ? 'border-t border-divisor' : ''}`}>
              <label className="flex min-w-0 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="size-5 shrink-0 accent-floresta"
                  checked={paga}
                  aria-label={paga ? `Desmarcar ${c.nome} como paga` : `Marcar ${c.nome} como paga`}
                  onChange={() => api.marcarConta(c.id, !paga).then(aoMudar)}
                />
                <span className="flex min-w-0 flex-col">
                  <span className={`text-[15px] ${paga ? '' : 'font-medium'}`}>{c.nome}</span>
                  <span className="text-[13px] text-suave">
                    {paga
                      ? `pago em ${diaMes(c.pagaEm!)}${c.pagaAutomaticamente ? ' · achado no extrato' : ''}`
                      : `vence ${diaMes(c.vencimento)}${c.formaPagamento ? ` · ${c.formaPagamento}` : ''}`}
                  </span>
                </span>
              </label>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className={`text-[15px] ${paga ? 'text-suave' : 'font-semibold'}`}>{brl(c.valor)}</span>
                {!paga && (
                  <span
                    className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${
                      p.perto ? 'bg-ambar-claro text-ambar-texto' : 'bg-divisor text-suave'
                    }`}
                  >
                    {p.texto}
                  </span>
                )}
              </span>
            </div>
          )
        })}
      </Cartao>
    </section>
  )
}

function NovaConta({ aoSalvar }: { aoSalvar: () => void }) {
  const [nome, setNome] = useState('')
  const [valor, setValor] = useState('')
  const [dia, setDia] = useState('10')
  const [forma, setForma] = useState('Pix')
  const [erro, setErro] = useState<string>()

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api.novaContaFixa({ nome, valorPrevisto: paraNumero(valor), diaVencimento: Number(dia), formaPagamento: forma })
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  return (
    <form onSubmit={salvar} className="mb-4 grid gap-3 rounded-2xl border border-borda bg-white p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
      <Campo rotulo="Nome" valor={nome} aoMudar={setNome} placeholder="Ex.: Internet" className="lg:col-span-2" />
      <Campo rotulo="Valor (R$)" valor={valor} aoMudar={setValor} placeholder="99,90" inputMode="decimal" />
      <Campo rotulo="Dia do vencimento" valor={dia} aoMudar={setDia} inputMode="numeric" />
      <Campo rotulo="Como paga" valor={forma} aoMudar={setForma} placeholder="Pix, boleto, débito..." />
      <button className={`${botaoPrincipal} sm:col-span-2 lg:col-span-5`} disabled={!nome.trim() || !(paraNumero(valor) > 0)}>
        Salvar conta fixa
      </button>
      {erro && <p role="alert" className="text-sm text-ambar-texto sm:col-span-2 lg:col-span-5">{erro}</p>}
    </form>
  )
}
