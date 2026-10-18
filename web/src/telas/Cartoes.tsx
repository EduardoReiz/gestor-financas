import { useState } from 'react'
import { api, useApi, type Cartao as TipoCartao } from '../api'
import { Barra, Cabecalho, Carregando, Cartao } from '../componentes/Base'
import { brl, diaMes, legivel, paraNumero } from '../formatos'

export function Cartoes() {
  const { dados: cartoes, erro, recarregar } = useApi(api.cartoes, [])
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

      {escolhido.fatura && <ValorDoBanco key={escolhido.fatura.id} fatura={escolhido.fatura} aoSalvar={recarregar} />}

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
        {cartao.fatura?.informado && (
          <span className={`text-[13px] ${escuro ? 'text-[#D5DED9]' : 'text-suave'}`}>
            valor do app do banco, informado em {diaMes(cartao.fatura.informadoEm!)}
          </span>
        )}
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

// O Open Finance às vezes não manda todas as compras do cartão (o Sicredi
// deixou semanas de fora). Aí só o app do banco sabe o valor da fatura.
function ValorDoBanco({ fatura, aoSalvar }: { fatura: NonNullable<TipoCartao['fatura']>; aoSalvar: () => void }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(fatura.informado ? String(fatura.informado).replace('.', ',') : '')
  const [erro, setErro] = useState<string>()

  async function salvar(valor: number | null) {
    if (valor !== null && !(valor >= 0)) return setErro('Valor inválido')
    await api.informarFatura(fatura.id, valor)
    setEditando(false)
    aoSalvar()
  }

  return (
    <Cartao className="mb-4 flex flex-col gap-2.5 p-4 lg:mb-5 lg:p-5">
      {fatura.naoDetalhado > 0 ? (
        <p className="text-sm">
          O banco cobra <b>{brl(fatura.total)}</b>, mas só mandou ao app {brl(fatura.somaDasCompras)} em compras.{' '}
          <b>{brl(fatura.naoDetalhado)}</b> são compras que o banco ainda não detalhou.
        </p>
      ) : (
        <p className="text-sm text-suave">
          {fatura.informado
            ? 'As compras que chegaram já somam o valor que você informou.'
            : 'Valor somado das compras que o banco mandou. Confira no app do banco: às vezes falta compra.'}
        </p>
      )}
      {editando ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            salvar(paraNumero(texto))
          }}
        >
          <label className="sr-only" htmlFor="valor-fatura">
            Valor da fatura no app do banco
          </label>
          <input
            id="valor-fatura"
            inputMode="decimal"
            autoFocus
            placeholder="2.400,89"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value)
              setErro(undefined)
            }}
            className="h-10 w-36 rounded-[10px] border border-borda-forte bg-white px-3 text-[15px]"
          />
          <button className="h-10 rounded-[10px] bg-floresta px-4 text-sm font-medium text-white">Salvar</button>
          <button type="button" className="h-10 px-2 text-sm text-suave" onClick={() => setEditando(false)}>
            Cancelar
          </button>
          {erro && <span className="text-sm text-ambar-texto">{erro}</span>}
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            className="h-10 rounded-[10px] border border-floresta px-3.5 text-sm font-medium text-floresta"
            onClick={() => setEditando(true)}
          >
            {fatura.informado ? 'Atualizar valor do app do banco' : 'Informar valor do app do banco'}
          </button>
          {fatura.informado && (
            <button className="h-10 px-2 text-sm text-suave" onClick={() => salvar(null)}>
              Voltar a usar a soma das compras
            </button>
          )}
        </div>
      )}
    </Cartao>
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
