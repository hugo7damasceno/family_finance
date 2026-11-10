import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth-context'
import { invalidarFinanceiro } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import type { Cartao, Escopo, Lancamento, ResumoFatura } from '@/types/database'

/**
 * Mês da fatura ('AAAA-MM') de uma compra feita em `data`. Espelha
 * public.calcular_fatura_mes no banco (usado só para pré-visualização).
 */
export function mesDaFatura(data: string, fechamento: number, vencimento: number): string {
  const [a, m, d] = data.split('-').map(Number)
  const deslocamento = (d >= fechamento ? 1 : 0) + (vencimento <= fechamento ? 1 : 0)
  const r = new Date(a, m - 1 + deslocamento, 1)
  return `${r.getFullYear()}-${String(r.getMonth() + 1).padStart(2, '0')}`
}

/** Fatura cujo vencimento é o próximo (ou hoje): a que o usuário quer ver primeiro. */
export function faturaAtual(c: Pick<Cartao, 'dia_fechamento' | 'dia_vencimento'>, hoje = new Date()): string {
  const iso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
  return mesDaFatura(iso, c.dia_fechamento, c.dia_vencimento)
}

export function useCartoes() {
  return useQuery({
    queryKey: ['cartoes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cartoes').select('*').order('nome')
      if (error) throw error
      return data as Cartao[]
    },
  })
}

export function useUsoCartoes() {
  return useQuery({
    queryKey: ['uso-cartoes'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('utilizado_cartoes')
      if (error) throw error
      return new Map((data as { cartao_id: string; utilizado_cents: number }[]).map((u) => [u.cartao_id, u.utilizado_cents]))
    },
  })
}

export function useFatura(cartaoId: string | undefined, mes: string) {
  return useQuery({
    queryKey: ['fatura', cartaoId, mes],
    enabled: Boolean(cartaoId),
    queryFn: async () => {
      const faturaMes = `${mes}-01`
      const [itens, resumo] = await Promise.all([
        supabase
          .from('lancamentos')
          .select('*')
          .eq('cartao_id', cartaoId!)
          .eq('fatura_mes', faturaMes)
          .order('data', { ascending: false }),
        supabase.rpc('resumo_fatura', { p_cartao: cartaoId, p_fatura_mes: faturaMes }).single<ResumoFatura>(),
      ])
      if (itens.error) throw itens.error
      if (resumo.error) throw resumo.error
      return { itens: itens.data as Lancamento[], resumo: resumo.data }
    },
  })
}

export interface DadosCartao {
  nome: string
  bandeira: string | null
  limite_cents: number | null
  dia_fechamento: number
  dia_vencimento: number
  escopo: Escopo
  arquivado: boolean
}

export function useSalvarCartao() {
  const qc = useQueryClient()
  const { user, profile } = useAuth()
  return useMutation({
    mutationFn: async ({ id, dados }: { id?: string; dados: DadosCartao }) => {
      const registro = { ...dados, household_id: profile?.household_id ?? null }
      const { error } = id
        ? await supabase.from('cartoes').update(registro).eq('id', id)
        : await supabase.from('cartoes').insert({ ...registro, owner_id: user!.id })
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['cartoes'] })
      await invalidarFinanceiro(qc)
    },
  })
}

export function usePagarFatura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { cartaoId: string; mes: string; contaId: string | null; data: string }) => {
      const { error } = await supabase.rpc('pagar_fatura', {
        p_cartao: p.cartaoId,
        p_fatura_mes: `${p.mes}-01`,
        p_conta: p.contaId,
        p_data: p.data,
      })
      if (error) throw error
    },
    onSuccess: () => invalidarFinanceiro(qc),
  })
}

export function useDesfazerPagamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { cartaoId: string; mes: string }) => {
      const { error } = await supabase.rpc('desfazer_pagamento_fatura', {
        p_cartao: p.cartaoId,
        p_fatura_mes: `${p.mes}-01`,
      })
      if (error) throw error
    },
    onSuccess: () => invalidarFinanceiro(qc),
  })
}
