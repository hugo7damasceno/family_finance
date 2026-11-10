// Tipos espelhando supabase/migrations/0001_init.sql.
// Quando o projeto Supabase estiver criado, podem ser gerados com:
//   npx supabase gen types typescript --project-id <id> > src/types/supabase.ts

export type Escopo = 'individual' | 'casal'

export interface Profile {
  id: string
  nome: string
  household_id: string | null
  renda_mensal_cents: number
  dizimista: boolean
  percentual_dizimo: number
  ofertante: boolean
  percentual_oferta: number
  investe: boolean
  investimento_mensal_cents: number
  percentual_reserva: number
  onboarding_concluido: boolean
  created_at: string
  updated_at: string
}

export type TipoLancamento = 'receita' | 'despesa' | 'transferencia'
export type OrigemReceita = 'salario' | 'decimo_terceiro' | 'ferias' | 'restituicao' | 'outros'

export interface Categoria {
  id: string
  owner_id: string | null
  household_id: string | null
  escopo: Escopo
  nome: string
  tipo: 'receita' | 'despesa'
  icone: string | null
  cor: string | null
  fixa: boolean
}

export interface Lancamento {
  id: string
  owner_id: string
  household_id: string | null
  escopo: Escopo
  tipo: TipoLancamento
  origem_receita: OrigemReceita | null
  descricao: string
  valor_cents: number
  data: string
  categoria_id: string | null
  conta_id: string | null
  conta_destino_id: string | null
  cartao_id: string | null
  fatura_mes: string | null
  parcelamento_id: string | null
  parcela_numero: number | null
  terceiro_id: string | null
  pago: boolean
  gerado_de_id: string | null
  recorrencia_id: string | null
  observacao: string | null
  created_at: string
}

export interface Recorrencia {
  id: string
  owner_id: string
  household_id: string | null
  escopo: Escopo
  tipo: 'receita' | 'despesa'
  origem_receita: OrigemReceita | null
  descricao: string
  valor_cents: number
  categoria_id: string | null
  conta_id: string | null
  cartao_id: string | null
  dia_do_mes: number
  inicio: string
  fim: string | null
  gerada_ate: string | null
  ativa: boolean
  created_at: string
}

export type TipoConta = 'corrente' | 'poupanca' | 'dinheiro' | 'reserva' | 'cofrinho' | 'outro'

export interface Conta {
  id: string
  owner_id: string
  household_id: string | null
  escopo: Escopo
  nome: string
  tipo: TipoConta
  saldo_inicial_cents: number
  arquivada: boolean
  /** Cofrinho: valor-alvo */
  meta_cents: number | null
  /** Cofrinho: data-alvo (AAAA-MM-DD) */
  data_meta: string | null
  /** Cofrinho: emoji */
  icone: string | null
  /** Cofrinho: meta conquistada em */
  concluido_em: string | null
  created_at: string
}

export interface Cartao {
  id: string
  owner_id: string
  household_id: string | null
  escopo: Escopo
  nome: string
  bandeira: string | null
  limite_cents: number | null
  dia_fechamento: number
  dia_vencimento: number
  arquivado: boolean
  created_at: string
}

export interface Parcelamento {
  id: string
  owner_id: string
  household_id: string | null
  escopo: Escopo
  descricao: string
  valor_total_cents: number
  num_parcelas: number
  data_primeira: string
  categoria_id: string | null
  cartao_id: string | null
  terceiro_id: string | null
  created_at: string
}

export interface ResumoFatura {
  total_cents: number
  privado_cents: number
  pago: boolean
  data_pagamento: string | null
  conta_pagamento: string | null
}

export interface Household {
  id: string
  nome: string
  codigo_convite: string
  percentual_reserva: number
  divisao_sobra: 'igual' | 'proporcional_renda'
  data_casamento: string | null
  criado_por: string
  created_at: string
}
