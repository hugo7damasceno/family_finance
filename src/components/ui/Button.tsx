import type { ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo'

const estilos: Record<Variante, string> = {
  primario: 'bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-700/50',
  secundario: 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  fantasma: 'text-slate-700 hover:bg-slate-100 disabled:text-slate-400',
  perigo: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/50',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  carregando?: boolean
}

export function Button({ variante = 'primario', carregando, disabled, className, children, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || carregando}
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed',
        estilos[variante],
        className,
      )}
    >
      {carregando && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}
