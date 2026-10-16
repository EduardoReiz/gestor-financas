import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import './index.css'
import { auth } from './api'
import { Layout } from './componentes/Layout'
import { Carregando } from './componentes/Base'
import { Entrar } from './telas/Entrar'
import { Inicio } from './telas/Inicio'
import { Extrato } from './telas/Extrato'
import { Cartoes } from './telas/Cartoes'
import { Ajustes } from './telas/Ajustes'
import { Contas } from './telas/Contas'
import { Metas } from './telas/Metas'
import { Investimentos } from './telas/Investimentos'
import { Sugestoes } from './telas/Sugestoes'
import { Planejamento } from './telas/Planejamento'
import { EnviarBoletos } from './telas/EnviarBoletos'

type Estado = Awaited<ReturnType<typeof auth.estado>>

// Nada do app aparece sem sessão: primeiro a porta, depois a casa.
function App() {
  const [estado, setEstado] = useState<Estado>()
  const [erro, setErro] = useState<string>()

  const conferir = () =>
    auth
      .estado()
      .then(setEstado)
      .catch((e: Error) => setErro(e.message))

  useEffect(() => {
    conferir()
    const aoEncerrar = () => setEstado((e) => e && { ...e, logado: false })
    window.addEventListener('gf:sessao-encerrada', aoEncerrar)
    return () => window.removeEventListener('gf:sessao-encerrada', aoEncerrar)
  }, [])

  if (!estado)
    return (
      <div className="p-6">
        <Carregando erro={erro} />
      </div>
    )
  if (!estado.logado) return <Entrar primeiroAcesso={estado.primeiroAcesso} aoEntrar={conferir} />
  // acesso só de envio (a Convidado): uma tela só, sem nada das finanças
  if (estado.papel === 'ENVIO') return <EnviarBoletos pessoa={estado.pessoa} aoSair={conferir} />

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Inicio />} />
          <Route path="extrato" element={<Extrato />} />
          <Route path="cartoes" element={<Cartoes />} />
          <Route path="contas" element={<Contas />} />
          <Route path="metas" element={<Metas />} />
          <Route path="investimentos" element={<Investimentos />} />
          <Route path="sugestoes" element={<Sugestoes />} />
          <Route path="planejamento" element={<Planejamento />} />
          <Route path="ajustes" element={<Ajustes aoSair={conferir} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
