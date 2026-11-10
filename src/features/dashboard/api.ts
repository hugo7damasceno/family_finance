import { useQuery } from '@tanstack/react-query'
import { limitesDoMes } from '@/lib/datas'
import { supabase } from '@/lib/supabase'
import type { Lancamento } from '@/types/database'

export type Movimento = Pick<
  Lancamento,
  | 'id'
  | 'tipo'
  | 'valor_cents'
  | 'data'
  | 'fatura_mes'
  | 'cartao_id'
  | 'categoria_id'
  | 'escopo'
  | 'owner_id'
  | 'pago'
  | 'descricao'
  | 'recorrencia_id'
  | 'parcelamento_id'
>

/**
 * Mês de competência ('AAAA-MM'): compras no cartão pesam no mês da fatura;
 * o resto, no mês da data.
 */
export const competencia = (m: Pick<Movimento, 'fatura_mes' | 'data'>) => (m.fatura_mes ?? m.data).slice(0, 7)

/** Receitas e despesas visíveis entre dois meses (inclusive), por competência. */
export function useMovimentos(mesInicio: string, mesFim: string) {
  return useQuery({
    queryKey: ['lancamentos', 'competencia', mesInicio, mesFim],
    queryFn: async () => {
      const ini = limitesDoMes(mesInicio).inicio
      const fim = limitesDoMes(mesFim).fim
      const { data, error } = await supabase
        .from('lancamentos')
        .select('id, tipo, valor_cents, data, fatura_mes, cartao_id, categoria_id, escopo, owner_id, pago, descricao, recorrencia_id, parcelamento_id')
        .neq('tipo', 'transferencia')
        .or(`and(cartao_id.is.null,data.gte.${ini},data.lte.${fim}),and(fatura_mes.gte.${ini},fatura_mes.lte.${fim})`)
      if (error) throw error
      return data as Movimento[]
    },
  })
}

/** Meus números do mês + total do fundo do casal (sem a renda individual do cônjuge). */
export interface ResumoFundo {
  receitas_cents: number
  contribuicoes_cents: number
  /** true quando ainda não há receita lançada no mês e foi usada a renda do cadastro. */
  estimado: boolean
  fundo_cents: number
  fundo_estimado: boolean
  membros: number
}

export function useResumoFundo(mes: string) {
  return useQuery({
    queryKey: ['lancamentos', 'resumo-fundo', mes],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('resumo_fundo', { p_mes: `${mes}-01` }).maybeSingle<ResumoFundo>()
      if (error) throw error
      return data
    },
  })
}
