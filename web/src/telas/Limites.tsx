import { useState } from 'react'
import { api, useApi, type Categoria, type Limite } from '../api'
import { Barra, Cabecalho, Carregando, Cartao } from '../componentes/Base'
import { BotaoAdicionar, Campo, botaoPrincipal } from '../componentes/Formulario'
import { brl, diaMes, mesAtual, nomeDoMes, paraNumero } from '../formatos'

const SITUACAO = {
  ok: { cor: 'bg-floresta', selo: 'bg-floresta-clara text-floresta-escura', texto: 'tranquilo' },
  atencao: { cor: 'bg-[#C98A2E]', selo: 'bg-ambar-claro text-ambar-texto', texto: 'atenção' },
  estourou: { cor: 'bg-ambar', selo: 'bg-ambar text-white', texto: 'passou do limite' },
} as const

// "Quanto ainda dá para gastar com lanche?": a resposta está aqui.
export function Limites() {
  const [mes] = useState(mesAtual)
  const { dados, erro, recarregar } = useApi(() => api.limites(mes), [mes])
  const { dados: categorias = [] } = useApi(api.categorias, [])
  const [editando, setEditando] = useState<string | 'novo'>()

  const fechar = () => {
    setEditando(undefined)
    recarregar()
  }

  return (
    <>
      <Cabecalho sobre={dados ? `${nomeDoMes(mes)} · faltam ${dados.diasRestantes} dias` : nomeDoMes(mes)} titulo="Limites">
        <BotaoAdicionar
          rotulo="Novo limite"
          aberto={editando === 'novo'}
          aoAlternar={() => setEditando(editando === 'novo' ? undefined : 'novo')}
        />
      </Cabecalho>

      {editando === 'novo' && <FormLimite categorias={categorias} aoSalvar={fechar} aoCancelar={() => setEditando(undefined)} />}

      {!dados ? (
        <Carregando erro={erro} />
      ) : (
        <div className="flex flex-col gap-4">
          {dados.comprasDoCartaoAte && (
            <p className="text-[13px] text-suave">
              Compras do cartão até {diaMes(dados.comprasDoCartaoAte)}. O banco manda com 1 ou 2 dias de atraso: o que você comprou depois
              disso ainda não entrou.
            </p>
          )}

          {dados.limites.length === 0 && (
            <p className="rounded-2xl border border-borda bg-white p-4 text-sm text-suave">Nenhum limite ainda. Toque no + para criar.</p>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {dados.limites.map((l) =>
              editando === l.id ? (
                <Cartao key={l.id} className="p-4">
                  <FormLimite limite={l} categorias={categorias} aoSalvar={fechar} aoCancelar={() => setEditando(undefined)} />
                </Cartao>
              ) : (
                <CartaoLimite key={l.id} limite={l} aoEditar={() => setEditando(l.id)} />
              ),
            )}
          </div>
        </div>
      )}
    </>
  )
}

function CartaoLimite({ limite: l, aoEditar }: { limite: Limite; aoEditar: () => void }) {
  const s = SITUACAO[l.situacao]
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-borda bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col">
          <h2 className="text-base font-semibold">{l.nome}</h2>
          {l.categorias.length > 1 && <span className="text-xs text-suave">{l.categorias.map((c) => c.nome).join(', ')}</span>}
        </span>
        <span className={`shrink-0 rounded-[10px] px-2.5 py-0.5 text-xs font-semibold ${s.selo}`}>{s.texto}</span>
      </div>

      {/* a pergunta que importa vem primeiro */}
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex flex-col">
          <span className="text-[13px] text-suave">{l.resta >= 0 ? 'Ainda pode gastar' : 'Passou'}</span>
          <span className={`font-titulo text-[26px] font-bold ${l.resta < 0 ? 'text-ambar-texto' : ''}`}>{brl(Math.abs(l.resta))}</span>
        </span>
        <span className="text-right text-sm text-suave">
          <span className="font-semibold text-tinta">{Math.round(l.fracao * 100)}%</span> usado
          <br />
          {brl(l.gasto)} de {brl(l.valorMensal)}
        </span>
      </div>

      <Barra fracao={l.fracao} cor={s.cor} altura="h-2.5" />

      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-suave">
        <span>
          {l.porDia !== null && l.resta > 0 && <>Dá {brl(l.porDia)} por dia até o fim do mês</>}
          {l.projecao !== null && l.projecao > l.valorMensal && l.resta > 0 && (
            <span className="block text-ambar-texto">Nesse ritmo, fecha o mês em {brl(l.projecao)}</span>
          )}
        </span>
        <button className="py-1 font-medium text-floresta" onClick={aoEditar}>
          Editar
        </button>
      </div>
    </section>
  )
}

function FormLimite({
  limite,
  categorias,
  aoSalvar,
  aoCancelar,
}: {
  limite?: Limite
  categorias: Categoria[]
  aoSalvar: () => void
  aoCancelar: () => void
}) {
  const [nome, setNome] = useState(limite?.nome ?? '')
  const [valor, setValor] = useState(limite ? String(limite.valorMensal).replace('.', ',') : '')
  const [marcadas, setMarcadas] = useState(new Set(limite?.categorias.map((c) => c.id) ?? []))
  const [erro, setErro] = useState<string>()
  const deSaida = categorias.filter((c) => c.sentido === 'SAIDA')

  function alternar(id: string) {
    const novo = new Set(marcadas)
    if (novo.has(id)) novo.delete(id)
    else novo.add(id)
    setMarcadas(novo)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api.salvarOrcamento({ nome: nome.trim(), valorMensal: paraNumero(valor), categoriaIds: [...marcadas] }, limite?.id)
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function remover() {
    if (!limite || !confirm(`Remover o limite "${limite.nome}"?`)) return
    await api.removerOrcamento(limite.id)
    aoSalvar()
  }

  return (
    <form onSubmit={salvar} className={`mb-4 flex flex-col gap-3 ${limite ? '' : 'rounded-2xl border border-borda bg-white p-4'}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Nome" valor={nome} aoMudar={setNome} placeholder="Ex.: Lanche" />
        <Campo rotulo="Limite por mês (R$)" valor={valor} aoMudar={setValor} inputMode="decimal" />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[13px] text-suave">Categorias que contam neste limite</legend>
        <div className="flex flex-wrap gap-2">
          {deSaida.map((c) => (
            <label
              key={c.id}
              className={`flex h-9 cursor-pointer items-center rounded-full border px-3 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-floresta ${
                marcadas.has(c.id) ? 'border-floresta bg-floresta-clara text-floresta-escura' : 'border-borda-forte bg-white'
              }`}
            >
              <input type="checkbox" className="sr-only" checked={marcadas.has(c.id)} onChange={() => alternar(c.id)} />
              {c.nome}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-2">
        <button className={`${botaoPrincipal} flex-1`} disabled={!nome.trim() || !(paraNumero(valor) > 0) || marcadas.size === 0}>
          Salvar
        </button>
        <button type="button" className="h-11.5 rounded-xl border border-borda-forte px-4 text-sm" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
      {limite && (
        <button type="button" className="self-start text-sm text-ambar-texto" onClick={remover}>
          Remover este limite
        </button>
      )}
      {erro && (
        <p role="alert" className="text-sm text-ambar-texto">
          {erro}
        </p>
      )}
    </form>
  )
}
