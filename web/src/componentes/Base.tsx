import type { ReactNode } from 'react'

export function Cabecalho({ sobre, titulo, children }: { sobre: string; titulo: string; children?: ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3 lg:mb-5">
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] text-suave lg:text-sm">{sobre}</span>
        <h1 className="font-titulo text-2xl font-bold lg:text-[30px]">{titulo}</h1>
      </div>
      {children}
    </header>
  )
}

export function Cartao({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-borda bg-white ${className}`}>{children}</section>
}

export function Barra({ fracao, cor = 'bg-floresta', altura = 'h-2' }: { fracao: number; cor?: string; altura?: string }) {
  return (
    <div className={`${altura} rounded-full bg-trilho`}>
      <div className={`${altura} rounded-full ${cor}`} style={{ width: `${Math.min(100, Math.max(0, fracao * 100))}%` }} />
    </div>
  )
}

export function Carregando({ erro }: { erro?: string }) {
  if (erro) {
    return (
      <p role="alert" className="rounded-2xl bg-ambar-claro p-4 text-sm text-ambar-texto">
        Não consegui falar com o servidor ({erro}). O back-end está rodando?
      </p>
    )
  }
  return <p className="p-4 text-sm text-suave">Carregando…</p>
}
