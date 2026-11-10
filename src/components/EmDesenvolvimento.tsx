import type { LucideIcon } from 'lucide-react'
import { Clock } from 'lucide-react'

/**
 * Botão desabilitado para integrações planejadas (Open Finance, nota fiscal, B3).
 * Mostra que a funcionalidade existe no roadmap, mas ainda não está disponível.
 */
export function BotaoEmDesenvolvimento({ icone: Icone, rotulo }: { icone: LucideIcon; rotulo: string }) {
  return (
    <button
      type="button"
      disabled
      title="Em desenvolvimento"
      className="flex w-full items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-left text-sm text-slate-500"
    >
      <Icone className="size-5 shrink-0" aria-hidden />
      <span className="flex-1 font-medium">{rotulo}</span>
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
        <Clock className="size-3" aria-hidden /> Em breve
      </span>
    </button>
  )
}
