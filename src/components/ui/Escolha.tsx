import { cn } from '@/lib/cn'

interface Opcao<T extends string> {
  valor: T
  titulo: string
  descricao?: string
}

interface Props<T extends string> {
  legenda: string
  opcoes: Opcao<T>[]
  valor: T
  onChange: (valor: T) => void
}

/** Grupo de opções em cartões (radio acessível). */
export function Escolha<T extends string>({ legenda, opcoes, valor, onChange }: Props<T>) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium text-slate-700">{legenda}</legend>
      {opcoes.map((o) => (
        <label
          key={o.valor}
          className={cn(
            'flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-colors',
            valor === o.valor ? 'border-brand-600 bg-brand-50' : 'border-slate-300 bg-white hover:bg-slate-50',
          )}
        >
          <input
            type="radio"
            className="mt-0.5 size-4 accent-brand-700"
            checked={valor === o.valor}
            onChange={() => onChange(o.valor)}
          />
          <span className="flex flex-col">
            <span className="text-sm font-semibold text-slate-900">{o.titulo}</span>
            {o.descricao && <span className="text-sm text-slate-600">{o.descricao}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  )
}

/** Pergunta de sim/não. */
export function SimNao({
  legenda,
  valor,
  onChange,
}: {
  legenda: string
  valor: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-slate-700">{legenda}</legend>
      <div className="grid grid-cols-2 gap-2">
        {[true, false].map((v) => (
          <label
            key={String(v)}
            className={cn(
              'flex h-11 cursor-pointer items-center justify-center rounded-xl border text-sm font-semibold transition-colors',
              valor === v
                ? 'border-brand-600 bg-brand-50 text-brand-800'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
            )}
          >
            <input type="radio" className="sr-only" checked={valor === v} onChange={() => onChange(v)} />
            {v ? 'Sim' : 'Não'}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
