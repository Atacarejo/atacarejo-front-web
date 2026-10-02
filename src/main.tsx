import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@nimbus-ds/styles/dist/index.css'
import './index.css'
import App from './App.tsx'
import { isEmbedded, SITE_URL } from './lib/embedded'

// Fora do iframe do admin (URL aberta direto no navegador): vai para o site, sem montar nada.
// Em dev fica liberado para testar no localhost.
if (!isEmbedded() && !import.meta.env.DEV) {
  window.location.replace(SITE_URL)
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
