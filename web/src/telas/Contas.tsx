import { useState } from 'react'
import { api, useApi, type ContaAPagar } from '../api'
import { Barra, Cabecalho, Carregando, Cartao } from '../componentes/Base'
import { brl, diaMes, diasAte, mesAtual, nomeDoMes, paraNumero } from '../formatos'
import { Campo, botaoPrincipal } from '../componentes/Formulario'
import { useSearchParams } from 'react-router'
import { Codigos } from './Codigos'
import { ContasFixas } from './ContasFixas'

export function Contas() {
  const [mes] = useState(mesAtual)
  const { dados, erro, recarregar } = useApi(() => api.contas(mes), [mes])
  // /contas?aba=codigos abre direto numa aba (vem dos avisos)
  const [parametros, setParametros] = useSearchParams()
  const aba = (['codigos', 'fixas'] as const).find((a) => a === parametros.get('aba')) ?? 'mes'
  const irPara = (nova: 'mes' | 'codigos' | 'fixas') => setParametros(nova === 'mes' ? {} : { aba: nova })
  const comCodigo = dados?.aVencer.filter((c) => c.temCodigo).length ?? 0

  return (
    <>
      <Cabecalho sobre={nomeDoMes(mes)} titulo="Contas a pagar" />

      <div role="tablist" aria-label="Contas a pagar" className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-[#E3E8E6] p-1 lg:max-w-xl">
        {(
          [
            ['mes', 'Do mês'],
            ['codigos', 'Códigos'],
            ['fixas', 'Contas fixas'],
          ] as const
        ).map(([valor, nome]) => (
          <button
            key={valor}
            role="tab"
            aria-selected={aba === valor}
            onClick={() => irPara(valor)}
            className={`h-10 rounded-[9px] text-sm ${aba === valor ? 'bg-white font-semibold' : 'text-suave'}`}
          >
            {nome}
          </button>
        ))}
      </div>

      {aba === 'codigos' ? (
        <Codigos aoMudar={recarregar} />
      ) : aba === 'fixas' ? (
        <ContasFixas aoMudar={recarregar} />
      ) : (
        <>
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
                {comCodigo > 0 && (
                  <button
                    onClick={() => irPara('codigos')}
                    className="rounded-xl bg-floresta-clara px-4 py-3 text-left text-sm text-floresta-escura"
                  >
                    {comCodigo === 1 ? '1 conta já tem' : `${comCodigo} contas já têm`} o Pix ou boleto guardado. <b>Ver códigos</b>
                  </button>
                )}
                <Lista titulo="A vencer" contas={dados.aVencer} aoMudar={recarregar} vazio="Tudo pago neste mês." />
                {dados.pagas.length > 0 && <Lista titulo="Pagas" contas={dados.pagas} aoMudar={recarregar} />}
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}

function prazo(dias: number) {
  if (dias < 0)
    return {
      texto: `atrasada ${-dias} ${dias === -1 ? 'dia' : 'dias'}`,
      perto: true,
    }
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
        {contas.map((c, i) => (
          <LinhaConta key={c.id} conta={c} primeira={i === 0} aoMudar={aoMudar} />
        ))}
      </Cartao>
    </section>
  )
}

function LinhaConta({ conta: c, primeira, aoMudar }: { conta: ContaAPagar; primeira: boolean; aoMudar: () => void }) {
  const [informando, setInformando] = useState(false)
  const [valor, setValor] = useState('')
  const paga = !!c.pagaEm
  const p = prazo(diasAte(c.vencimento))

  async function informar(e: React.FormEvent) {
    e.preventDefault()
    await api.informarValorConta(c.id, paraNumero(valor))
    setInformando(false)
    aoMudar()
  }

  return (
    <div className={primeira ? '' : 'border-t border-divisor'}>
      <div className="flex min-h-16 items-center justify-between gap-3 py-2">
        <label className="flex min-w-0 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            className="size-5 shrink-0 accent-floresta"
            checked={paga}
            aria-label={paga ? `Desmarcar ${c.nome} como paga` : `Marcar ${c.nome} como paga`}
            onChange={() => api.marcarConta(c.id, !paga).then(aoMudar)}
          />
          <span className="flex min-w-0 flex-col">
            <span className={`text-[15px] ${paga ? '' : 'font-medium'}`}>
              {c.nome}
              {c.temCodigo && !paga && (
                <span className="ml-2 rounded-md bg-floresta-clara px-1.5 py-0.5 text-[11px] font-semibold text-floresta-escura">
                  código
                </span>
              )}
            </span>
            <span className="text-[13px] text-suave">
              {paga
                ? `pago em ${diaMes(c.pagaEm!)}${c.pagaAutomaticamente ? ' · achado no extrato' : ''}`
                : `vence ${diaMes(c.vencimento)}${c.formaPagamento ? ` · ${c.formaPagamento}` : ''}`}
            </span>
          </span>
        </label>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className={`text-[15px] ${paga ? 'text-suave' : c.estimado ? 'font-semibold text-suave' : 'font-semibold'}`}>
            {c.estimado && '~ '}
            {brl(c.valor)}
          </span>
          {c.estimado ? (
            <button className="text-xs font-semibold text-floresta" onClick={() => setInformando(!informando)}>
              estimado · informar valor
            </button>
          ) : (
            !paga && (
              <span
                className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${p.perto ? 'bg-ambar-claro text-ambar-texto' : 'bg-divisor text-suave'}`}
              >
                {p.texto}
              </span>
            )
          )}
        </span>
      </div>
      {informando && (
        <form onSubmit={informar} className="mb-3 flex items-end gap-2">
          <Campo rotulo={`Valor de ${c.nome} este mês (R$)`} valor={valor} aoMudar={setValor} inputMode="decimal" className="flex-1" />
          <button className={botaoPrincipal} disabled={!(paraNumero(valor) > 0)}>
            Salvar
          </button>
        </form>
      )}
    </div>
  )
}
