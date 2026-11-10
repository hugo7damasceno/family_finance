import { CheckCircle2, Clock, Repeat, Shuffle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { formatarBRL } from '@/lib/money'
import type { Movimento } from './api'
import { COR_DESPESAS } from './cores'

// Status "pago" usa a cor de status reservada (verde), sempre com ícone + texto.
const COR_PAGO = '#0ca30c'
const COR_TRILHA = '#e2e8f0'

/**
 * Despesas do mês em duas leituras:
 *  - pago x a pagar;
 *  - fixas (recorrentes, parcelas e categorias fixas) x variáveis.
 */
export function ResumoDespesas({
  movimentos,
  categoriasFixas,
}: {
  movimentos: Movimento[]
  categoriasFixas: Set<string>
}) {
  const despesas = movimentos.filter((m) => m.tipo === 'despesa')
  const total = despesas.reduce((s, m) => s + m.valor_cents, 0)
  const pago = despesas.filter((m) => m.pago).reduce((s, m) => s + m.valor_cents, 0)
  const aPagar = total - pago
  const ehFixa = (m: Movimento) =>
    Boolean(m.recorrencia_id || m.parcelamento_id || (m.categoria_id && categoriasFixas.has(m.categoria_id)))
  const fixas = despesas.filter(ehFixa).reduce((s, m) => s + m.valor_cents, 0)
  const variaveis = total - fixas
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0)

  return (
    <Card className="mb-4">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="font-semibold text-slate-900">Despesas do mês</h2>
        <p className="text-lg font-bold tabular-nums text-slate-900">{formatarBRL(total)}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <section aria-label="Pago e a pagar">
          <BarraDupla a={{ pct: pct(pago), cor: COR_PAGO }} b={{ pct: pct(aPagar), cor: COR_TRILHA }} />
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <Legenda icone={<CheckCircle2 className="size-4" style={{ color: COR_PAGO }} aria-hidden />} rotulo="Já pago" valor={pago} />
            <Legenda icone={<Clock className="size-4 text-slate-500" aria-hidden />} rotulo="Falta pagar" valor={aPagar} />
          </div>
        </section>

        <section aria-label="Fixas e variáveis">
          <BarraDupla a={{ pct: pct(fixas), cor: COR_DESPESAS }} b={{ pct: pct(variaveis), cor: COR_TRILHA }} />
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <Legenda
              icone={<Repeat className="size-4" style={{ color: COR_DESPESAS }} aria-hidden />}
              rotulo="Fixas"
              valor={fixas}
              dica="Recorrentes, parcelas e categorias fixas (moradia, contas, assinaturas)"
            />
            <Legenda icone={<Shuffle className="size-4 text-slate-500" aria-hidden />} rotulo="Variáveis" valor={variaveis} />
          </div>
        </section>
      </div>
    </Card>
  )
}

/** Barra 100% com dois segmentos e 2px de espaço entre eles. */
function BarraDupla({ a, b }: { a: { pct: number; cor: string }; b: { pct: number; cor: string } }) {
  return (
    <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
      {a.pct > 0 && <div className="h-full rounded-full" style={{ width: `${a.pct}%`, background: a.cor }} />}
      {b.pct > 0 && <div className="h-full flex-1 rounded-full" style={{ background: b.cor }} />}
      {a.pct === 0 && b.pct === 0 && <div className="h-full flex-1 rounded-full" style={{ background: COR_TRILHA }} />}
    </div>
  )
}

function Legenda({ icone, rotulo, valor, dica }: { icone: React.ReactNode; rotulo: string; valor: number; dica?: string }) {
  return (
    <div title={dica}>
      <p className="flex items-center gap-1.5 text-xs text-slate-600">
        {icone}
        {rotulo}
      </p>
      <p className="font-semibold tabular-nums text-slate-900">{formatarBRL(valor)}</p>
    </div>
  )
}
