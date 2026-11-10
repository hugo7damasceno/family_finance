import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth-context'
import { limitesDoMes } from '@/lib/datas'
import { invalidarFinanceiro } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import type { Categoria, Escopo, Lancamento, OrigemReceita, TipoLancamento } from '@/types/database'

export const ORIGENS_RECEITA: { valor: OrigemReceita; rotulo: string; categoria: string }[] = [
  { valor: 'salario', rotulo: 'Salário', categoria: 'Salário' },
  { valor: 'decimo_terceiro', rotulo: '13º salário', categoria: '13º salário' },
  { valor: 'ferias', rotulo: 'Férias', categoria: 'Férias' },
  { valor: 'restituicao', rotulo: 'Restituição IR', categoria: 'Restituição IR' },
  { valor: 'outros', rotulo: 'Outros', categoria: 'Outras receitas' },
]

export function useCategorias() {
  return useQuery({
    queryKey: ['categorias'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categorias').select('*').order('nome')
      if (error) throw error
      return data as Categoria[]
    },
    staleTime: 10 * 60_000,
  })
}

export function useLancamentosDoMes(mes: string) {
  return useQuery({
    queryKey: ['lancamentos', mes],
    queryFn: async () => {
      const { inicio, fim } = limitesDoMes(mes)
      const { data, error } = await supabase
        .from('lancamentos')
        .select('*')
        .gte('data', inicio)
        .lte('data', fim)
        .order('data', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Lancamento[]
    },
  })
}

export interface DadosLancamento {
  tipo: Exclude<TipoLancamento, 'transferencia'>
  origem_receita: OrigemReceita | null
  descricao: string
  valor_cents: number
  data: string
  categoria_id: string | null
  escopo: Escopo
  pago: boolean
  observacao: string | null
  conta_id: string | null
  cartao_id: string | null
  /** Preenchido ao criar o lançamento junto com uma recorrência. */
  recorrencia_id?: string | null
}

export function useSalvarLancamento() {
  const qc = useQueryClient()
  const { user, profile } = useAuth()
  return useMutation({
    mutationFn: async ({ id, dados }: { id?: string; dados: DadosLancamento }) => {
      // Receitas são sempre individuais (cada cônjuge lança a própria renda).
      const escopo: Escopo = dados.tipo === 'receita' ? 'individual' : dados.escopo
      const registro = {
        ...dados,
        escopo,
        origem_receita: dados.tipo === 'receita' ? dados.origem_receita : null,
        // Receita não entra em cartão; compra no cartão fica pendente até a fatura ser paga.
        cartao_id: dados.tipo === 'receita' ? null : dados.cartao_id,
        conta_id: dados.cartao_id && dados.tipo === 'despesa' ? null : dados.conta_id,
        household_id: profile?.household_id ?? null,
      }
      const consulta = id
        ? supabase.from('lancamentos').update(registro).eq('id', id)
        : supabase.from('lancamentos').insert({ ...registro, owner_id: user!.id })
      const { error } = await consulta
      if (error) throw error
    },
    onSuccess: () => invalidarFinanceiro(qc),
  })
}

export function useExcluirLancamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lancamentos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidarFinanceiro(qc),
  })
}

export function useAlternarPago() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, pago }: { id: string; pago: boolean }) => {
      const { error } = await supabase.from('lancamentos').update({ pago }).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, pago }) => {
      // Atualização otimista: o checkbox responde na hora.
      await qc.cancelQueries({ queryKey: ['lancamentos'] })
      qc.setQueriesData<Lancamento[]>({ queryKey: ['lancamentos'] }, (lista) =>
        lista?.map((l) => (l.id === id ? { ...l, pago } : l)),
      )
    },
    onSettled: () => invalidarFinanceiro(qc),
  })
}
