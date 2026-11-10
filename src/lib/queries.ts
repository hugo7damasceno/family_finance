import type { QueryClient } from '@tanstack/react-query'

const CHAVES_FINANCEIRAS = ['lancamentos', 'saldos', 'uso-cartoes', 'fatura', 'parcelamentos'] as const

/**
 * Lançamentos afetam saldos, faturas, limites e parcelamentos.
 * Após qualquer alteração financeira, invalida todas essas consultas.
 */
export function invalidarFinanceiro(qc: QueryClient) {
  return Promise.all(CHAVES_FINANCEIRAS.map((k) => qc.invalidateQueries({ queryKey: [k] })))
}

export function mensagemDeErro(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}
