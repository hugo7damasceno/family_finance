import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { centavosDeTexto, formatarBRL } from '@/lib/money'

const inputBase =
  'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 placeholder:text-slate-400 ' +
  'focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 aria-[invalid=true]:border-red-500'

interface CampoProps {
  label: string
  erro?: string
  ajuda?: ReactNode
  children: (id: string, describedBy: string | undefined) => ReactNode
}

/** Envolve um controle com label, texto de ajuda e mensagem de erro acessíveis. */
export function Campo({ label, erro, ajuda, children }: CampoProps) {
  const id = useId()
  const descId = erro || ajuda ? `${id}-desc` : undefined
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      {children(id, descId)}
      {erro ? (
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
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, erro, ajuda, className, ...rest },
  ref,
) {
  return (
    <Campo label={label} erro={erro} ajuda={ajuda}>
      {(id, descId) => (
        <input
          ref={ref}
          id={id}
          aria-invalid={Boolean(erro)}
          aria-describedby={descId}
          className={cn(inputBase, className)}
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
}

export function Select({ label, erro, ajuda, className, children, ...rest }: SelectProps) {
  return (
    <Campo label={label} erro={erro} ajuda={ajuda}>
      {(id, descId) => (
        <select
          id={id}
          aria-invalid={Boolean(erro)}
          aria-describedby={descId}
          className={cn(inputBase, 'appearance-auto', className)}
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
}

/** Campo de valor em reais. Guarda centavos; o usuário digita só números. */
export function MoneyInput({ label, valor, onChange, erro, ajuda }: MoneyInputProps) {
  return (
    <Campo label={label} erro={erro} ajuda={ajuda}>
      {(id, descId) => (
        <input
          id={id}
          inputMode="numeric"
          aria-invalid={Boolean(erro)}
          aria-describedby={descId}
          className={cn(inputBase, 'tabular-nums')}
          value={formatarBRL(valor)}
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
