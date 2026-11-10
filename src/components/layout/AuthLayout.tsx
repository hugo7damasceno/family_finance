import type { ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { usePrivacidade } from '@/lib/privacidade'

export function AuthLayout({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-brand-50 to-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/favicon.svg" alt="" className="mb-4 size-14" />
          <h1 className="text-2xl font-bold text-slate-900">{titulo}</h1>
          {subtitulo && <p className="mt-1.5 text-sm text-slate-600">{subtitulo}</p>}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
      </div>
    </div>
  )
}

export function Cabecalho({ titulo, descricao, acoes }: { titulo: string; descricao?: string; acoes?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-slate-600">{descricao}</p>}
      </div>
      <div className="flex items-center gap-2">
        <BotaoOlho />
        {acoes}
      </div>
    </header>
  )
}

/** Ícone do olho: mostra ou oculta todos os valores em reais. */
export function BotaoOlho() {
  const { ocultos, alternar } = usePrivacidade()
  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={ocultos}
      aria-label={ocultos ? 'Mostrar valores' : 'Ocultar valores'}
      title={ocultos ? 'Mostrar valores' : 'Ocultar valores'}
      className="flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
    >
      {ocultos ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
    </button>
  )
}
