import { useState } from 'react'
import { api, useApi, type ContaFixa } from '../api'
import { Carregando, Cartao } from '../componentes/Base'
import { BotaoAdicionar, Campo, botaoPrincipal } from '../componentes/Formulario'
import { brl, paraNumero } from '../formatos'

// Aba "Contas fixas": o molde de cada conta que se repete todo mês.
export function ContasFixas({ aoMudar }: { aoMudar: () => void }) {
  const { dados, erro, recarregar } = useApi(api.contasFixas, [])
  const [criando, setCriando] = useState(false)
  const [editandoId, setEditandoId] = useState<string>()

  const atualizar = () => {
    setCriando(false)
    setEditandoId(undefined)
    recarregar()
    aoMudar()
  }

  async function parar(f: ContaFixa) {
    if (!confirm(`Parar de controlar "${f.nome}"? Ela some deste mês em diante; os meses pagos continuam no histórico.`)) return
    await api.desativarContaFixa(f.id)
    atualizar()
  }

  const total = dados?.reduce((s, f) => s + f.valorPrevisto, 0) ?? 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-suave">{dados ? `${dados.length} contas · ${brl(total)} por mês` : ''}</span>
        <BotaoAdicionar rotulo="Nova conta fixa" aberto={criando} aoAlternar={() => setCriando(!criando)} />
      </div>

      {criando && <FormContaFixa aoSalvar={atualizar} aoCancelar={() => setCriando(false)} />}

      {!dados ? (
        <Carregando erro={erro} />
      ) : dados.length === 0 ? (
        <p className="rounded-2xl border border-borda bg-white p-4 text-sm text-suave">Nenhuma conta fixa ainda.</p>
      ) : (
        <Cartao className="px-4">
          {dados.map((f, i) => (
            <div key={f.id} className={i > 0 ? 'border-t border-divisor' : ''}>
              {editandoId === f.id ? (
                <div className="py-4">
                  <FormContaFixa conta={f} aoSalvar={atualizar} aoCancelar={() => setEditandoId(undefined)} />
                </div>
              ) : (
                <div className="flex min-h-16 items-center justify-between gap-3 py-2">
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[15px] font-medium">{f.nome}</span>
                    <span className="text-[13px] text-suave">
                      dia {f.diaVencimento} · {f.formaPagamento}
                      {f.contem && ` · no extrato: ${f.contem}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className="mr-2 text-[15px] font-semibold">{brl(f.valorPrevisto)}</span>
                    <button className="h-10 rounded-[10px] px-3 text-sm font-medium text-floresta" onClick={() => setEditandoId(f.id)}>
                      Editar
                    </button>
                  </span>
                </div>
              )}
              {editandoId === f.id && (
                <button className="mb-3 text-sm text-ambar-texto" onClick={() => parar(f)}>
                  Parar de controlar esta conta
                </button>
              )}
            </div>
          ))}
        </Cartao>
      )}
      <p className="text-xs text-suave">
        Mudar o valor ou o dia vale para este mês (se ainda não foi pago) e para os próximos. Os meses já pagos não mudam.
      </p>
    </div>
  )
}

// O mesmo formulário cria (sem "conta") e edita (com "conta").
function FormContaFixa({ conta, aoSalvar, aoCancelar }: { conta?: ContaFixa; aoSalvar: () => void; aoCancelar: () => void }) {
  const [nome, setNome] = useState(conta?.nome ?? '')
  const [valor, setValor] = useState(conta ? String(conta.valorPrevisto).replace('.', ',') : '')
  const [dia, setDia] = useState(String(conta?.diaVencimento ?? 10))
  const [forma, setForma] = useState(conta?.formaPagamento ?? 'Pix')
  const [contem, setContem] = useState(conta?.contem ?? '')
  const [erro, setErro] = useState<string>()

  const diaNumero = Number(dia)
  const valido = nome.trim() && paraNumero(valor) > 0 && Number.isInteger(diaNumero) && diaNumero >= 1 && diaNumero <= 31

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const dados = {
      nome: nome.trim(),
      valorPrevisto: paraNumero(valor),
      diaVencimento: diaNumero,
      formaPagamento: forma.trim() || 'Pix',
      contem: contem.trim(),
    }
    try {
      if (conta) await api.editarContaFixa(conta.id, dados)
      else await api.novaContaFixa({ ...dados, contem: dados.contem || undefined })
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  return (
    <form
      onSubmit={salvar}
      className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end ${conta ? '' : 'rounded-2xl border border-borda bg-white p-4'}`}
    >
      <Campo rotulo="Nome" valor={nome} aoMudar={setNome} placeholder="Ex.: Internet" className="lg:col-span-2" />
      <Campo rotulo="Valor (R$)" valor={valor} aoMudar={setValor} placeholder="99,90" inputMode="decimal" />
      <Campo rotulo="Dia do vencimento" valor={dia} aoMudar={setDia} inputMode="numeric" />
      <Campo rotulo="Como paga" valor={forma} aoMudar={setForma} placeholder="Pix, boleto, débito..." />
      <Campo
        rotulo="Como aparece no extrato (opcional)"
        valor={contem}
        aoMudar={setContem}
        placeholder="Ex.: EQUATORIAL"
        className="sm:col-span-2 lg:col-span-5"
      />
      <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
        <button className={`${botaoPrincipal} flex-1`} disabled={!valido}>
          {conta ? 'Salvar alterações' : 'Salvar conta fixa'}
        </button>
        <button type="button" className="h-11.5 rounded-xl border border-borda-forte px-4 text-sm" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
      {erro && (
        <p role="alert" className="text-sm text-ambar-texto sm:col-span-2 lg:col-span-5">
          {erro}
        </p>
      )}
    </form>
  )
}
