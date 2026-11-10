import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Carregando } from '@/components/ui/Carregando'
import { useAuth } from './auth-context'

/** Exige usuário logado. */
export function RequireAuth() {
  const { user, carregando } = useAuth()
  const location = useLocation()
  if (carregando) return <Carregando telaCheia />
  if (!user) return <Navigate to="/entrar" replace state={{ de: location.pathname }} />
  return <Outlet />
}

/** Exige que o questionário de cadastro tenha sido concluído. */
export function RequireOnboarding() {
  const { profile } = useAuth()
  if (profile && !profile.onboarding_concluido) return <Navigate to="/bem-vindo" replace />
  return <Outlet />
}

/** Páginas públicas (login, cadastro): quem já está logado vai para o app. */
export function SomenteDeslogado() {
  const { user, carregando } = useAuth()
  if (carregando) return <Carregando telaCheia />
  if (user) return <Navigate to="/" replace />
  return <Outlet />
}
