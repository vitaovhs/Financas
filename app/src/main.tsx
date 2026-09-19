import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/screens.css'
import App from './App'

const qc = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 15_000 },
  },
})

// Na página de demonstração publicada, as rotas ficam na memória (sem depender do endereço).
const Router = import.meta.env.VITE_ROTEADOR === 'memoria' ? MemoryRouter : BrowserRouter

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <Router basename={import.meta.env.VITE_ROTEADOR === 'memoria' ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <App />
      </Router>
    </QueryClientProvider>
  </StrictMode>,
)
