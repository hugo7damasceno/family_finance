import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { COR_DESPESAS } from '@/features/dashboard/cores'
import { formatarBRL, valoresOcultos } from '@/lib/money'

/** Período anterior em cinza neutro: comparação, não uma nova categoria. */
export const COR_PERIODO_ANTERIOR = '#64748b'

export interface PontoComparativo {
  eixo: string // rótulo curto do eixo, ex.: "nov."
  rotulo: string // rótulo completo para dica e tabela
  atual: number
  anterior?: number
}

interface Props {
  dados: PontoComparativo[]
  nomeAtual: string
  /** Sem `nomeAnterior`, o gráfico tem uma série só. */
  nomeAnterior?: string
  /** Índice da barra em destaque (as demais ficam esmaecidas). */
  destaque?: number
  descricao: string
}

const compacto = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})

function Marcador({ cor }: { cor: string }) {
  return <span className="size-2.5 shrink-0 rounded-sm" style={{ background: cor }} aria-hidden />
}

function Dica({
  active,
  payload,
  nomeAtual,
  nomeAnterior,
}: {
  active?: boolean
  payload?: { payload: PontoComparativo }[]
  nomeAtual: string
  nomeAnterior?: string
}) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-slate-900">{p.rotulo}</p>
      <p className="flex items-center gap-2 text-slate-700">
        <Marcador cor={COR_DESPESAS} /> {nomeAtual}
        <strong className="ml-auto pl-3 tabular-nums text-slate-900">{formatarBRL(p.atual)}</strong>
      </p>
      {nomeAnterior && (
        <p className="flex items-center gap-2 text-slate-700">
          <Marcador cor={COR_PERIODO_ANTERIOR} /> {nomeAnterior}
          <strong className="ml-auto pl-3 tabular-nums text-slate-900">{formatarBRL(p.anterior ?? 0)}</strong>
        </p>
      )}
    </div>
  )
}

/** Despesas por mês em barras (um único eixo), com visão em tabela. */
export default function GraficoComparativo({ dados, nomeAtual, nomeAnterior, destaque, descricao }: Props) {
  return (
    <figure>
      {nomeAnterior && (
        <figcaption className="mb-2 flex gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <Marcador cor={COR_DESPESAS} /> {nomeAtual}
          </span>
          <span className="flex items-center gap-1.5">
            <Marcador cor={COR_PERIODO_ANTERIOR} /> {nomeAnterior}
          </span>
        </figcaption>
      )}
      <div className="h-56" role="img" aria-label={descricao}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} barGap={2} barCategoryGap={nomeAnterior ? '24%' : '18%'} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="eixo" tickLine={false} axisLine={false} interval={0} tick={{ fill: '#64748b', fontSize: 11 }} />
            <YAxis
              width={64}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickFormatter={(v: number) => (valoresOcultos() ? '•••' : compacto.format(v / 100))}
            />
            <Tooltip content={<Dica nomeAtual={nomeAtual} nomeAnterior={nomeAnterior} />} cursor={{ fill: '#f1f5f9' }} />
            {nomeAnterior && (
              <Bar dataKey="anterior" name={nomeAnterior} fill={COR_PERIODO_ANTERIOR} radius={[4, 4, 0, 0]} maxBarSize={22} />
            )}
            <Bar dataKey="atual" name={nomeAtual} fill={COR_DESPESAS} radius={[4, 4, 0, 0]} maxBarSize={nomeAnterior ? 22 : 32}>
              {destaque !== undefined &&
                dados.map((_, i) => <Cell key={i} fillOpacity={i === destaque ? 1 : 0.4} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-slate-600">Ver como tabela</summary>
        <table className="mt-2 w-full text-xs">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-1 font-medium">Mês</th>
              <th className="py-1 text-right font-medium">{nomeAtual}</th>
              {nomeAnterior && <th className="py-1 text-right font-medium">{nomeAnterior}</th>}
            </tr>
          </thead>
          <tbody className="tabular-nums text-slate-800">
            {dados.map((p) => (
              <tr key={p.rotulo} className="border-t border-slate-100">
                <td className="py-1">{p.rotulo}</td>
                <td className="py-1 text-right">{formatarBRL(p.atual)}</td>
                {nomeAnterior && <td className="py-1 text-right">{formatarBRL(p.anterior ?? 0)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
