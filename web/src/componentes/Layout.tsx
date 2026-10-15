import { NavLink, Outlet } from 'react-router'
import { IconeAlvo, IconeBroto, IconeCalendario, IconeCartao, IconeExtrato, IconeInicio } from './Icones'

const secoes = [
  { para: '/', nome: 'Início', Icone: IconeInicio, naBarra: true },
  { para: '/extrato', nome: 'Extrato', Icone: IconeExtrato, naBarra: true },
  { para: '/cartoes', nome: 'Cartões', Icone: IconeCartao, naBarra: true },
  { para: '/contas', nome: 'Contas a pagar', curto: 'Contas', Icone: IconeCalendario, naBarra: true },
  { para: '/metas', nome: 'Metas', Icone: IconeAlvo, naBarra: true },
  { para: '/investimentos', nome: 'Investimentos', Icone: IconeAlvo, naBarra: false },
  { para: '/sugestoes', nome: 'Sugestões', Icone: IconeAlvo, naBarra: false },
  { para: '/aparelhos', nome: 'Aparelhos', Icone: IconeAlvo, naBarra: false },
]

// Celular: barra embaixo. Mac (tela larga): menu lateral.
export function Layout() {
  return (
    <div className="min-h-dvh lg:flex">
      <aside className="hidden lg:flex lg:w-60 lg:shrink-0 flex-col gap-6 border-r border-borda bg-white px-4 py-6">
        <div className="flex items-center gap-2.5 px-2">
          <span className="flex size-9 items-center justify-center rounded-[11px] bg-floresta text-white">
            <IconeBroto width={20} height={20} strokeWidth={2} />
          </span>
          <span className="font-titulo text-[17px] font-bold">GestorDeFinanças</span>
        </div>
        <nav aria-label="Seções" className="flex flex-col gap-0.5">
          {secoes.map((s) => (
            <NavLink
              key={s.para}
              to={s.para}
              end={s.para === '/'}
              className={({ isActive }) =>
                `flex min-h-11 items-center rounded-[10px] px-3 text-[15px] ${
                  isActive ? 'bg-floresta-clara font-semibold text-floresta-escura' : 'text-tinta hover:bg-fundo'
                }`
              }
            >
              {s.nome}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="mx-auto w-full max-w-[1240px] px-5 pt-6 pb-28 lg:px-8 lg:pt-8 lg:pb-10">
        <Outlet />
      </main>

      <nav
        aria-label="Seções"
        className="fixed inset-x-0 bottom-0 flex justify-around border-t border-borda bg-white pt-2 pb-[max(env(safe-area-inset-bottom),12px)] lg:hidden"
      >
        {secoes
          .filter((s) => s.naBarra)
          .map((s) => (
            <NavLink
              key={s.para}
              to={s.para}
              end={s.para === '/'}
              className={({ isActive }) =>
                `flex min-h-11 min-w-16 flex-col items-center gap-0.5 text-[11px] ${
                  isActive ? 'font-semibold text-floresta' : 'font-medium text-inativo'
                }`
              }
            >
              <s.Icone />
              {s.curto ?? s.nome}
            </NavLink>
          ))}
      </nav>
    </div>
  )
}
