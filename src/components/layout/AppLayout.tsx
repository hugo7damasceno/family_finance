import { NavLink, Outlet } from 'react-router-dom'
import { LogOut, Menu } from 'lucide-react'
import { useAuth } from '@/auth/auth-context'
import { modulos } from '@/config/modulos'
import { cn } from '@/lib/cn'

export function AppLayout() {
  const { profile, household, sair } = useAuth()
  const visiveis = modulos.filter((m) => !m.somenteCasal || household)
  const atalhos = visiveis.filter((m) => m.atalhoMobile)

  return (
    <div className="min-h-dvh md:flex">
      {/* Menu lateral (tablet/desktop) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <img src="/favicon.svg" alt="" className="size-9" />
          <div className="leading-tight">
            <p className="font-bold text-slate-900">Family Finance</p>
            <p className="text-xs text-slate-500">{household ? household.nome : 'Conta individual'}</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3" aria-label="Principal">
          {visiveis.map((m) => (
            <NavLink
              key={m.rota}
              to={m.rota}
              end={m.rota === '/'}
              className={({ isActive }) =>
                cn(
                  'mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100',
                )
              }
            >
              <m.icone className="size-5" aria-hidden />
              {m.titulo}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <p className="truncate px-3 pb-2 text-sm text-slate-600">{profile?.nome}</p>
          <button
            onClick={sair}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <LogOut className="size-5" aria-hidden /> Sair
          </button>
        </div>
      </aside>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-10">
        <Outlet />
      </main>

      {/* Barra inferior (celular) */}
      <nav
        aria-label="Atalhos"
        className="pb-safe fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
      >
        <div className="grid grid-cols-5">
          {atalhos.map((m) => (
            <NavLink
              key={m.rota}
              to={m.rota}
              end={m.rota === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
                  isActive ? 'text-brand-700' : 'text-slate-500',
                )
              }
            >
              <m.icone className="size-6" aria-hidden />
              {m.titulo.split(' ')[0]}
            </NavLink>
          ))}
          <NavLink
            to="/mais"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
                isActive ? 'text-brand-700' : 'text-slate-500',
              )
            }
          >
            <Menu className="size-6" aria-hidden />
            Mais
          </NavLink>
        </div>
      </nav>
    </div>
  )
}
