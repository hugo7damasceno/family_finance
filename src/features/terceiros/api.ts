import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth-context'
import { invalidarFinanceiro } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import type { Escopo, Lancamento, Terceiro } from '@/types/database'

export function useTerceiros() {
  return useQuery({
    queryKey: ['terceiros'],
    queryFn: async () => {
      const { data, error } = await supabase.from('terceiros').select('*').order('nome')
      if (error) throw error
      return data as Terceiro[]
    },
  })
}

export type MovimentoTerceiro = Pick<
  Lancamento,
  | 'id'
  | 'tipo'
  | 'descricao'
  | 'valor_cents'
  | 'data'
  | 'fatura_mes'
  | 'cartao_id'
  | 'terceiro_id'
  | 'reembolso_id'
  | 'conta_id'
  | 'parcela_numero'
  | 'parcelamento_id'
>

/** Compras feitas por terceiros (despesas) e reembolsos recebidos (receitas). */
export function useMovimentosTerceiros() {
  return useQuery({
    queryKey: ['lancamentos', 'terceiros'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lancamentos')
        .select('id, tipo, descricao, valor_cents, data, fatura_mes, cartao_id, terceiro_id, reembolso_id, conta_id, parcela_numero, parcelamento_id')
        .not('terceiro_id', 'is', null)
        .order('data')
      if (error) throw error
      return data as MovimentoTerceiro[]
    },
  })
}

export interface DadosTerceiro {
  nome: string
  telefone: string | null
  observacao: string | null
  escopo: Escopo
  arquivado: boolean
}

export function useSalvarTerceiro() {
  const qc = useQueryClient()
  const { user, profile } = useAuth()
  return useMutation({
    mutationFn: async ({ id, dados }: { id?: string; dados: DadosTerceiro }) => {
      const registro = { ...dados, household_id: profile?.household_id ?? null }
      const { data, error } = id
        ? await supabase.from('terceiros').update(registro).eq('id', id).select('id').single()
        : await supabase.from('terceiros').insert({ ...registro, owner_id: user!.id }).select('id').single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['terceiros'] }),
  })
}

/** Só exclui quem não tem compras; quem tem histórico deve ser arquivado. */
export function useExcluirTerceiro() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { count, error: e1 } = await supabase
        .from('lancamentos')
        .select('id', { count: 'exact', head: true })
        .eq('terceiro_id', id)
      if (e1) throw e1
      if ((count ?? 0) > 0) throw new Error('Essa pessoa tem compras registradas. Arquive em vez de excluir.')
      const { error } = await supabase.from('terceiros').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['terceiros'] }),
  })
}

export function useRegistrarReembolso() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { ids: string[]; data: string; conta_id: string | null }) => {
      const { error } = await supabase.rpc('registrar_reembolso', { p_ids: p.ids, p_data: p.data, p_conta: p.conta_id })
      if (error) throw error
    },
    onSuccess: () => invalidarFinanceiro(qc),
  })
}
