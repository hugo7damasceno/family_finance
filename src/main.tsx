import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/auth/AuthProvider'
import { supabaseConfigurado } from '@/lib/supabase'
import { App } from './App'
import { ConfiguracaoPendente } from '@/pages/ConfiguracaoPendente'
import { PrivacidadeProvider } from '@/components/PrivacidadeProvider'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {supabaseConfigurado ? (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PrivacidadeProvider>
            <App />
          </PrivacidadeProvider>
        </AuthProvider>
      </QueryClientProvider>
    ) : (
      <ConfiguracaoPendente />
    )}
  </StrictMode>,
)
