import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border border-slate-200 bg-white p-5 shadow-sm', className)} {...rest} />
}

type TipoAviso = 'info' | 'erro' | 'sucesso' | 'atencao'

const avisoEstilo: Record<TipoAviso, string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  erro: 'border-red-200 bg-red-50 text-red-800',
  sucesso: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  atencao: 'border-amber-200 bg-amber-50 text-amber-900',
}

export function Aviso({
  tipo = 'info',
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { tipo?: TipoAviso }) {
  return (
    <div
      role={tipo === 'erro' ? 'alert' : 'status'}
      className={cn('rounded-xl border px-4 py-3 text-sm', avisoEstilo[tipo], className)}
      {...rest}
    />
  )
}
