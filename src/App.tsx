import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { RequireAuth, RequireOnboarding, SomenteDeslogado } from '@/auth/guards'
import { AppLayout } from '@/components/layout/AppLayout'
import { modulos } from '@/config/modulos'
import { Cadastro } from '@/pages/auth/Cadastro'
import { Entrar } from '@/pages/auth/Entrar'
import { RecuperarSenha } from '@/pages/auth/RecuperarSenha'
import { RedefinirSenha } from '@/pages/auth/RedefinirSenha'
import { Configuracoes } from '@/pages/Configuracoes'
import { Inicio } from '@/pages/Inicio'
import { Mais } from '@/pages/Mais'
import { PaginaCartoes } from '@/features/cartoes/PaginaCartoes'
import { PaginaContas } from '@/features/contas/PaginaContas'
import { PaginaLancamentos } from '@/features/lancamentos/PaginaLancamentos'
import { PaginaParcelamentos } from '@/features/parcelamentos/PaginaParcelamentos'
import { ModuloEmConstrucao } from '@/pages/ModuloEmConstrucao'
import { Questionario } from '@/pages/onboarding/Questionario'

const rotasProntas = new Set(['/', '/configuracoes', '/lancamentos', '/contas', '/cartoes', '/parcelamentos'])

const router = createBrowserRouter([
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
      { path: '/bem-vindo', element: <Questionario /> },
      {
        element: <RequireOnboarding />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: '/', element: <Inicio /> },
              { path: '/configuracoes', element: <Configuracoes /> },
              { path: '/mais', element: <Mais /> },
              { path: '/lancamentos', element: <PaginaLancamentos /> },
              { path: '/contas', element: <PaginaContas /> },
              { path: '/cartoes', element: <PaginaCartoes /> },
              { path: '/parcelamentos', element: <PaginaParcelamentos /> },
              ...modulos
                .filter((m) => !rotasProntas.has(m.rota))
                .map((m) => ({ path: m.rota, element: <ModuloEmConstrucao /> })),
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

export function App() {
  return <RouterProvider router={router} />
}
