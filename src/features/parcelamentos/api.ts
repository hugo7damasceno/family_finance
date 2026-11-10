import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invalidarFinanceiro } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import type { Escopo, Lancamento, Parcelamento } from '@/types/database'

export interface ParcelamentoComParcelas extends Parcelamento {
  parcelas: Pick<Lancamento, 'id' | 'parcela_numero' | 'valor_cents' | 'data' | 'pago' | 'fatura_mes'>[]
}

export function useParcelamentos() {
  return useQuery({
    queryKey: ['parcelamentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parcelamentos')
        .select('*, parcelas:lancamentos(id, parcela_numero, valor_cents, data, pago, fatura_mes)')
        .order('data_primeira', { ascending: false })
      if (error) throw error
      return (data as ParcelamentoComParcelas[]).map((p) => ({
        ...p,
        parcelas: [...p.parcelas].sort((a, b) => (a.parcela_numero ?? 0) - (b.parcela_numero ?? 0)),
      }))
    },
  })
}

export interface DadosParcelamento {
  descricao: string
  valor_total_cents: number
  num_parcelas: number
  data_primeira: string
  categoria_id: string | null
  escopo: Escopo
  cartao_id: string | null
  conta_id: string | null
  pagas: number
  terceiro_id?: string | null
}

export function useCriarParcelamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: DadosParcelamento) => {
      const { error } = await supabase.rpc('criar_parcelamento', {
        p_descricao: d.descricao,
        p_valor_total: d.valor_total_cents,
        p_num_parcelas: d.num_parcelas,
        p_data_primeira: d.data_primeira,
        p_categoria: d.categoria_id,
        p_escopo: d.escopo,
        p_cartao: d.cartao_id,
        p_conta: d.conta_id,
        p_pagas: d.pagas,
        p_terceiro: d.terceiro_id ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => invalidarFinanceiro(qc),
  })
}

export function useExcluirParcelamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // As parcelas (lançamentos) são excluídas em cascata.
      const { error } = await supabase.from('parcelamentos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidarFinanceiro(qc),
  })
}
