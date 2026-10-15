import { useState } from 'react'
import { startRegistration } from '@simplewebauthn/browser'
import { auth, useApi } from '../api'
import { Cabecalho, Carregando, Cartao } from '../componentes/Base'
import { mensagemDeErro, nomeDoAparelho } from './Entrar'

const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export function Aparelhos({ aoSair }: { aoSair: () => void }) {
  const { dados: aparelhos, erro, recarregar } = useApi(auth.aparelhos, [])
  const [nome, setNome] = useState(nomeDoAparelho)
  const [aviso, setAviso] = useState<string>()

  async function cadastrarEste() {
    setAviso(undefined)
    try {
      const opcoes = await auth.opcoesCadastro()
      await auth.verificarCadastro(await startRegistration({ optionsJSON: opcoes }), nome)
      setAviso('Aparelho cadastrado.')
      recarregar()
    } catch (e) {
      setAviso(mensagemDeErro(e))
    }
  }

  async function remover(id: string, nomeAparelho: string) {
    if (!confirm(`Remover "${nomeAparelho}"? Ele não vai mais conseguir entrar.`)) return
    try {
      await auth.removerAparelho(id)
      recarregar()
    } catch (e) {
      setAviso(mensagemDeErro(e))
    }
  }

  return (
    <>
      <Cabecalho sobre="Quem pode entrar no app" titulo="Aparelhos">
        <button
          className="h-11 rounded-xl border border-borda-forte bg-white px-4 text-sm font-medium"
          onClick={() => auth.sair().finally(aoSair)}
        >
          Sair
        </button>
      </Cabecalho>

      <div className="flex max-w-2xl flex-col gap-4">
        {!aparelhos ? (
          <Carregando erro={erro} />
        ) : (
          <Cartao className="px-4">
            {aparelhos.map((a, i) => (
              <div key={a.id} className={`flex min-h-16 items-center justify-between gap-3 ${i > 0 ? 'border-t border-divisor' : ''}`}>
                <span className="flex flex-col">
                  <span className="text-[15px] font-medium">{a.aparelho}</span>
                  <span className="text-[13px] text-suave">
                    cadastrado em {data(a.criadaEm)}
                    {a.usadaEm && ` · último acesso ${data(a.usadaEm)}`}
                  </span>
                </span>
                {aparelhos.length > 1 && (
                  <button className="h-10 rounded-[10px] px-3 text-sm font-medium text-ambar-texto" onClick={() => remover(a.id, a.aparelho)}>
                    Remover
                  </button>
                )}
              </div>
            ))}
          </Cartao>
        )}

        <Cartao className="flex flex-col gap-3 p-4">
          <h2 className="text-base font-semibold">Cadastrar este aparelho</h2>
          <p className="text-sm text-suave">
            Abra o app no aparelho novo (o iPhone, por exemplo), entre por um aparelho já cadastrado e toque aqui.
            Se a passkey já veio pelo iCloud, não precisa: é só entrar.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-suave">Nome do aparelho</span>
            <input className="h-11 rounded-xl border border-borda-forte bg-white px-3.5 text-[15px]" value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <button className="h-11.5 rounded-xl bg-floresta text-[15px] font-semibold text-white" onClick={cadastrarEste}>
            Cadastrar com Face ID / Touch ID
          </button>
          {aviso && <p role="status" className="text-sm text-floresta-escura">{aviso}</p>}
        </Cartao>
      </div>
    </>
  )
}
