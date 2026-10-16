import { useState } from 'react'
import { api, useApi, type Cartao as TipoCartao } from '../api'
import { Barra, Cabecalho, Carregando, Cartao } from '../componentes/Base'
import { brl, diaMes, legivel } from '../formatos'

export function Cartoes() {
  const { dados: cartoes, erro } = useApi(api.cartoes, [])
  const [escolhidoId, setEscolhidoId] = useState<string>()

  if (!cartoes) return <Carregando erro={erro} />
  if (cartoes.length === 0) return <p className="text-sm text-suave">Nenhum cartão conectado ainda.</p>

  const escolhido = cartoes.find((c) => c.id === escolhidoId) ?? cartoes[0]
  const emAberto = cartoes.reduce((s, c) => s + (c.fatura?.total ?? 0), 0)

  return (
    <>
      <Cabecalho sobre={`${cartoes.length} cartões · ${brl(emAberto)} em aberto`} titulo="Cartões" />

      <div className="mb-4 flex flex-col gap-3 lg:mb-5 lg:flex-row lg:gap-4">
        {/* celular: abas compactas */}
        <div
          role="tablist"
          aria-label="Escolher cartão"
          className="grid gap-1 rounded-xl bg-[#E3E8E6] p-1 lg:hidden"
          style={{ gridTemplateColumns: `repeat(${cartoes.length}, minmax(0, 1fr))` }}
        >
          {cartoes.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={c.id === escolhido.id}
              onClick={() => setEscolhidoId(c.id)}
              className={`h-10 rounded-[9px] text-sm ${c.id === escolhido.id ? 'bg-white font-semibold' : 'text-suave'}`}
            >
              {c.banco}
            </button>
          ))}
        </div>
        <CartaoGrande cartao={escolhido} className="lg:hidden" />

        {/* Mac: os cartões lado a lado, o escolhido em destaque */}
        {cartoes.map((c) => (
          <button
            key={c.id}
            aria-pressed={c.id === escolhido.id}
            onClick={() => setEscolhidoId(c.id)}
            className="hidden flex-1 text-left lg:block"
          >
            <CartaoGrande cartao={c} destaque={c.id === escolhido.id} />
          </button>
        ))}
      </div>

      {escolhido.fatura && (
        <div className="mb-4 grid grid-cols-3 gap-2 lg:mb-5 lg:gap-3 lg:rounded-2xl lg:border lg:border-borda lg:bg-white lg:p-5">
          <Data rotulo="Fecha" dia={diaMes(escolhido.fatura.fechamento)} explica="compras até aqui entram nesta fatura" />
          <Data rotulo="Melhor dia" dia={diaMes(escolhido.fatura.melhorDiaDeCompra)} explica="a compra cai só na fatura seguinte" verde />
          <Data rotulo="Vence" dia={diaMes(escolhido.fatura.vencimento)} explica="data de pagamento" />
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
        <Cartao className="flex flex-col gap-3 p-4 lg:flex-1 lg:p-5">
          <h2 className="text-base font-semibold lg:text-[17px]">Nesta fatura, por categoria</h2>
          {escolhido.porCategoria.map((k) => (
            <div key={k.categoria} className="flex justify-between text-sm">
              <span>{k.categoria}</span>
              <span className="font-medium">{brl(k.valor)}</span>
            </div>
          ))}
        </Cartao>

        <Cartao className="px-4 pt-1 lg:flex-1 lg:px-5">
          <h2 className="pt-3 pb-1 text-base font-semibold lg:pt-4 lg:text-[17px]">Parcelamentos</h2>
          {escolhido.parcelamentos.length === 0 && (
            <p className="border-t border-divisor py-4 text-sm text-suave">Nenhuma compra parcelada nesta fatura.</p>
          )}
          {escolhido.parcelamentos.map((p) => (
            <div key={p.descricao} className="flex min-h-16 items-center py-3 justify-between gap-3 border-t border-divisor">
              <span className="flex flex-1 flex-col gap-1.5">
                <span className="flex flex-col">
                  <span className="text-[15px] font-medium">{legivel(p.descricao)}</span>
                  <span className="text-[13px] text-suave">
                    parcela {p.parcelaAtual} de {p.parcelasTotal}
                  </span>
                </span>
                <div className="max-w-56">
                  <Barra fracao={p.parcelaAtual / p.parcelasTotal} altura="h-1.5" />
                </div>
              </span>
              <span className="text-[15px] font-semibold">{brl(p.valor)}</span>
            </div>
          ))}
        </Cartao>
      </div>
    </>
  )
}

function CartaoGrande({ cartao, destaque = true, className = '' }: { cartao: TipoCartao; destaque?: boolean; className?: string }) {
  const escuro = destaque
  return (
    <div
      className={`flex flex-col gap-3.5 rounded-[20px] border-2 p-5 ${
        escuro ? 'border-tinta bg-tinta text-white' : 'border-borda bg-white'
      } ${className}`}
    >
      <div className={`flex justify-between text-sm ${escuro ? 'text-[#D5DED9]' : 'text-suave'}`}>
        <span>
          {cartao.banco}
          {cartao.final && ` · final ${cartao.final}`}
        </span>
        {cartao.fatura && <span>vence {diaMes(cartao.fatura.vencimento)}</span>}
      </div>
      <span className="flex flex-col">
        <span className={`text-[13px] ${escuro ? 'text-[#D5DED9]' : 'text-suave'}`}>Fatura atual</span>
        <span className="font-titulo text-[34px] leading-tight font-bold lg:text-[28px]">{brl(cartao.fatura?.total ?? 0)}</span>
      </span>
      {cartao.limite && (
        <div className="flex flex-col gap-1.5">
          {/* o limite que o banco informa é o que vale: inclui parcelas futuras e compras recentes */}
          <Barra
            fracao={cartao.usadoNoBanco !== null ? cartao.usadoNoBanco / cartao.limite : (cartao.usoDoLimite ?? 0)}
            cor={escuro ? 'bg-broto' : 'bg-floresta'}
          />
          <span className={`flex justify-between gap-2 text-[13px] ${escuro ? 'text-[#D5DED9]' : 'text-suave'}`}>
            <span>
              {cartao.usadoNoBanco !== null
                ? `${brl(cartao.usadoNoBanco)} usados`
                : `${Math.round((cartao.usoDoLimite ?? 0) * 100)}% usado`}{' '}
              de {brl(cartao.limite)}
            </span>
            {cartao.disponivel !== null && (
              <span className={`font-semibold ${escuro ? 'text-broto' : 'text-floresta'}`}>{brl(cartao.disponivel)} livres</span>
            )}
          </span>
        </div>
      )}
    </div>
  )
}

function Data({ rotulo, dia, explica, verde = false }: { rotulo: string; dia: string; explica: string; verde?: boolean }) {
  return (
    <div
      className={`flex flex-col gap-0.5 rounded-[14px] p-3 lg:rounded-none lg:border-t-4 lg:bg-transparent lg:p-0 lg:pt-2.5 ${
        verde
          ? 'bg-floresta-clara text-floresta-escura lg:border-floresta'
          : 'border border-borda bg-white lg:border-x-0 lg:border-b-0 lg:border-suave'
      }`}
    >
      <span className={`text-xs lg:text-[13px] ${verde ? 'font-semibold' : 'text-suave'}`}>{rotulo}</span>
      <span className="text-base font-semibold lg:text-lg">{dia}</span>
      <span className="hidden text-[13px] text-suave lg:block">{explica}</span>
    </div>
  )
}
