import { api, auth, useApi } from '../api'
import { Carregando, Cartao } from '../componentes/Base'
import { IconeBroto } from '../componentes/Icones'
import { brl, diaMes } from '../formatos'
import { AdicionarCodigo } from './Codigos'

// O app inteiro de quem só envia boletos (a pessoa convidada): mandar e acompanhar.
// Nada das suas finanças aparece aqui (e o servidor também não deixa).
export function EnviarBoletos({ pessoa, aoSair }: { pessoa: string | null; aoSair: () => void }) {
  const { dados, erro, recarregar } = useApi(api.cobrancasEnviadas, [])

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col gap-4 px-5 pt-6 pb-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-[11px] bg-floresta text-white">
            <IconeBroto width={20} height={20} strokeWidth={2} />
          </span>
          <span className="flex flex-col">
            <span className="text-[13px] text-suave">Olá{pessoa ? `, ${pessoa}` : ''}</span>
            <h1 className="font-titulo text-xl font-bold">Enviar boletos</h1>
          </span>
        </div>
        <button className="h-10 rounded-xl border border-borda-forte px-3 text-sm" onClick={() => auth.sair().finally(aoSair)}>
          Sair
        </button>
      </header>

      <p className="text-sm text-suave">
        Cole o Pix copia e cola ou a linha digitável, ou mande o print do QR ou o PDF do boleto. Ele chega na hora para pagar.
      </p>

      <AdicionarCodigo aoSalvar={recarregar} comContaFixa={false} />

      <section className="flex flex-col gap-2">
        <h2 className="text-[13px] font-semibold text-suave">O que você enviou</h2>
        {!dados ? (
          <Carregando erro={erro} />
        ) : dados.length === 0 ? (
          <p className="rounded-2xl border border-borda bg-white p-4 text-sm text-suave">Nada enviado ainda.</p>
        ) : (
          <Cartao className="px-4">
            {dados.map((c, i) => (
              <div key={c.id} className={`flex min-h-16 items-center justify-between gap-3 py-2 ${i > 0 ? 'border-t border-divisor' : ''}`}>
                <span className="flex min-w-0 flex-col">
                  <span className="text-[15px] font-medium">{c.titulo}</span>
                  <span className="text-[13px] text-suave">
                    enviado em {diaMes(c.enviadaEm)}
                    {c.vencimento && ` · vence ${diaMes(c.vencimento)}`}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[15px] font-semibold">{c.valor !== null ? brl(c.valor) : ''}</span>
                  <span
                    className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${
                      c.pagaEm ? 'bg-floresta-clara text-floresta-escura' : 'bg-ambar-claro text-ambar-texto'
                    }`}
                  >
                    {c.pagaEm ? `pago em ${diaMes(c.pagaEm)}` : 'aguardando pagamento'}
                  </span>
                </span>
              </div>
            ))}
          </Cartao>
        )}
      </section>
    </div>
  )
}
