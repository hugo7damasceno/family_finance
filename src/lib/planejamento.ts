import { percentual } from './money'
import type { Profile } from '@/types/database'

export interface PlanoMensal {
  renda: number
  dizimo: number
  oferta: number
  /** Renda após dízimo e oferta: é o que entra no fundo comum (conta conjunta). */
  aposContribuicoes: number
  reserva: number
  investimento: number
  /** Estimativa de quanto pode ser gasto no mês (ainda sem contas fixas e parcelas). */
  disponivel: number
}

/**
 * Regra definida com o cliente (documentação/decisoes.md):
 * 1. Dízimo e oferta incidem sobre a renda líquida e são individuais.
 * 2. A reserva de emergência é calculada sobre o valor após dízimo e oferta.
 * 3. Investimento mensal sai antes do disponível ("pague-se primeiro").
 */
export function calcularPlanoMensal(
  p: Pick<
    Profile,
    | 'renda_mensal_cents'
    | 'dizimista'
    | 'percentual_dizimo'
    | 'ofertante'
    | 'percentual_oferta'
    | 'investe'
    | 'investimento_mensal_cents'
    | 'percentual_reserva'
  >,
): PlanoMensal {
  const renda = p.renda_mensal_cents
  const dizimo = p.dizimista ? percentual(renda, p.percentual_dizimo) : 0
  const oferta = p.ofertante ? percentual(renda, p.percentual_oferta) : 0
  const aposContribuicoes = renda - dizimo - oferta
  const reserva = percentual(aposContribuicoes, p.percentual_reserva)
  const investimento = p.investe ? p.investimento_mensal_cents : 0
  const disponivel = aposContribuicoes - reserva - investimento
  return { renda, dizimo, oferta, aposContribuicoes, reserva, investimento, disponivel }
}
