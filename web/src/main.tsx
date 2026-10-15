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
import { Aparelhos } from './telas/Aparelhos'
import { EmBreve } from './telas/EmBreve'

type Estado = { logado: boolean; primeiroAcesso: boolean }

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

  if (!estado) return <div className="p-6"><Carregando erro={erro} /></div>
  if (!estado.logado) return <Entrar primeiroAcesso={estado.primeiroAcesso} aoEntrar={conferir} />

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Inicio />} />
          <Route path="extrato" element={<Extrato />} />
          <Route path="cartoes" element={<Cartoes />} />
          <Route path="contas" element={<EmBreve titulo="Contas a pagar" />} />
          <Route path="metas" element={<EmBreve titulo="Metas" />} />
          <Route path="investimentos" element={<EmBreve titulo="Investimentos" />} />
          <Route path="sugestoes" element={<EmBreve titulo="Sugestões" />} />
          <Route path="aparelhos" element={<Aparelhos aoSair={conferir} />} />
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
