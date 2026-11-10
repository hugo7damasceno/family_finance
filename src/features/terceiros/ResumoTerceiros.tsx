import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronRight, Users } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useCartoes } from '@/features/cartoes/api'
import { hojeISO } from '@/lib/datas'
import { formatarBRL } from '@/lib/money'
import { useMovimentosTerceiros, useTerceiros } from './api'
import { situacaoPorTerceiro } from './calculo'

/** Aviso no painel inicial: quanto terceiros devem e quanto já venceu. Some quando não há pendências. */
export function ResumoTerceiros() {
  const { data: terceiros = [] } = useTerceiros()
  const { data: movs } = useMovimentosTerceiros()
  const { data: cartoes = [] } = useCartoes()
  const hoje = hojeISO()
  const situacoes = useMemo(
    () => situacaoPorTerceiro(movs ?? [], new Map(cartoes.map((c) => [c.id, c])), hoje),
    [movs, cartoes, hoje],
  )

  const ativos = terceiros.filter((t) => !t.arquivado)
  const devendo = ativos.reduce((s, t) => s + (situacoes.get(t.id)?.devendo ?? 0), 0)
  if (devendo === 0) return null
  const comVencido = ativos.filter((t) => (situacoes.get(t.id)?.vencido ?? 0) > 0)
  const vencido = comVencido.reduce((s, t) => s + (situacoes.get(t.id)?.vencido ?? 0), 0)

  return (
    <Link to="/terceiros" className="mb-4 block">
      <Card className="flex items-center gap-3 p-4 hover:border-brand-300">
        <Users className="size-5 shrink-0 text-brand-700" aria-hidden />
        <div className="min-w-0 flex-1 text-sm">
          <p className="text-slate-700">
            A receber de terceiros: <strong className="tabular-nums text-slate-900">{formatarBRL(devendo)}</strong>
          </p>
          {vencido > 0 && (
            <p className="flex items-center gap-1 text-slate-700">
              <AlertTriangle className="size-4 shrink-0" style={{ color: '#d03b3b' }} aria-hidden />
              <span>
                Vencido: <strong className="tabular-nums">{formatarBRL(vencido)}</strong> (
                {comVencido.map((t) => t.nome.split(' ')[0]).join(', ')})
              </span>
            </p>
          )}
        </div>
        <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden />
      </Card>
    </Link>
  )
}
