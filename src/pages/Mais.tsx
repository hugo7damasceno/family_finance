import { Link } from 'react-router-dom'
import { ChevronRight, LogOut } from 'lucide-react'
import { useAuth } from '@/auth/auth-context'
import { Cabecalho } from '@/components/layout/AuthLayout'
import { modulos } from '@/config/modulos'

/** Menu completo para o celular (a barra inferior mostra só os atalhos). */
export function Mais() {
  const { household, sair } = useAuth()
  const itens = modulos.filter((m) => m.rota !== '/' && (!m.somenteCasal || household))

  return (
    <>
      <Cabecalho titulo="Menu" />
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {itens.map((m) => (
          <li key={m.rota}>
            <Link to={m.rota} className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50">
              <m.icone className="size-5 text-brand-700" aria-hidden />
              <span className="flex-1">
                <span className="block text-sm font-medium text-slate-900">{m.titulo}</span>
                <span className="block text-xs text-slate-500">{m.descricao}</span>
              </span>
              <ChevronRight className="size-4 text-slate-400" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <button
        onClick={sair}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-red-600"
      >
        <LogOut className="size-4" aria-hidden /> Sair
      </button>
    </>
  )
}
