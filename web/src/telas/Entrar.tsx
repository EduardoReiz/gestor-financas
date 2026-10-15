import { useState } from 'react'
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser'
import { auth } from '../api'
import { IconeBroto } from '../componentes/Icones'

// Nome sugerido para o aparelho, para você reconhecer depois na lista.
export function nomeDoAparelho() {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Macintosh/.test(ua)) return 'Mac'
  if (/Android/.test(ua)) return 'Android'
  return 'Computador'
}

// O navegador cancela quando você fecha o Face ID: não é erro, é só "não".
export function mensagemDeErro(e: unknown) {
  const erro = e as Error
  if (erro?.name === 'NotAllowedError') return 'Cancelado. Tente de novo quando quiser.'
  return erro?.message ?? 'Algo deu errado.'
}

const botao = 'flex h-[54px] items-center justify-center gap-2.5 rounded-2xl bg-floresta text-base font-semibold text-white disabled:opacity-60'
const campo = 'h-12 rounded-xl border border-borda-forte bg-white px-3.5 text-base text-tinta'

export function Entrar({ primeiroAcesso, aoEntrar }: { primeiroAcesso: boolean; aoEntrar: () => void }) {
  const [codigo, setCodigo] = useState('')
  const [aparelho, setAparelho] = useState(nomeDoAparelho)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string>()

  async function entrar() {
    setOcupado(true)
    setErro(undefined)
    try {
      const opcoes = await auth.opcoesEntrada()
      await auth.verificarEntrada(await startAuthentication({ optionsJSON: opcoes }))
      aoEntrar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setOcupado(false)
    }
  }

  async function cadastrar() {
    setOcupado(true)
    setErro(undefined)
    try {
      const opcoes = await auth.opcoesCadastro(codigo)
      await auth.verificarCadastro(await startRegistration({ optionsJSON: opcoes }), aparelho)
      aoEntrar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setOcupado(false)
    }
  }

  const semSuporte = !browserSupportsWebAuthn()

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-between px-7 pt-10 pb-12">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <span className="flex size-[72px] items-center justify-center rounded-[22px] bg-floresta text-white">
          <IconeBroto width={36} height={36} />
        </span>
        <h1 className="font-titulo text-[28px] font-bold">GestorDeFinanças</h1>
        <p className="max-w-[260px] text-[15px] text-suave">
          {primeiroAcesso
            ? 'Primeiro acesso: cadastre este aparelho para entrar com Face ID ou Touch ID.'
            : 'Seu dinheiro, num lugar só. Os dados ficam no seu servidor.'}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {semSuporte && (
          <p role="alert" className="rounded-xl bg-ambar-claro p-3 text-sm text-ambar-texto">
            Este navegador não aceita passkeys. Use o Safari no iPhone ou o Chrome/Safari no Mac.
          </p>
        )}

        {primeiroAcesso ? (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] text-suave">Código de cadastro (está no .env do servidor)</span>
              <input
                className={`${campo} font-mono tracking-widest uppercase`}
                value={codigo}
                autoComplete="off"
                autoCapitalize="characters"
                onChange={(e) => setCodigo(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] text-suave">Nome deste aparelho</span>
              <input className={campo} value={aparelho} onChange={(e) => setAparelho(e.target.value)} />
            </label>
            <button className={botao} disabled={ocupado || semSuporte || !codigo.trim()} onClick={cadastrar}>
              Cadastrar este aparelho
            </button>
          </>
        ) : (
          <button className={botao} disabled={ocupado || semSuporte} onClick={entrar}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
              <path d="M9 9.5v1M15 9.5v1M12 9.5v3.5h-1M9.5 15.5c1.4 1 3.6 1 5 0" />
            </svg>
            Entrar com Face ID
          </button>
        )}

        {erro && <p role="alert" className="text-center text-sm text-ambar-texto">{erro}</p>}

        <p className="flex items-center justify-center gap-1.5 text-[13px] text-suave">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          Só abre nos seus aparelhos, pela rede Tailscale
        </p>
      </div>
    </div>
  )
}
