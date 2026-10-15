import type { SVGProps } from 'react'

// Ícones de traço, os mesmos do canvas. Decorativos: o texto ao lado dá o nome.
function Icone({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export const IconeInicio = (p: SVGProps<SVGSVGElement>) => (
  <Icone {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /></Icone>
)
export const IconeExtrato = (p: SVGProps<SVGSVGElement>) => (
  <Icone {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></Icone>
)
export const IconeCartao = (p: SVGProps<SVGSVGElement>) => (
  <Icone {...p}><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19" /></Icone>
)
export const IconeCalendario = (p: SVGProps<SVGSVGElement>) => (
  <Icone {...p}><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></Icone>
)
export const IconeAlvo = (p: SVGProps<SVGSVGElement>) => (
  <Icone {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></Icone>
)
export const IconeBroto = (p: SVGProps<SVGSVGElement>) => (
  <Icone {...p}><path d="M12 21V11" /><path d="M12 11C12 7 9 4 4 4c0 4 3 7 8 7" /><path d="M12 14c0-3.5 2.5-6 7-6 0 3.5-2.5 6-7 6" /></Icone>
)
export const IconeLampada = (p: SVGProps<SVGSVGElement>) => (
  <Icone {...p}><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3" /></Icone>
)
export const IconeVoltar = (p: SVGProps<SVGSVGElement>) => (
  <Icone strokeWidth={2} {...p}><path d="m15 18-6-6 6-6" /></Icone>
)
export const IconeAvancar = (p: SVGProps<SVGSVGElement>) => (
  <Icone strokeWidth={2} {...p}><path d="m9 18 6-6-6-6" /></Icone>
)
