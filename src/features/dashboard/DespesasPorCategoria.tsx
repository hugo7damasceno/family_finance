import { formatarBRL } from '@/lib/money'
import { COR_DESPESAS } from './cores'

export interface ItemCategoria {
  nome: string
  valor: number
}

const MAX_CATEGORIAS = 6

/**
 * Ranking de despesas por categoria em barras horizontais (uma série, um tom).
 * Acima de 6 categorias, o restante é agrupado em "Outras".
 */
export function DespesasPorCategoria({ itens }: { itens: ItemCategoria[] }) {
  const ordenados = [...itens].sort((a, b) => b.valor - a.valor)
  const principais = ordenados.slice(0, MAX_CATEGORIAS)
  const resto = ordenados.slice(MAX_CATEGORIAS).reduce((s, i) => s + i.valor, 0)
  const linhas = resto > 0 ? [...principais, { nome: 'Outras', valor: resto }] : principais
  const total = itens.reduce((s, i) => s + i.valor, 0)
  const maior = linhas[0]?.valor ?? 0

  if (linhas.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">Nenhuma despesa neste mês.</p>
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {linhas.map((l) => {
        const pct = total > 0 ? (l.valor / total) * 100 : 0
        return (
          <li key={l.nome} title={`${l.nome}: ${formatarBRL(l.valor)} (${pct.toFixed(1).replace('.', ',')}% do total)`}>
            <div className="mb-1 flex justify-between gap-3 text-sm">
              <span className="truncate text-slate-700">{l.nome}</span>
              <span className="shrink-0 tabular-nums text-slate-900">
                {formatarBRL(l.valor)}
                <span className="ml-1.5 text-xs text-slate-500">{Math.round(pct)}%</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${maior > 0 ? (l.valor / maior) * 100 : 0}%`, background: COR_DESPESAS }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
