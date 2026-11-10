import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/cn'
import { centavosDeTexto, formatarBRLSempre } from '@/lib/money'

const inputBase =
  'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 placeholder:text-slate-400 ' +
  'focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 aria-[invalid=true]:border-red-500 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500'

interface CampoProps {
  label: string
  erro?: string
  ajuda?: ReactNode
  /** Motivo de o campo estar bloqueado. Quando informado, o campo fica desabilitado e o motivo aparece. */
  bloqueio?: string
  children: (id: string, describedBy: string | undefined) => ReactNode
}

/** Envolve um controle com label, texto de ajuda e mensagem de erro acessíveis. */
export function Campo({ label, erro, ajuda, bloqueio, children }: CampoProps) {
  const id = useId()
  const descId = erro || ajuda || bloqueio ? `${id}-desc` : undefined
  return (
    // title: dica ao passar o cursor; o texto abaixo cobre o celular (sem cursor).
    <div className="flex flex-col gap-1.5" title={bloqueio}>
      <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
        {label}
        {bloqueio && <Lock className="size-3.5 text-slate-400" aria-hidden />}
      </label>
      {children(id, descId)}
      {bloqueio && !erro ? (
        <p id={descId} className="text-sm text-slate-500">
          {bloqueio}
        </p>
      ) : erro ? (
        <p id={descId} className="text-sm text-red-600">
          {erro}
        </p>
      ) : (
        ajuda && (
          <p id={descId} className="text-sm text-slate-500">
            {ajuda}
          </p>
        )
      )}
    </div>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  erro?: string
  ajuda?: ReactNode
  bloqueio?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, erro, ajuda, bloqueio, className, disabled, ...rest },
  ref,
) {
  return (
    <Campo label={label} erro={erro} ajuda={ajuda} bloqueio={bloqueio}>
      {(id, descId) => (
        <input
          ref={ref}
          id={id}
          aria-invalid={Boolean(erro)}
          aria-describedby={descId}
          className={cn(inputBase, className)}
          disabled={disabled || Boolean(bloqueio)}
          {...rest}
        />
      )}
    </Campo>
  )
})

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  erro?: string
  ajuda?: ReactNode
  bloqueio?: string
}

export function Select({ label, erro, ajuda, bloqueio, className, disabled, children, ...rest }: SelectProps) {
  return (
    <Campo label={label} erro={erro} ajuda={ajuda} bloqueio={bloqueio}>
      {(id, descId) => (
        <select
          id={id}
          aria-invalid={Boolean(erro)}
          aria-describedby={descId}
          className={cn(inputBase, 'appearance-auto', className)}
          disabled={disabled || Boolean(bloqueio)}
          {...rest}
        >
          {children}
        </select>
      )}
    </Campo>
  )
}

interface MoneyInputProps {
  label: string
  valor: number
  onChange: (cents: number) => void
  erro?: string
  ajuda?: ReactNode
  bloqueio?: string
}

/** Campo de valor em reais. Guarda centavos; o usuário digita só números. */
export function MoneyInput({ label, valor, onChange, erro, ajuda, bloqueio }: MoneyInputProps) {
  return (
    <Campo label={label} erro={erro} ajuda={ajuda} bloqueio={bloqueio}>
      {(id, descId) => (
        <input
          id={id}
          disabled={Boolean(bloqueio)}
          inputMode="numeric"
          aria-invalid={Boolean(erro)}
          aria-describedby={descId}
          className={cn(inputBase, 'tabular-nums')}
          value={formatarBRLSempre(valor)}
          onChange={(e) => onChange(centavosDeTexto(e.target.value))}
        />
      )}
    </Campo>
  )
}

export function PercentInput({ label, valor, onChange, erro, ajuda }: MoneyInputProps) {
  return (
    <Campo label={label} erro={erro} ajuda={ajuda}>
      {(id, descId) => (
        <div className="relative">
          <input
            id={id}
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step={0.5}
            aria-invalid={Boolean(erro)}
            aria-describedby={descId}
            className={cn(inputBase, 'pr-9 tabular-nums')}
            value={Number.isNaN(valor) ? '' : valor}
            onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500">%</span>
        </div>
      )}
    </Campo>
  )
}
