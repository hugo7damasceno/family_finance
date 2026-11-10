import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface SaudeMes {
  mes: string // 'AAAA-MM-01'
  receitas_cents: number
  contribuicoes_cents: number
  despesas_cents: number
  fixas_cents: number
  parcelas_cents: number
  renda_cadastro_cents: number
}

export interface SaudeSituacao {
  reserva_cents: number
  atrasadas_qtd: number
  atrasadas_cents: number
}

/** Totais (do usuário ou do casal) dos últimos meses e situação atual. */
export function useDadosSaude(mes: string) {
  return useQuery({
    queryKey: ['lancamentos', 'saude', mes],
    queryFn: async () => {
      const [mensal, situacao] = await Promise.all([
        supabase.rpc('saude_mensal', { p_mes: `${mes}-01`, p_meses: 4 }),
        supabase.rpc('saude_situacao').single<SaudeSituacao>(),
      ])
      if (mensal.error) throw mensal.error
      if (situacao.error) throw situacao.error
      return { meses: mensal.data as SaudeMes[], situacao: situacao.data }
    },
  })
}
