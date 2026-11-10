import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatarBRL, valoresOcultos } from '@/lib/money'

import { COR_DESPESAS, COR_RECEITAS } from './cores'

export interface PontoEvolucao {
  mes: string // rótulo curto, ex.: "nov."
  rotulo: string // rótulo completo, ex.: "Novembro de 2026"
  receitas: number
  despesas: number
}

const compacto = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})

function Dica({ active, payload }: { active?: boolean; payload?: { payload: PontoEvolucao }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const saldo = p.receitas - p.despesas
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-slate-900">{p.rotulo}</p>
      <p className="flex items-center gap-2 text-slate-700">
        <span className="size-2.5 rounded-sm" style={{ background: COR_RECEITAS }} aria-hidden />
        Receitas <strong className="ml-auto tabular-nums text-slate-900">{formatarBRL(p.receitas)}</strong>
      </p>
      <p className="flex items-center gap-2 text-slate-700">
        <span className="size-2.5 rounded-sm" style={{ background: COR_DESPESAS }} aria-hidden />
        Despesas <strong className="ml-auto tabular-nums text-slate-900">{formatarBRL(p.despesas)}</strong>
      </p>
      <p className="mt-1 border-t border-slate-100 pt-1 text-slate-700">
        Saldo <strong className="tabular-nums text-slate-900">{formatarBRL(saldo)}</strong>
      </p>
    </div>
  )
}

/** Receitas x despesas por mês (barras agrupadas, um único eixo). */
export default function GraficoEvolucao({ dados }: { dados: PontoEvolucao[] }) {
  return (
    <figure>
      {/* Legenda sempre presente para 2 séries; texto em tinta neutra, cor só no marcador */}
      <figcaption className="mb-2 flex gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: COR_RECEITAS }} aria-hidden /> Receitas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: COR_DESPESAS }} aria-hidden /> Despesas
        </span>
      </figcaption>
      <div className="h-56" role="img" aria-label="Gráfico de receitas e despesas dos últimos meses">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
            <YAxis
              width={64}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickFormatter={(v: number) => (valoresOcultos() ? '•••' : compacto.format(v / 100))}
            />
            <Tooltip content={<Dica />} cursor={{ fill: '#f1f5f9' }} />
            <Bar dataKey="receitas" name="Receitas" fill={COR_RECEITAS} radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="despesas" name="Despesas" fill={COR_DESPESAS} radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Visão em tabela (acessibilidade / leitura exata) */}
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-slate-600">Ver como tabela</summary>
        <table className="mt-2 w-full text-xs">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-1 font-medium">Mês</th>
              <th className="py-1 text-right font-medium">Receitas</th>
              <th className="py-1 text-right font-medium">Despesas</th>
              <th className="py-1 text-right font-medium">Saldo</th>
            </tr>
          </thead>
          <tbody className="tabular-nums text-slate-800">
            {dados.map((p) => (
              <tr key={p.rotulo} className="border-t border-slate-100">
                <td className="py-1">{p.rotulo}</td>
                <td className="py-1 text-right">{formatarBRL(p.receitas)}</td>
                <td className="py-1 text-right">{formatarBRL(p.despesas)}</td>
                <td className="py-1 text-right">{formatarBRL(p.receitas - p.despesas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
