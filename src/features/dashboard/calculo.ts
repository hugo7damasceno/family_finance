import { percentual } from '@/lib/money'
import type { Household, Profile } from '@/types/database'
import type { ContribuicaoMembro, Movimento } from './api'

export interface LinhaPlano {
  rotulo: string
  valor: number
  /** Linha de subtotal (destacada). */
  subtotal?: boolean
  estimado?: boolean
}

export interface PlanoDoMes {
  /** Quanto ainda posso gastar no mês. */
  disponivel: number
  /** Orçamento pessoal do mês (antes das minhas despesas individuais). */
  orcamento: number
  /** Minhas despesas individuais do mês. */
  gasto: number
  reserva: number
  investimento: number
  /** Passo a passo do cálculo, para mostrar ao usuário. */
  linhas: LinhaPlano[]
  usaEstimativa: boolean
}

interface Entrada {
  movimentosDoMes: Movimento[]
  contribuicoes: ContribuicaoMembro[]
  profile: Profile
  household: Household | null
  userId: string
  /** IDs das categorias Dízimo e Oferta (já contadas nas contribuições). */
  categoriasContribuicao: Set<string>
}

/**
 * Regra do cliente (documentação/decisoes.md):
 * - Individual: (receitas − dízimo/oferta) − reserva − investimento − minhas despesas.
 * - Conta conjunta: receitas de ambos menos dízimo/oferta formam o fundo comum.
 *   Do fundo saem as despesas da casa e a reserva; a sobra é dividida entre o casal.
 *   Da minha parte saem meu investimento e minhas despesas individuais.
 */
export function calcularPlanoDoMes(e: Entrada): PlanoDoMes {
  const { movimentosDoMes, contribuicoes, profile, household, userId, categoriasContribuicao } = e
  const despesas = movimentosDoMes.filter(
    (m) => m.tipo === 'despesa' && !(m.categoria_id && categoriasContribuicao.has(m.categoria_id)),
  )
  const gasto = despesas
    .filter((m) => m.escopo === 'individual' && m.owner_id === userId)
    .reduce((s, m) => s + m.valor_cents, 0)
  const investimento = profile.investe ? profile.investimento_mensal_cents : 0

  const eu = contribuicoes.find((c) => c.membro_id === userId) ?? {
    membro_id: userId,
    nome: profile.nome,
    receitas_cents: profile.renda_mensal_cents,
    contribuicoes_cents: 0,
    estimado: true,
  }
  const minhaLiquida = eu.receitas_cents - eu.contribuicoes_cents
  const usaEstimativa = contribuicoes.some((c) => c.estimado)
  const linhas: LinhaPlano[] = []

  let orcamento: number
  let reserva: number

  if (!household) {
    reserva = percentual(minhaLiquida, profile.percentual_reserva)
    orcamento = minhaLiquida - reserva - investimento
    linhas.push(
      { rotulo: 'Receitas do mês', valor: eu.receitas_cents, estimado: eu.estimado },
      { rotulo: 'Dízimo e ofertas', valor: -eu.contribuicoes_cents, estimado: eu.estimado },
      { rotulo: `Reserva de emergência (${profile.percentual_reserva}%)`, valor: -reserva },
      { rotulo: 'Investimento', valor: -investimento },
      { rotulo: 'Orçamento para gastar', valor: orcamento, subtotal: true },
      { rotulo: 'Despesas do mês', valor: -gasto },
    )
  } else {
    const fundo = contribuicoes.reduce((s, c) => s + c.receitas_cents - c.contribuicoes_cents, 0)
    const despesasCasa = despesas.filter((m) => m.escopo === 'casal').reduce((s, m) => s + m.valor_cents, 0)
    reserva = percentual(fundo, household.percentual_reserva)
    const sobra = fundo - despesasCasa - reserva
    const membros = Math.max(1, contribuicoes.length)
    const minhaParte =
      household.divisao_sobra === 'proporcional_renda' && fundo > 0
        ? Math.round((sobra * minhaLiquida) / fundo)
        : Math.round(sobra / membros)
    orcamento = minhaParte - investimento
    linhas.push(
      { rotulo: 'Fundo comum (após dízimo e ofertas)', valor: fundo, estimado: usaEstimativa },
      { rotulo: 'Despesas da casa', valor: -despesasCasa },
      { rotulo: `Reserva de emergência (${household.percentual_reserva}%)`, valor: -reserva },
      { rotulo: 'Sobra do casal', valor: sobra, subtotal: true },
      {
        rotulo: household.divisao_sobra === 'proporcional_renda' ? 'Minha parte (proporcional)' : `Minha parte (1/${membros})`,
        valor: minhaParte,
        subtotal: true,
      },
      { rotulo: 'Meu investimento', valor: -investimento },
      { rotulo: 'Minhas despesas individuais', valor: -gasto },
    )
  }

  const disponivel = orcamento - gasto
  linhas.push({ rotulo: 'Disponível para gastar', valor: disponivel, subtotal: true })
  return { disponivel, orcamento, gasto, reserva, investimento, linhas, usaEstimativa }
}
