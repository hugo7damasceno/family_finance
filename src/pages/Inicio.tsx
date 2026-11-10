import { Link } from 'react-router-dom'
import { CalendarClock, Gift, Landmark, PiggyBank, Plus, TrendingUp, Wallet } from 'lucide-react'
import { useAuth } from '@/auth/auth-context'
import { Cabecalho } from '@/components/layout/AuthLayout'
import { BotaoEmDesenvolvimento } from '@/components/EmDesenvolvimento'
import { Card } from '@/components/ui/Card'
import { formatarBRL } from '@/lib/money'
import { calcularPlanoMensal } from '@/lib/planejamento'

const mesAtual = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date())

export function Inicio() {
  const { profile, household, membros } = useAuth()
  if (!profile) return null
  const plano = calcularPlanoMensal(profile)
  const primeiroNome = profile.nome.split(' ')[0]
  const conjugeAusente = household && membros.length < 2

  return (
    <>
      <Cabecalho titulo={`Olá, ${primeiroNome}!`} descricao={`Resumo de ${mesAtual}`} />

      {conjugeAusente && (
        <Card className="mb-4 border-brand-200 bg-brand-50">
          <p className="text-sm text-slate-700">
            Aguardando seu cônjuge entrar na conta conjunta <strong>{household.nome}</strong>. Código de convite:{' '}
            <strong className="font-mono tracking-widest text-brand-800">{household.codigo_convite}</strong>
          </p>
        </Card>
      )}

      <Card className="mb-4 bg-gradient-to-br from-brand-700 to-brand-800 text-white">
        <p className="text-sm text-brand-100">Quanto posso gastar este mês (estimativa)</p>
        <p className="mt-1 text-4xl font-bold tabular-nums">{formatarBRL(plano.disponivel)}</p>
        <p className="mt-2 text-xs text-brand-100">
          Já descontados dízimo, ofertas, reserva e investimento. Contas fixas e parcelas entram assim que forem
          cadastradas.
        </p>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador icone={Wallet} rotulo="Renda líquida" valor={plano.renda} />
        <Indicador icone={Landmark} rotulo="Dízimo + ofertas" valor={plano.dizimo + plano.oferta} />
        <Indicador icone={PiggyBank} rotulo="Reserva do mês" valor={plano.reserva} />
        <Indicador icone={TrendingUp} rotulo="Investimento" valor={plano.investimento} />
      </div>

      <h2 className="mb-3 text-lg font-semibold text-slate-900">Ações rápidas</h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <AcaoRapida para="/lancamentos" estado={{ novo: {} }} icone={Plus} rotulo="Novo lançamento" />
        <AcaoRapida
          para="/lancamentos"
          estado={{ novo: { tipo: 'receita', origem_receita: 'decimo_terceiro', descricao: '13º salário' } }}
          icone={Gift}
          rotulo="Lançar 13º, férias ou restituição"
        />
        <AcaoRapida para="/parcelamentos" icone={CalendarClock} rotulo="Cadastrar compra parcelada" />
        <BotaoEmDesenvolvimento icone={Landmark} rotulo="Conectar banco (Open Finance)" />
      </div>
    </>
  )
}

function Indicador({ icone: Icone, rotulo, valor }: { icone: typeof Wallet; rotulo: string; valor: number }) {
  return (
    <Card className="p-4">
      <Icone className="mb-2 size-5 text-brand-700" aria-hidden />
      <p className="text-xs text-slate-500">{rotulo}</p>
      <p className="text-lg font-semibold tabular-nums text-slate-900">{formatarBRL(valor)}</p>
    </Card>
  )
}

function AcaoRapida({
  para,
  estado,
  icone: Icone,
  rotulo,
}: {
  para: string
  estado?: unknown
  icone: typeof Wallet
  rotulo: string
}) {
  return (
    <Link
      to={para}
      state={estado}
      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:border-brand-200 hover:bg-brand-50"
    >
      <Icone className="size-5 text-brand-700" aria-hidden />
      {rotulo}
    </Link>
  )
}
