import type { HTMLAttributes } from 'react'

export const botaoPrincipal =
  'h-11.5 rounded-xl bg-floresta px-4 text-[15px] font-semibold text-white disabled:opacity-50'

export function Campo({
  rotulo, valor, aoMudar, placeholder, inputMode, tipo = 'text', className = '',
}: {
  rotulo: string
  valor: string
  aoMudar: (v: string) => void
  placeholder?: string
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  tipo?: string
  className?: string
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[13px] text-suave">{rotulo}</span>
      <input
        type={tipo}
        className="h-11 rounded-xl border border-borda-forte bg-white px-3.5 text-[15px] text-tinta"
        value={valor}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(e) => aoMudar(e.target.value)}
      />
    </label>
  )
}

// O "+" redondo do canteiro: vira "×" quando o formulário está aberto.
export function BotaoAdicionar({ rotulo, aberto, aoAlternar }: { rotulo: string; aberto: boolean; aoAlternar: () => void }) {
  return (
    <button
      aria-label={aberto ? 'Fechar' : rotulo}
      aria-expanded={aberto}
      onClick={aoAlternar}
      className="flex size-11 items-center justify-center rounded-full bg-floresta text-white"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" className={aberto ? 'rotate-45 transition-transform' : 'transition-transform'}>
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  )
}
