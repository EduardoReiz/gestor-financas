import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import './index.css'
import { Layout } from './componentes/Layout'
import { Inicio } from './telas/Inicio'
import { Extrato } from './telas/Extrato'
import { Cartoes } from './telas/Cartoes'
import { EmBreve } from './telas/EmBreve'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
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
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
