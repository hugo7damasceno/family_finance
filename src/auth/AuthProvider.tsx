import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Household, Profile } from '@/types/database'
import { AuthContext, type AuthState } from './auth-context'

interface DadosPerfil {
  profile: Profile | null
  household: Household | null
  membros: Pick<Profile, 'id' | 'nome'>[]
}

async function buscarPerfil(userId: string): Promise<DadosPerfil> {
  const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle<Profile>()
  if (error) throw error
  if (!profile?.household_id) return { profile, household: null, membros: [] }

  const [h, m] = await Promise.all([
    supabase.from('households').select('*').eq('id', profile.household_id).single<Household>(),
    supabase.rpc('membros_familia'),
  ])
  if (h.error) throw h.error
  if (m.error) throw m.error
  return { profile, household: h.data, membros: (m.data ?? []) as Pick<Profile, 'id' | 'nome'>[] }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [sessaoCarregada, setSessaoCarregada] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessaoCarregada(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSession(novaSessao)
      if (!novaSessao) queryClient.clear()
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  const userId = session?.user.id
  const perfil = useQuery({
    queryKey: ['perfil', userId],
    queryFn: () => buscarPerfil(userId!),
    enabled: Boolean(userId),
  })

  const recarregarPerfil = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['perfil', userId] })
  }, [queryClient, userId])

  const sair = useCallback(async () => {
    await supabase.auth.signOut()
    // Cópias locais (listas de compras offline) não devem ficar para o próximo usuário do aparelho.
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('ff:compras:'))
        .forEach((k) => localStorage.removeItem(k))
    } catch {
      // armazenamento indisponível
    }
    queryClient.clear()
  }, [queryClient])

  const valor = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile: perfil.data?.profile ?? null,
      household: perfil.data?.household ?? null,
      membros: perfil.data?.membros ?? [],
      carregando: !sessaoCarregada || (Boolean(userId) && perfil.isPending),
      recarregarPerfil,
      sair,
    }),
    [session, perfil.data, perfil.isPending, sessaoCarregada, userId, recarregarPerfil, sair],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
