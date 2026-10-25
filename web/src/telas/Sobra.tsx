import { useState } from 'react'
import { Link } from 'react-router'
import { api, useApi, type ItemDaSobra, type SobraDoMes } from '../api'
import { Cabecalho, Carregando, Cartao } from '../componentes/Base'
import { brl, diaMes, nomeDoMes } from '../formatos'

// "AAAA-MM" daqui a `k` meses
const mesDepois = (k: number) => {
  const d = new Date(new Date().getFullYear(), new Date().getMonth() + k, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Sobra de UM mês: toda a renda, menos as contas fixas, menos a fatura do
// cartão. Sem média e sem projeção de gasto.
export function Sobra() {
  const opcoes = [0, 1, 2].map(mesDepois)
  const [mes, setMes] = useState(opcoes[1])
  const { dados, erro } = useApi(() => api.sobra(mes), [mes])

  return (
    <>
      <Cabecalho sobre="Depois de pagar tudo" titulo="Sobra do mês" />

      <div role="tablist" aria-label="Mês" className="mb-4 flex flex-wrap gap-2">
        {opcoes.map((m, i) => (
          <button
            key={m}
            role="tab"
            aria-selected={mes === m}
            onClick={() => setMes(m)}
            className={`min-h-11 rounded-full border px-4 text-sm ${
              mes === m ? 'border-floresta bg-floresta font-semibold text-white' : 'border-borda bg-white text-tinta'
            }`}
          >
            {i === 0 ? 'Este mês' : i === 1 ? 'Mês que vem' : nomeDoMes(m).split(' de ')[0]}
          </button>
        ))}
      </div>

      {!dados ? <Carregando erro={erro} /> : <Conta dados={dados} />}
    </>
  )
}

function Conta({ dados }: { dados: SobraDoMes }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <section className="flex flex-col gap-2 rounded-[20px] bg-floresta p-5 text-white lg:w-[360px] lg:shrink-0">
        <span className="text-sm">Sobra em {nomeDoMes(dados.mes)}</span>
        <span className={`font-titulo text-4xl font-bold ${dados.sobra < 0 ? 'text-[#FFD9A8]' : ''}`}>{brl(dados.sobra)}</span>
        <span className="text-xs text-[#D5E8DD]">renda total, menos as contas fixas, menos a fatura do cartão</span>
      </section>

      <Cartao className="flex min-w-0 flex-1 flex-col gap-1 p-4">
        <Bloco titulo="Renda" total={dados.receitas} sinal="+" itens={dados.itens.receitas} vazio="Nenhuma renda cadastrada." />
        <Bloco titulo="Contas fixas" total={dados.contas} sinal="−" itens={dados.itens.contas} vazio="Nenhuma conta fixa." dica />
        <Bloco
          titulo="Fatura do cartão"
          total={dados.faturas}
          sinal="−"
          itens={dados.itens.faturas}
          vazio="Nenhuma fatura vence neste mês."
          rodape={
            <>
              Se o valor do app não bate com o do banco, informe o valor certo na tela <Link to="/cartoes" className="font-semibold text-floresta">Cartões</Link>.
            </>
          }
        />
        <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-divisor pt-3">
          <span className="text-sm font-semibold">Sobra</span>
          <span className={`font-titulo text-2xl font-bold ${dados.sobra < 0 ? 'text-ambar-texto' : 'text-floresta'}`}>{brl(dados.sobra)}</span>
        </div>
      </Cartao>
    </div>
  )
}

function Bloco({
  titulo,
  total,
  sinal,
  itens,
  vazio,
  dica,
  rodape,
}: {
  titulo: string
  total: number
  sinal: '+' | '−'
  itens: ItemDaSobra[]
  vazio: string
  dica?: boolean
  rodape?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1 border-t border-divisor py-3 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">{titulo}</h2>
        <span className="font-titulo text-lg font-bold">
          {sinal} {brl(total)}
        </span>
      </div>
      {itens.length === 0 ? (
        <p className="text-sm text-suave">{vazio}</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {itens.map((i) => (
            <li key={i.nome + (i.vencimento ?? '')} className="flex items-baseline justify-between gap-3">
              <span className="flex flex-col">
                <span>
                  {i.nome}
                  {i.paga && ' ✓'}
                </span>
                {(i.vencimento || i.referencia) && (
                  <span className="text-xs text-suave">
                    {i.vencimento && `vence ${diaMes(i.vencimento)}`}
                    {i.referencia && 'valor de referência'}
                  </span>
                )}
              </span>
              <span className="shrink-0">{brl(i.valor)}</span>
            </li>
          ))}
        </ul>
      )}
      {dica && (
        <p className="text-xs text-suave">
          Conta com "valor de referência" ainda não teve o valor real do mês. Para mudar a referência (energia, fatura do Nubank da Convidado), edite a conta na tela{' '}
          <Link to="/contas" className="font-semibold text-floresta">
            Contas
          </Link>
          .
        </p>
      )}
      {rodape && <p className="text-xs text-suave">{rodape}</p>}
    </div>
  )
}
