import { percentual } from '@/lib/money'
import type { Household, Profile } from '@/types/database'
import type { Movimento, ResumoFundo } from './api'

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
  /** Minhas receitas do mês (ou a renda do cadastro, se nada foi lançado). */
  receitas: number
  /** Meu dízimo + ofertas do mês. */
  contribuicoes: number
  /** Reserva de emergência do mês (no casal, a reserva do fundo comum). */
  reserva: number
  investimento: number
  /** Passo a passo do cálculo, para mostrar ao usuário. */
  linhas: LinhaPlano[]
  /** Meus números são estimativa (ainda sem receita lançada). */
  estimado: boolean
  /** Algum número do cálculo é estimativa (eu ou o cônjuge sem receita lançada). */
  usaEstimativa: boolean
}

interface Entrada {
  movimentosDoMes: Movimento[]
  resumo: ResumoFundo | null
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
 *   Por privacidade, o detalhamento não exibe o total do fundo (só a minha contribuição).
 */
export function calcularPlanoDoMes(e: Entrada): PlanoDoMes {
  const { movimentosDoMes, profile, household, userId, categoriasContribuicao } = e
  const resumo: ResumoFundo = e.resumo ?? {
    receitas_cents: profile.renda_mensal_cents,
    contribuicoes_cents: 0,
    estimado: true,
    fundo_cents: profile.renda_mensal_cents,
    fundo_estimado: true,
    membros: 1,
  }
  const despesas = movimentosDoMes.filter(
    (m) => m.tipo === 'despesa' && !(m.categoria_id && categoriasContribuicao.has(m.categoria_id)),
  )
  const gasto = despesas
    .filter((m) => m.escopo === 'individual' && m.owner_id === userId)
    .reduce((s, m) => s + m.valor_cents, 0)
  const investimento = profile.investe ? profile.investimento_mensal_cents : 0
  const minhaLiquida = resumo.receitas_cents - resumo.contribuicoes_cents
  const linhas: LinhaPlano[] = [
    { rotulo: 'Minha renda líquida do mês', valor: resumo.receitas_cents, estimado: resumo.estimado },
    { rotulo: 'Dízimo e ofertas', valor: -resumo.contribuicoes_cents, estimado: resumo.estimado },
  ]

  let orcamento: number
  let reserva: number

  if (!household) {
    reserva = percentual(minhaLiquida, profile.percentual_reserva)
    orcamento = minhaLiquida - reserva - investimento
    linhas.push(
      { rotulo: `Reserva de emergência (${profile.percentual_reserva}%)`, valor: -reserva },
      { rotulo: 'Investimento', valor: -investimento },
      { rotulo: 'Orçamento para gastar', valor: orcamento, subtotal: true },
      { rotulo: 'Despesas do mês', valor: -gasto },
    )
  } else {
    const fundo = resumo.fundo_cents
    const despesasCasa = despesas.filter((m) => m.escopo === 'casal').reduce((s, m) => s + m.valor_cents, 0)
    reserva = percentual(fundo, household.percentual_reserva)
    const sobra = fundo - despesasCasa - reserva
    const membros = Math.max(1, resumo.membros)
    const proporcional = household.divisao_sobra === 'proporcional_renda' && fundo > 0
    // Cada um arca com a sua fatia das despesas da casa e da reserva.
    const fatia = proporcional ? minhaLiquida / fundo : 1 / membros
    const minhaParte = proporcional ? Math.round(sobra * fatia) : Math.round(sobra / membros)
    orcamento = minhaParte - investimento
    linhas.push(
      { rotulo: 'Minha contribuição ao fundo comum', valor: minhaLiquida, subtotal: true },
      { rotulo: `Despesas da casa (minha parte de ${formatarFracao(fatia)})`, valor: -Math.round(despesasCasa * fatia) },
      { rotulo: `Reserva do casal (${household.percentual_reserva}%, minha parte)`, valor: -Math.round(reserva * fatia) },
      { rotulo: 'Ajuste da divisão entre o casal', valor: minhaParte - Math.round((minhaLiquida - (despesasCasa + reserva) * fatia)) },
      { rotulo: 'Minha parte da sobra', valor: minhaParte, subtotal: true, estimado: resumo.fundo_estimado },
      { rotulo: 'Meu investimento', valor: -investimento },
      { rotulo: 'Minhas despesas individuais', valor: -gasto },
    )
  }

  const disponivel = orcamento - gasto
  linhas.push({ rotulo: 'Disponível para gastar', valor: disponivel, subtotal: true })
  return {
    disponivel,
    orcamento,
    gasto,
    receitas: resumo.receitas_cents,
    contribuicoes: resumo.contribuicoes_cents,
    reserva,
    investimento,
    linhas: linhas.filter((l) => l.subtotal || l.valor !== 0),
    estimado: resumo.estimado,
    usaEstimativa: resumo.fundo_estimado,
  }
}

function formatarFracao(f: number): string {
  if (Math.abs(f - 0.5) < 0.001) return '1/2'
  if (Math.abs(f - 1) < 0.001) return '100%'
  return `${Math.round(f * 100)}%`
}
