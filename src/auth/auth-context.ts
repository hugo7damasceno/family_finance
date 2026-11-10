import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { Household, Profile } from '@/types/database'

export interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  household: Household | null
  /** Membros da conta conjunta (inclui o próprio usuário). */
  membros: Pick<Profile, 'id' | 'nome'>[]
  carregando: boolean
  recarregarPerfil: () => Promise<void>
  sair: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
