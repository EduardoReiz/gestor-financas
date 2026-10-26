import { useState } from 'react'
import { startRegistration } from '@simplewebauthn/browser'
import { api, auth, useApi } from '../api'
import { Cabecalho, Carregando, Cartao } from '../componentes/Base'
import { mensagemDeErro, nomeDoAparelho } from './Entrar'

const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export function Ajustes({ aoSair }: { aoSair: () => void }) {
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
      <Cabecalho sobre="Bancos e aparelhos" titulo="Ajustes">
        <button
          className="h-11 rounded-xl border border-borda-forte bg-white px-4 text-sm font-medium"
          onClick={() => auth.sair().finally(aoSair)}
        >
          Sair
        </button>
      </Cabecalho>

      <div className="flex max-w-2xl flex-col gap-4">
        <Bancos />

        <h2 className="mt-2 text-[13px] font-semibold text-suave">Aparelhos que podem entrar</h2>
        {!aparelhos ? (
          <Carregando erro={erro} />
        ) : (
          <Cartao className="px-4">
            {aparelhos.map((a, i) => (
              <div key={a.id} className={`flex min-h-16 items-center justify-between gap-3 ${i > 0 ? 'border-t border-divisor' : ''}`}>
                <span className="flex flex-col">
                  <span className="text-[15px] font-medium">
                    {a.pessoa ? `${a.pessoa} · ${a.aparelho}` : a.aparelho}
                    {a.papel === 'ENVIO' && (
                      <span className="ml-2 rounded-md bg-ambar-claro px-1.5 py-0.5 text-[11px] font-semibold text-ambar-texto">
                        só envia boletos
                      </span>
                    )}
                  </span>
                  <span className="text-[13px] text-suave">
                    cadastrado em {data(a.criadaEm)}
                    {a.usadaEm && ` · último acesso ${data(a.usadaEm)}`}
                  </span>
                </span>
                {aparelhos.length > 1 && (
                  <button
                    className="h-10 rounded-[10px] px-3 text-sm font-medium text-ambar-texto"
                    onClick={() => remover(a.id, a.aparelho)}
                  >
                    Remover
                  </button>
                )}
              </div>
            ))}
          </Cartao>
        )}

        <Convites aoMudar={recarregar} />

        <Cartao className="flex flex-col gap-3 p-4">
          <h2 className="text-base font-semibold">Cadastrar este aparelho</h2>
          <p className="text-sm text-suave">
            Abra o app no aparelho novo (o iPhone, por exemplo), entre por um aparelho já cadastrado e toque aqui. Se a passkey já veio pelo
            iCloud, não precisa: é só entrar.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-suave">Nome do aparelho</span>
            <input
              className="h-11 rounded-xl border border-borda-forte bg-white px-3.5 text-[15px]"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </label>
          <button className="h-11.5 rounded-xl bg-floresta text-[15px] font-semibold text-white" onClick={cadastrarEste}>
            Cadastrar com Face ID / Touch ID
          </button>
          {aviso && (
            <p role="status" className="text-sm text-floresta-escura">
              {aviso}
            </p>
          )}
        </Cartao>
      </div>
    </>
  )
}

function Bancos() {
  const { dados, erro, recarregar } = useApi(api.sincronizacao, [])
  const [rodando, setRodando] = useState(false)
  const [aviso, setAviso] = useState<string>()
  const [bancos, setBancos] = useState<{ banco: string; situacao: string; detalhe?: string }[]>()

  // Pede dado novo aos bancos pelo Pluggy (até 1 vez por hora por banco) e sincroniza.
  async function atualizarBancos() {
    setRodando(true)
    setAviso(undefined)
    setBancos(undefined)
    try {
      const r = await api.atualizarBancos()
      setBancos(r.bancos)
      setAviso(r.jaEstavaRodando ? 'Já estava sincronizando.' : `Pronto: ${r.novos} lançamentos novos.`)
    } catch (e) {
      setAviso(mensagemDeErro(e))
    } finally {
      setRodando(false)
      recarregar()
    }
  }

  async function sincronizar() {
    setRodando(true)
    setAviso(undefined)
    try {
      const r = await api.sincronizar()
      setAviso(r.jaEstavaRodando ? 'Já estava sincronizando.' : `Pronto: ${r.novos} lançamentos novos.`)
    } catch (e) {
      setAviso(mensagemDeErro(e))
    } finally {
      setRodando(false)
      recarregar()
    }
  }

  if (!dados) return <Carregando erro={erro} />
  const ultima = dados.ultima

  return (
    <Cartao className="flex flex-col gap-3 p-4">
      <h2 className="text-base font-semibold">Bancos (Open Finance)</h2>
      {!dados.configurado ? (
        <p className="text-sm text-suave">
          Nenhum banco conectado ainda. Coloque as chaves do Pluggy e os Item IDs em <code>PLUGGY_ITENS</code> no .env do servidor.
        </p>
      ) : (
        <>
          <p className="text-sm">{dados.bancos.join(' · ')}</p>
          {ultima && (
            <p className={`text-sm ${ultima.sucesso === false ? 'text-ambar-texto' : 'text-suave'}`}>
              {ultima.sucesso === false
                ? `A última sincronização falhou (${data(ultima.quando)}): ${ultima.erro}`
                : `Última sincronização: ${new Date(ultima.quando).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}. De hora em hora o app confere se algum banco tem dado novo e sincroniza sozinho.`}
            </p>
          )}
          <button
            className="h-11.5 rounded-xl bg-floresta text-[15px] font-semibold text-white disabled:opacity-60"
            disabled={rodando}
            onClick={sincronizar}
          >
            {rodando ? 'Sincronizando…' : 'Sincronizar agora'}
          </button>
          <button
            className="h-11.5 rounded-xl border border-floresta text-[15px] font-semibold text-floresta disabled:opacity-60"
            disabled={rodando}
            onClick={atualizarBancos}
          >
            {rodando ? 'Pedindo aos bancos… (até 2 min)' : 'Pedir dados novos aos bancos'}
          </button>
          <p className="text-xs text-suave">
            "Sincronizar agora" só copia o que o Pluggy já tem. "Pedir dados novos" manda o Pluggy buscar no banco antes, no máximo 1 vez por hora por banco.
            Compras de cartão e Pix ainda podem demorar a aparecer, porque o próprio banco as libera com atraso.
          </p>
          {aviso && (
            <p role="status" className="text-sm text-floresta-escura">
              {aviso}
            </p>
          )}
          {bancos && (
            <ul className="flex flex-col gap-1 text-sm text-suave">
              {bancos.map((b) => (
                <li key={b.banco}>
                  {b.banco}: {b.situacao === 'atualizado' ? 'atualizado' : b.situacao === 'aguarde' ? 'aguarde' : b.situacao === 'demorando' ? 'ainda atualizando' : 'não deu'}
                  {b.detalhe && ` (${b.detalhe})`}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Cartao>
  )
}

// Convite para alguém (a pessoa convidada) só enviar boletos: código de uso único, 48 horas.
function Convites({ aoMudar }: { aoMudar: () => void }) {
  const { dados: abertos = [], recarregar } = useApi(auth.convites, [])
  const [pessoa, setPessoa] = useState('')
  const [novo, setNovo] = useState<{ codigo: string; validoAte: string }>()
  const [erro, setErro] = useState<string>()

  async function criar() {
    setErro(undefined)
    try {
      setNovo(await auth.criarConvite(pessoa.trim()))
      recarregar()
      aoMudar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  const link = novo && `${location.origin}/?convite=${novo.codigo}`

  return (
    <Cartao className="flex flex-col gap-3 p-4">
      <h2 className="text-base font-semibold">Acesso para enviar boletos</h2>
      <p className="text-sm text-suave">
        A pessoa convidada só consegue mandar Pix e boletos para você pagar e ver se já foram pagos. Ela não vê saldo, extrato, cartões nem
        nada das suas finanças.
      </p>

      {novo ? (
        <div className="flex flex-col gap-2 rounded-xl bg-floresta-clara p-4 text-floresta-escura">
          <span className="text-sm">
            Convite para {pessoa} (vale até {data(novo.validoAte)}, uma vez só):
          </span>
          <span className="font-mono text-3xl font-bold tracking-[0.2em]">{novo.codigo}</span>
          <span className="text-sm">
            No iPhone dela: abrir o app, tocar em <b>Tenho um convite</b>, digitar o código e cadastrar o Face ID. Ou mandar o link:
          </span>
          <button className="self-start text-sm font-semibold underline" onClick={() => navigator.clipboard.writeText(link!)}>
            Copiar link do convite
          </button>
          <span className="text-xs">O código não aparece de novo depois que você sair desta tela.</span>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-[13px] text-suave">Nome de quem vai usar</span>
            <input
              className="h-11 rounded-xl border border-borda-forte bg-white px-3.5 text-[15px]"
              value={pessoa}
              onChange={(e) => setPessoa(e.target.value)}
            />
          </label>
          <button
            className="h-11.5 rounded-xl bg-floresta px-4 text-[15px] font-semibold text-white disabled:opacity-50"
            disabled={!pessoa.trim()}
            onClick={criar}
          >
            Criar convite
          </button>
        </div>
      )}
      {erro && (
        <p role="alert" className="text-sm text-ambar-texto">
          {erro}
        </p>
      )}

      {abertos.length > 0 && (
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-[13px] text-suave">Convites ainda não usados</span>
          {abertos.map((c) => (
            <span key={c.id} className="flex items-center justify-between">
              <span>
                {c.pessoa} · vence {data(c.expiraEm)}
              </span>
              <button className="text-ambar-texto" onClick={() => auth.cancelarConvite(c.id).then(recarregar)}>
                Cancelar
              </button>
            </span>
          ))}
        </div>
      )}
    </Cartao>
  )
}
