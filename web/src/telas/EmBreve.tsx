import { Cabecalho } from '../componentes/Base'

export function EmBreve({ titulo }: { titulo: string }) {
  return (
    <>
      <Cabecalho sobre="Ainda em construção" titulo={titulo} />
      <p className="text-sm text-suave">Esta tela já está desenhada no canvas e é a próxima a ganhar código.</p>
    </>
  )
}
