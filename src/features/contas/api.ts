import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth-context'
import { invalidarFinanceiro } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import type { Conta, Escopo, TipoConta } from '@/types/database'

export const TIPOS_CONTA: { valor: TipoConta; rotulo: string }[] = [
  { valor: 'corrente', rotulo: 'Conta corrente' },
  { valor: 'poupanca', rotulo: 'Poupança' },
  { valor: 'dinheiro', rotulo: 'Dinheiro em espécie' },
  { valor: 'outro', rotulo: 'Outra' },
]

/** Tipos de cofrinho: a reserva de emergência é um cofrinho especial. */
export const TIPOS_COFRINHO: { valor: TipoConta; rotulo: string }[] = [
  { valor: 'cofrinho', rotulo: 'Cofrinho / caixinha' },
  { valor: 'reserva', rotulo: 'Reserva de emergência' },
]

export const ehCofrinho = (c: Pick<Conta, 'tipo'>) => c.tipo === 'cofrinho' || c.tipo === 'reserva'

export const ICONES_COFRINHO = ['🐷', '🛡️', '✈️', '🏖️', '🚗', '🏠', '🛋️', '🎓', '💍', '👶', '🎁', '💻', '🩺', '📄']

export function useContas() {
  return useQuery({
    queryKey: ['contas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('contas').select('*').order('nome')
      if (error) throw error
      return data as Conta[]
    },
  })
}

/** Contas ativas, para os campos de seleção. */
export function useContasAtivas() {
  const q = useContas()
  return { ...q, data: q.data?.filter((c) => !c.arquivada) }
}

export function useSaldos() {
  return useQuery({
    queryKey: ['saldos'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('saldos_contas')
      if (error) throw error
      return new Map((data as { conta_id: string; saldo_cents: number }[]).map((s) => [s.conta_id, s.saldo_cents]))
    },
  })
}

export interface DadosConta {
  nome: string
  tipo: TipoConta
  escopo: Escopo
  saldo_inicial_cents: number
  arquivada: boolean
  meta_cents?: number | null
  data_meta?: string | null
  icone?: string | null
  concluido_em?: string | null
}

export function useSalvarConta() {
  const qc = useQueryClient()
  const { user, profile } = useAuth()
  return useMutation({
    mutationFn: async ({ id, dados }: { id?: string; dados: DadosConta }) => {
      const registro = { ...dados, household_id: profile?.household_id ?? null }
      const { error } = id
        ? await supabase.from('contas').update(registro).eq('id', id)
        : await supabase.from('contas').insert({ ...registro, owner_id: user!.id })
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['contas'] })
      await invalidarFinanceiro(qc)
    },
  })
}

export function useExcluirConta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contas').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['contas'] })
      await invalidarFinanceiro(qc)
    },
  })
}

export interface DadosTransferencia {
  conta_id: string
  conta_destino_id: string
  valor_cents: number
  data: string
  descricao: string
  /** 'casal' quando as duas contas são do casal (o cônjuge também vê a transferência). */
  escopo: Escopo
}

export function useTransferir() {
  const qc = useQueryClient()
  const { user, profile } = useAuth()
  return useMutation({
    mutationFn: async (d: DadosTransferencia) => {
      const { error } = await supabase.from('lancamentos').insert({
        ...d,
        tipo: 'transferencia',
        owner_id: user!.id,
        household_id: profile?.household_id ?? null,
        pago: true,
      })
      if (error) throw error
    },
    onSuccess: () => invalidarFinanceiro(qc),
  })
}
