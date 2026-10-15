import { api, useApi } from '../api'
import { Cabecalho, Carregando, Cartao } from '../componentes/Base'
import { brl } from '../formatos'

// Cores que se distinguem também pela claridade, não só pelo tom.
const CORES = ['bg-floresta', 'bg-broto', 'bg-ambar', 'bg-[#3D7EA6]', 'bg-[#8A9690]']

export function Investimentos() {
  const { dados, erro } = useApi(api.investimentos, [])

  if (!dados) return <Carregando erro={erro} />

  const divisao = dados.itens.map((i) => `${i.nome} ${Math.round(i.fracao * 100)}%`).join(', ')

  return (
    <>
      <Cabecalho sobre="Atualizado pelo Open Finance" titulo="Investimentos" />

      {dados.itens.length === 0 ? (
        <p className="text-sm text-suave">Nenhum investimento encontrado nos bancos conectados.</p>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
          <div className="flex flex-col gap-4 lg:w-[420px] lg:shrink-0">
            <Cartao className="flex flex-col gap-3 p-4 lg:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-titulo text-[30px] font-bold">{brl(dados.total)}</span>
                <span className="text-sm font-semibold text-floresta">
                  {dados.rendeuNoMes >= 0 ? '+' : '−'} {brl(Math.abs(dados.rendeuNoMes))} no mês
                </span>
              </div>
              <div role="img" aria-label={`Divisão: ${divisao}`} className="flex h-3.5 gap-0.5 overflow-hidden rounded-full">
                {dados.itens.map((i, n) => (
                  <div key={i.id} className={CORES[n % CORES.length]} style={{ width: `${i.fracao * 100}%` }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[13px] text-suave">
                {dados.itens.map((i, n) => (
                  <span key={i.id} className="flex items-center gap-1.5">
                    <span className={`size-2.5 rounded-[3px] ${CORES[n % CORES.length]}`} />
                    {i.nome} {Math.round(i.fracao * 100)}%
                  </span>
                ))}
              </div>
            </Cartao>

            {dados.dica && (
              <p className="rounded-2xl bg-floresta-clara px-4 py-3 text-sm text-floresta-escura">{dados.dica.texto}</p>
            )}
          </div>

          <Cartao className="min-w-0 flex-1 px-4">
            {dados.itens.map((i, n) => (
              <div key={i.id} className={`flex min-h-[68px] items-center justify-between gap-3 ${n > 0 ? 'border-t border-divisor' : ''}`}>
                <span className="flex min-w-0 flex-col">
                  <span className="text-[15px] font-medium">{i.nome}</span>
                  <span className="text-[13px] text-suave">{i.banco} · {i.tipo}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end">
                  <span className="text-[15px] font-semibold">{brl(i.saldo)}</span>
                  <span className={`text-[13px] ${i.rendeuNoMes >= 0 ? 'text-floresta' : 'text-ambar-texto'}`}>
                    {i.rendeuNoMes >= 0 ? '+' : '−'} {brl(Math.abs(i.rendeuNoMes))}
                  </span>
                </span>
              </div>
            ))}
          </Cartao>
        </div>
      )}
    </>
  )
}
