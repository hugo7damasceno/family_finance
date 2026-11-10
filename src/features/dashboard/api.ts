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
        .select('id, tipo, valor_cents, data, fatura_mes, cartao_id, categoria_id, escopo, owner_id, pago, descricao')
        .neq('tipo', 'transferencia')
        .or(`and(cartao_id.is.null,data.gte.${ini},data.lte.${fim}),and(fatura_mes.gte.${ini},fatura_mes.lte.${fim})`)
      if (error) throw error
      return data as Movimento[]
    },
  })
}

export interface ContribuicaoMembro {
  membro_id: string
  nome: string
  receitas_cents: number
  contribuicoes_cents: number
  /** true quando ainda não há receita lançada no mês e foi usada a renda do perfil. */
  estimado: boolean
}

export function useContribuicoes(mes: string) {
  return useQuery({
    queryKey: ['lancamentos', 'contribuicoes', mes],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('contribuicoes_fundo', { p_mes: `${mes}-01` })
      if (error) throw error
      return data as ContribuicaoMembro[]
    },
  })
}
