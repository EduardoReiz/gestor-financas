import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { api, useApi, type Cobranca, type CodigoConferido } from '../api'
import { Carregando, Cartao } from '../componentes/Base'
import { botaoPrincipal } from '../componentes/Formulario'
import { brl, diaMes, diasAte } from '../formatos'
import { codigosNoArquivo } from '../leitorDeArquivo'

const NOME_TIPO = { PIX: 'Pix', BOLETO: 'Boleto', CONCESSIONARIA: 'Conta de consumo' } as const
const campo = 'rounded-xl border border-borda-forte bg-white px-3.5 text-[15px] text-tinta'

// Aba "Códigos para pagar" dentro de Contas a pagar.
export function Codigos({ aoMudar }: { aoMudar: () => void }) {
  const { dados, erro, recarregar } = useApi(api.cobrancas, [])
  const atualizar = () => {
    recarregar()
    aoMudar()
  }

  const pendentes = dados?.filter((c) => !c.pagaEm) ?? []
  const pagas = dados?.filter((c) => c.pagaEm) ?? []

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
      <div className="order-last lg:w-[380px] lg:shrink-0">
        <AdicionarCodigo aoSalvar={atualizar} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {!dados ? (
          <Carregando erro={erro} />
        ) : (
          <>
            <section className="flex flex-col gap-2">
              <h2 className="text-[13px] font-semibold text-suave">Para pagar</h2>
              {pendentes.length === 0 && (
                <p className="rounded-2xl border border-borda bg-white p-4 text-sm text-suave">
                  Nenhum código pendente. Cole um Pix ou boleto ao lado quando chegar uma conta.
                </p>
              )}
              {pendentes.map((c) => (
                <CartaoCodigo key={c.id} cobranca={c} aoMudar={atualizar} />
              ))}
            </section>

            {pagas.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="text-[13px] font-semibold text-suave">Pagos nos últimos 30 dias</h2>
                <Cartao className="px-4">
                  {pagas.map((c, i) => (
                    <div key={c.id} className={`flex min-h-14 items-center justify-between gap-3 ${i > 0 ? 'border-t border-divisor' : ''}`}>
                      <span className="flex flex-col">
                        <span className="text-[15px]">{c.titulo}</span>
                        <span className="text-[13px] text-suave">
                          pago em {diaMes(c.pagaEm!)}{c.pagaAutomaticamente ? ' · achado no extrato' : ''}
                        </span>
                      </span>
                      <span className="text-[15px] text-suave">{c.valor !== null ? brl(c.valor) : ''}</span>
                    </div>
                  ))}
                </Cartao>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function CartaoCodigo({ cobranca: c, aoMudar }: { cobranca: Cobranca; aoMudar: () => void }) {
  const [qr, setQr] = useState<string>()
  const [mostrarQr, setMostrarQr] = useState(false)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (mostrarQr && !qr) QRCode.toDataURL(c.codigo, { margin: 1, width: 260 }).then(setQr)
  }, [mostrarQr, qr, c.codigo])

  async function copiar() {
    await navigator.clipboard.writeText(c.codigo)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  const dias = c.vencimento ? diasAte(c.vencimento) : null
  const urgente = dias !== null && dias <= 3

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-borda bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs font-semibold text-suave">{NOME_TIPO[c.tipo]}</span>
          <h3 className="text-base font-semibold">{c.titulo}</h3>
          {c.recebedor && <span className="text-[13px] text-suave">recebedor: {c.recebedor}</span>}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-titulo text-xl font-bold">{c.valor !== null ? brl(c.valor) : 'valor no app'}</span>
          {c.vencimento && (
            <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${urgente ? 'bg-ambar-claro text-ambar-texto' : 'bg-divisor text-suave'}`}>
              {dias! < 0 ? `venceu ${diaMes(c.vencimento)}` : dias === 0 ? 'vence hoje' : `vence ${diaMes(c.vencimento)}`}
            </span>
          )}
        </span>
      </div>

      {mostrarQr && (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-fundo p-4">
          {qr ? <img src={qr} alt={`QR code do Pix de ${c.titulo}`} className="size-52 rounded-lg bg-white p-2" /> : <span className="text-sm">Gerando…</span>}
          <span className="text-center text-xs text-suave">Abra o app do banco no celular e escaneie</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button className={`${botaoPrincipal} flex-1`} onClick={copiar}>
          {copiado ? 'Copiado!' : c.tipo === 'PIX' ? 'Copiar Pix copia e cola' : 'Copiar código do boleto'}
        </button>
        {c.tipo === 'PIX' && (
          <button className="h-11.5 rounded-xl border border-borda-forte px-4 text-sm font-medium" onClick={() => setMostrarQr(!mostrarQr)}>
            {mostrarQr ? 'Esconder QR' : 'Mostrar QR'}
          </button>
        )}
      </div>
      <div className="flex justify-between text-sm">
        <button className="py-2 font-medium text-floresta" onClick={() => api.marcarCobranca(c.id, true).then(aoMudar)}>
          Já paguei
        </button>
        <button
          className="py-2 text-suave"
          onClick={() => confirm(`Apagar o código de "${c.titulo}"?`) && api.removerCobranca(c.id).then(aoMudar)}
        >
          Apagar
        </button>
      </div>
    </section>
  )
}

function AdicionarCodigo({ aoSalvar }: { aoSalvar: () => void }) {
  const { dados: fixas = [] } = useApi(api.contasFixas, [])
  const [texto, setTexto] = useState('')
  const [lendo, setLendo] = useState(false)
  const [lido, setLido] = useState<CodigoConferido>()
  const [contaFixaId, setContaFixaId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState<string>()
  const [aviso, setAviso] = useState<string>()

  async function conferir(codigo: string) {
    setErro(undefined)
    setAviso(undefined)
    try {
      const resultado = await api.conferirCodigo(codigo)
      setLido(resultado)
      setContaFixaId(resultado.contaFixaSugerida ?? '')
    } catch (e) {
      setLido(undefined)
      setErro((e as Error).message)
    }
  }

  async function lerArquivo(arquivo?: File) {
    if (!arquivo) return
    setLendo(true)
    setErro(undefined)
    try {
      const achados = await codigosNoArquivo(arquivo)
      if (achados.length === 0) throw new Error('Não achei nenhum código nesse arquivo. Tente colar o código.')
      setTexto(achados[0])
      await conferir(achados[0])
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLendo(false)
    }
  }

  async function salvar() {
    if (!lido) return
    try {
      const r = await api.novaCobranca({ codigo: lido.codigo, contaFixaId: contaFixaId || undefined, descricao: descricao || undefined })
      setLido(undefined)
      setTexto('')
      setDescricao('')
      setAviso(r.aviso ?? undefined)
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  return (
    <Cartao className="flex flex-col gap-3 p-4">
      <h2 className="text-base font-semibold">Adicionar código</h2>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] text-suave">Cole o Pix copia e cola ou a linha digitável</span>
        <textarea
          className={`${campo} min-h-24 py-2.5 font-mono text-[13px] break-all`}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="00020126… ou 34191.79001 01043.510047…"
        />
      </label>
      <div className="flex gap-2">
        <button className={`${botaoPrincipal} flex-1`} disabled={!texto.trim()} onClick={() => conferir(texto)}>
          Ler código
        </button>
        <label className="flex h-11.5 cursor-pointer items-center rounded-xl border border-borda-forte px-4 text-sm font-medium">
          {lendo ? 'Lendo…' : 'Print ou PDF'}
          <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => lerArquivo(e.target.files?.[0])} />
        </label>
      </div>

      {erro && <p role="alert" className="rounded-xl bg-ambar-claro p-3 text-sm text-ambar-texto">{erro}</p>}

      {aviso && (
        <p role="alert" className="rounded-xl border-2 border-ambar bg-ambar-claro p-3 text-sm font-semibold text-ambar-texto">
          {aviso}
        </p>
      )}

      {lido && (
        <div className="flex flex-col gap-3 rounded-xl bg-fundo p-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-suave">Tipo</dt>
            <dd>{NOME_TIPO[lido.tipo]}</dd>
            <dt className="text-suave">Valor</dt>
            <dd className="font-semibold">{lido.valor !== null ? brl(lido.valor) : 'não vem no código'}</dd>
            {lido.vencimento && (
              <>
                <dt className="text-suave">Vencimento</dt>
                <dd>{diaMes(lido.vencimento)}</dd>
              </>
            )}
            {lido.recebedor && (
              <>
                <dt className="text-suave">Recebedor</dt>
                <dd className="font-semibold">{lido.recebedor}</dd>
              </>
            )}
          </dl>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-suave">É de qual conta? (opcional)</span>
            <select className={`${campo} h-11`} value={contaFixaId} onChange={(e) => setContaFixaId(e.target.value)}>
              <option value="">Nenhuma, é avulsa</option>
              {fixas.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </label>
          {!contaFixaId && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] text-suave">Nome para lembrar</span>
              <input className={`${campo} h-11`} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Boleto da escola" />
            </label>
          )}
          <button className={botaoPrincipal} onClick={salvar}>Guardar para pagar</button>
        </div>
      )}
    </Cartao>
  )
}
