import { Link } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { useAuth } from '@/auth/auth-context'
import { Card } from '@/components/ui/Card'
import { ehCofrinho } from '@/features/contas/api'
import { progressoCofrinho } from '@/features/contas/cofrinho'
import { cn } from '@/lib/cn'
import { formatarBRL } from '@/lib/money'
import type { Conta } from '@/types/database'

const MAX = 4

/** Cofrinhos ativos com o progresso da meta (painel inicial). */
export function ResumoCofrinhos({ contas, saldos }: { contas: Conta[]; saldos: Map<string, number> | undefined }) {
  const { household } = useAuth()
  const cofrinhos = contas
    .filter((c) => ehCofrinho(c) && !c.arquivada && !c.concluido_em)
    // Reserva de emergência primeiro; depois os de maior saldo.
    .sort((a, b) => Number(b.tipo === 'reserva') - Number(a.tipo === 'reserva') || (saldos?.get(b.id) ?? 0) - (saldos?.get(a.id) ?? 0))
  const total = cofrinhos.reduce((s, c) => s + (saldos?.get(c.id) ?? 0), 0)

  return (
    <Card className="mb-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-semibold text-slate-900">Cofrinhos</h2>
        <Link to="/contas" className="flex items-center text-sm font-medium text-brand-700 hover:underline">
          {cofrinhos.length > 0 ? `Total ${formatarBRL(total)}` : 'Criar cofrinho'}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      {cofrinhos.length === 0 ? (
        <p className="text-sm text-slate-500">
          Separe dinheiro por objetivo (reserva, viagem, IPVA…) e acompanhe quanto falta para cada meta.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {cofrinhos.slice(0, MAX).map((c) => {
            const saldo = saldos?.get(c.id) ?? 0
            const p = progressoCofrinho(c, saldo)
            return (
              <li key={c.id} className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xl" aria-hidden>
                  {c.icone ?? (c.tipo === 'reserva' ? '🛡️' : '🐷')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-1 text-slate-700">
                      <span className="truncate">{c.nome}</span>
                      {household && c.escopo === 'casal' && <Home className="size-3 shrink-0 text-slate-400" aria-label="Do casal" />}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-900">{formatarBRL(saldo)}</span>
                  </span>
                  {p.pct !== null ? (
                    <>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                        <span
                          className={cn('block h-full rounded-full', p.atingida ? 'bg-emerald-600' : 'bg-brand-600')}
                          style={{ width: `${p.pct}%` }}
                        />
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {p.atingida ? 'Meta atingida 🎉' : `${Math.floor(p.pct)}% de ${formatarBRL(c.meta_cents!)}`}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-slate-500">Sem meta definida</span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {cofrinhos.length > MAX && (
        <Link to="/contas" className="mt-3 block text-sm font-medium text-brand-700 hover:underline">
          Ver todos os {cofrinhos.length} cofrinhos
        </Link>
      )}
    </Card>
  )
}
