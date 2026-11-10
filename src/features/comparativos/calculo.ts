import { competencia, type Movimento } from '@/features/dashboard/api'

/** Despesas por mês de competência ('AAAA-MM') e por categoria (nome). */
export type DespesasPorMes = Map<string, Map<string, number>>

export function agruparDespesas(movs: Movimento[], nomeCategoria: (id: string | null) => string): DespesasPorMes {
  const porMes: DespesasPorMes = new Map()
  for (const m of movs) {
    if (m.tipo !== 'despesa') continue
    const mes = competencia(m)
    const cats = porMes.get(mes) ?? new Map<string, number>()
    const nome = nomeCategoria(m.categoria_id)
    cats.set(nome, (cats.get(nome) ?? 0) + m.valor_cents)
    porMes.set(mes, cats)
  }
  return porMes
}

/** Soma as categorias de vários meses. */
export function somarMeses(porMes: DespesasPorMes, meses: string[]): Map<string, number> {
  const total = new Map<string, number>()
  for (const mes of meses) {
    for (const [nome, v] of porMes.get(mes) ?? []) total.set(nome, (total.get(nome) ?? 0) + v)
  }
  return total
}

export const totalDe = (cats: Map<string, number> | undefined) => [...(cats ?? new Map<string, number>()).values()].reduce((s, v) => s + v, 0)

/** Variação relativa; null quando não há base de comparação. */
export function variacao(atual: number, anterior: number): number | null {
  return anterior > 0 ? (atual - anterior) / anterior : null
}

export interface LinhaComparativo {
  nome: string
  atual: number
  anterior: number
  diferenca: number
  variacao: number | null
}

/** Uma linha por categoria presente em qualquer dos períodos; maiores gastos atuais primeiro. */
export function compararCategorias(atual: Map<string, number>, anterior: Map<string, number>): LinhaComparativo[] {
  const nomes = new Set([...atual.keys(), ...anterior.keys()])
  return [...nomes]
    .map((nome) => {
      const a = atual.get(nome) ?? 0
      const b = anterior.get(nome) ?? 0
      return { nome, atual: a, anterior: b, diferenca: a - b, variacao: variacao(a, b) }
    })
    .sort((x, y) => y.atual - x.atual || y.anterior - x.anterior)
}

/** Meses 'AAAA-MM' de um ano, de janeiro até `ate` (1–12). */
export function mesesDoAno(ano: number, ate = 12): string[] {
  return Array.from({ length: ate }, (_, i) => `${ano}-${String(i + 1).padStart(2, '0')}`)
}
