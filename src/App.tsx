import { createBrowserRouter, Navigate, RouterProvider, type RouteObject } from 'react-router-dom'
import { RequireAuth, RequireOnboarding, SomenteDeslogado } from '@/auth/guards'
import { AppLayout } from '@/components/layout/AppLayout'
import { Carregando } from '@/components/ui/Carregando'
import { modulos } from '@/config/modulos'
import { Cadastro } from '@/pages/auth/Cadastro'
import { Entrar } from '@/pages/auth/Entrar'
import { RecuperarSenha } from '@/pages/auth/RecuperarSenha'
import { RedefinirSenha } from '@/pages/auth/RedefinirSenha'

/**
 * Telas carregadas sob demanda: cada uma vira um arquivo separado no build,
 * então o celular baixa só o código da tela que está abrindo.
 */
const telas: Record<string, RouteObject['lazy']> = {
  '/': async () => ({ Component: (await import('@/pages/Inicio')).Inicio }),
  '/configuracoes': async () => ({ Component: (await import('@/pages/Configuracoes')).Configuracoes }),
  '/mais': async () => ({ Component: (await import('@/pages/Mais')).Mais }),
  '/lancamentos': async () => ({ Component: (await import('@/features/lancamentos/PaginaLancamentos')).PaginaLancamentos }),
  '/contas': async () => ({ Component: (await import('@/features/contas/PaginaContas')).PaginaContas }),
  '/cartoes': async () => ({ Component: (await import('@/features/cartoes/PaginaCartoes')).PaginaCartoes }),
  '/parcelamentos': async () => ({
    Component: (await import('@/features/parcelamentos/PaginaParcelamentos')).PaginaParcelamentos,
  }),
  '/terceiros': async () => ({ Component: (await import('@/features/terceiros/PaginaTerceiros')).PaginaTerceiros }),
  '/comparativos': async () => ({
    Component: (await import('@/features/comparativos/PaginaComparativos')).PaginaComparativos,
  }),
}

const emConstrucao: RouteObject['lazy'] = async () => ({
  Component: (await import('@/pages/ModuloEmConstrucao')).ModuloEmConstrucao,
})

const router = createBrowserRouter([
  {
    // Exibido enquanto a primeira tela é baixada.
    hydrateFallbackElement: <Carregando telaCheia />,
    children: [
      {
        element: <SomenteDeslogado />,
        children: [
          { path: '/entrar', element: <Entrar /> },
          { path: '/cadastro', element: <Cadastro /> },
          { path: '/recuperar-senha', element: <RecuperarSenha /> },
        ],
      },
      // Fora dos guards: o link do e-mail cria a sessão ao abrir a página.
      { path: '/redefinir-senha', element: <RedefinirSenha /> },
      {
        element: <RequireAuth />,
        children: [
          {
            path: '/bem-vindo',
            lazy: async () => ({ Component: (await import('@/pages/onboarding/Questionario')).Questionario }),
          },
          {
            element: <RequireOnboarding />,
            children: [
              {
                element: <AppLayout />,
                children: [
                  ...Object.entries(telas).map(([path, lazy]) => ({ path, lazy })),
                  ...modulos
                    .filter((m) => !(m.rota in telas))
                    .map((m) => ({ path: m.rota, lazy: emConstrucao })),
                ],
              },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
