import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, HeartPulse, MinusCircle, XCircle } from 'lucide-react'
import { useAuth } from '@/auth/auth-context'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { cn } from '@/lib/cn'
import { formatarBRL } from '@/lib/money'
import { useDadosSaude } from './api'
import { calcularSaude, type Status } from './calculo'

// Paleta de status reservada (skill dataviz): nunca usada para séries; sempre com ícone + texto.
const STATUS: Record<Status, { cor: string; Icone: typeof CheckCircle2; texto: string }> = {
  bom: { cor: '#0ca30c', Icone: CheckCircle2, texto: 'Saudável' },
  atencao: { cor: '#fab219', Icone: AlertTriangle, texto: 'Atenção' },
  critico: { cor: '#d03b3b', Icone: XCircle, texto: 'Crítico' },
  sem_dados: { cor: '#94a3b8', Icone: MinusCircle, texto: 'Sem dados' },
}

export function CartaoSaude({ mes }: { mes: string }) {
  const { household } = useAuth()
  const { data, isPending, error } = useDadosSaude(mes)
  const [aberto, setAberto] = useState(false)

  const titulo = household ? 'Saúde financeira do casal' : 'Saúde financeira'

  if (isPending) {
    return (
      <Card className="mb-4">
        <h2 className="font-semibold text-slate-900">{titulo}</h2>
        <Carregando />
      </Card>
    )
  }
  if (error || !data) {
    return (
      <Card className="mb-4">
        <h2 className="font-semibold text-slate-900">{titulo}</h2>
        <p className="mt-2 text-sm text-slate-500">Não foi possível calcular agora.</p>
      </Card>
    )
  }

  const s = calcularSaude(data, mes)
  const geral = STATUS[s.status]
  const dicas = s.indicadores.filter((i) => i.dica && i.status !== 'bom')

  return (
    <Card className="mb-4">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <HeartPulse className="size-5 text-brand-700" aria-hidden /> {titulo}
          </h2>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-bold tabular-nums text-slate-900">{s.nota ?? '—'}</span>
            {s.nota !== null && <span className="text-sm text-slate-500">/ 100</span>}
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
            <geral.Icone className="size-4" style={{ color: geral.cor }} aria-hidden />
            {s.rotulo}
          </p>
        </div>
      </div>

      {s.nota !== null && (
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
          role="meter"
          aria-valuenow={s.nota}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Nota de saúde financeira"
        >
          <div className="h-full rounded-full" style={{ width: `${s.nota}%`, background: geral.cor }} />
        </div>
      )}

      <ul className="mt-4 divide-y divide-slate-100">
        {s.indicadores.map((i) => {
          const st = STATUS[i.status]
          return (
            <li key={i.chave} className="flex items-center gap-3 py-2" title={i.referencia}>
              <st.Icone className="size-4 shrink-0" style={{ color: st.cor }} aria-label={st.texto} />
              <span className="flex-1 text-sm text-slate-700">{i.titulo}</span>
              <span className="text-sm font-semibold tabular-nums text-slate-900">{i.valor}</span>
            </li>
          )
        })}
      </ul>

      {dicas.length > 0 && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Como melhorar</p>
          <ul className="flex flex-col gap-1.5 text-sm text-slate-700">
            {dicas.slice(0, aberto ? dicas.length : 2).map((i) => (
              <li key={i.chave}>
                <strong className="font-medium">{i.titulo}:</strong> {i.dica}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="mt-3 flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
      >
        {aberto ? 'Menos detalhes' : 'Como a nota é calculada'}
        <ChevronDown className={cn('size-4 transition-transform', aberto && 'rotate-180')} aria-hidden />
      </button>
      {aberto && (
        <div className="mt-2 text-xs text-slate-600">
          <ul className="mb-2 flex flex-col gap-1">
            {s.indicadores.map((i) => (
              <li key={i.chave}>
                <strong className="font-medium text-slate-800">{i.titulo}</strong> (peso {i.peso}): {i.referencia}
              </li>
            ))}
          </ul>
          <p>
            Base: renda líquida de {formatarBRL(Math.round(s.base.rendaMensal))}/mês
            {s.base.estimada ? ' (do cadastro)' : ''} e custo de vida de {formatarBRL(Math.round(s.base.custoMensal))}/mês,
            {s.base.meses > 1 ? ` média dos últimos ${s.base.meses} meses` : ' considerando o mês atual'}.
            {household && ' Soma os números dos dois, sem mostrar os valores de cada um.'} Dízimo e ofertas não entram como
            despesa. A reserva considera os cofrinhos do tipo “Reserva de emergência”.
          </p>
        </div>
      )}
    </Card>
  )
}
