import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/auth-context'
import { Cabecalho } from '@/components/layout/AuthLayout'
import { Card } from '@/components/ui/Card'
import { formatarBRL } from '@/lib/money'

export function Configuracoes() {
  const { profile, household, membros, user } = useAuth()
  if (!profile) return null

  return (
    <>
      <Cabecalho titulo="Configurações" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold text-slate-900">Perfil</h2>
          <dl className="space-y-2 text-sm">
            <Item rotulo="Nome" valor={profile.nome} />
            <Item rotulo="E-mail" valor={user?.email ?? ''} />
            <Item rotulo="Renda líquida" valor={formatarBRL(profile.renda_mensal_cents)} />
            <Item rotulo="Dízimo" valor={profile.dizimista ? `${profile.percentual_dizimo}%` : 'Não'} />
            <Item rotulo="Oferta" valor={profile.ofertante ? `${profile.percentual_oferta}%` : 'Não'} />
            <Item rotulo="Reserva de emergência" valor={`${profile.percentual_reserva}%`} />
            <Item
              rotulo="Investimento mensal"
              valor={profile.investe ? formatarBRL(profile.investimento_mensal_cents) : 'Não'}
            />
          </dl>
          <Link to="/bem-vindo" className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline">
            Refazer questionário
          </Link>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold text-slate-900">Conta conjunta</h2>
          {household ? (
            <dl className="space-y-2 text-sm">
              <Item rotulo="Família" valor={household.nome} />
              <Item rotulo="Membros" valor={membros.map((m) => m.nome).join(' e ')} />
              {membros.length < 2 && (
                <Item
                  rotulo="Código de convite"
                  valor={<span className="font-mono tracking-widest">{household.codigo_convite}</span>}
                />
              )}
            </dl>
          ) : (
            <p className="text-sm text-slate-600">Você está usando uma conta individual.</p>
          )}
        </Card>
      </div>
    </>
  )
}

function Item({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{rotulo}</dt>
      <dd className="text-right font-medium text-slate-900">{valor}</dd>
    </div>
  )
}
