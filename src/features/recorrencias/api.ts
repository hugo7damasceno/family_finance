import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth-context'
import { invalidarFinanceiro } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import type { Escopo, OrigemReceita, Recorrencia } from '@/types/database'

export function useRecorrencias() {
  return useQuery({
    queryKey: ['recorrencias'],
    queryFn: async () => {
      const { data, error } = await supabase.from('recorrencias').select('*').order('dia_do_mes')
      if (error) throw error
      return data as Recorrencia[]
    },
  })
}

/** Gera os lançamentos pendentes das recorrências até o mês atual. */
export async function gerarRecorrencias(): Promise<number> {
  const { data, error } = await supabase.rpc('gerar_recorrencias')
  if (error) throw error
  return (data as number) ?? 0
}

export interface DadosRecorrencia {
  tipo: 'receita' | 'despesa'
  origem_receita: OrigemReceita | null
  descricao: string
  valor_cents: number
  categoria_id: string | null
  conta_id: string | null
  cartao_id: string | null
  escopo: Escopo
  dia_do_mes: number
  /** 'AAAA-MM-DD' (o banco normaliza para o 1º dia do mês) */
  inicio: string
  fim: string | null
  ativa: boolean
}

function useInvalidarTudo() {
  const qc = useQueryClient()
  return async () => {
    await qc.invalidateQueries({ queryKey: ['recorrencias'] })
    await invalidarFinanceiro(qc)
  }
}

export function useSalvarRecorrencia() {
  const { user, profile } = useAuth()
  const invalidar = useInvalidarTudo()
  return useMutation({
    mutationFn: async ({ id, dados }: { id?: string; dados: DadosRecorrencia }) => {
      const registro = {
        ...dados,
        escopo: dados.tipo === 'receita' ? 'individual' : dados.escopo,
        origem_receita: dados.tipo === 'receita' ? dados.origem_receita : null,
        cartao_id: dados.tipo === 'receita' ? null : dados.cartao_id,
        household_id: profile?.household_id ?? null,
      }
      const { error } = id
        ? await supabase.from('recorrencias').update(registro).eq('id', id)
        : await supabase.from('recorrencias').insert({ ...registro, owner_id: user!.id })
      if (error) throw error
      // Já cria o lançamento do mês atual, se for o caso.
      await gerarRecorrencias()
    },
    onSuccess: invalidar,
  })
}

/**
 * Cria uma recorrência a partir de um lançamento novo ("Repetir todo mês").
 * O mês do próprio lançamento já fica marcado como gerado, para não duplicar:
 * o lançamento digitado pelo usuário é o desse mês.
 */
export async function criarRecorrenciaDoLancamento(
  dados: Omit<DadosRecorrencia, 'dia_do_mes' | 'inicio' | 'fim' | 'ativa'> & { data: string },
  ownerId: string,
  householdId: string | null,
): Promise<string> {
  const { data, ...resto } = dados
  const mes = `${data.slice(0, 7)}-01`
  const { data: criada, error } = await supabase
    .from('recorrencias')
    .insert({
      ...resto,
      escopo: resto.tipo === 'receita' ? 'individual' : resto.escopo,
      owner_id: ownerId,
      household_id: householdId,
      dia_do_mes: Number(data.slice(8, 10)),
      inicio: mes,
      gerada_ate: mes,
      ativa: true,
    })
    .select('id')
    .single<{ id: string }>()
  if (error) throw error
  return criada.id
}

export function useExcluirRecorrencia() {
  const invalidar = useInvalidarTudo()
  return useMutation({
    mutationFn: async ({ id, apagarPendentes }: { id: string; apagarPendentes: boolean }) => {
      if (apagarPendentes) {
        const { error } = await supabase.from('lancamentos').delete().eq('recorrencia_id', id).eq('pago', false)
        if (error) throw error
      }
      // Lançamentos já gerados são mantidos (recorrencia_id vira nulo).
      const { error } = await supabase.from('recorrencias').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}
