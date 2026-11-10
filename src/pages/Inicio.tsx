import { lazy, Suspense, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  CreditCard,
  Gift,
  Landmark,
  PiggyBank,
  Plus,
  Receipt,
  Church,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useAuth } from '@/auth/auth-context'
import { Cabecalho } from '@/components/layout/AuthLayout'
import { BotaoEmDesenvolvimento } from '@/components/EmDesenvolvimento'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { useCartoes } from '@/features/cartoes/api'
import { useContas, useSaldos } from '@/features/contas/api'
import { competencia, useMovimentos, useResumoFundo, type Movimento } from '@/features/dashboard/api'
import { ResumoDespesas } from '@/features/dashboard/ResumoDespesas'
import { calcularPlanoDoMes } from '@/features/dashboard/calculo'
import { DespesasPorCategoria } from '@/features/dashboard/DespesasPorCategoria'
import type { PontoEvolucao } from '@/features/dashboard/GraficoEvolucao'
import { useCategorias } from '@/features/lancamentos/api'
import { cn } from '@/lib/cn'
import { adicionarMeses, hojeISO, mesAtualISO, nomeDoMes, rotuloDoDia } from '@/lib/datas'
import { formatarBRL } from '@/lib/money'

// Recharts só é baixado quando o gráfico aparece.
const GraficoEvolucao = lazy(() => import('@/features/dashboard/GraficoEvolucao'))

const MESES_HISTORICO = 6

export function Inicio() {
  const { profile, household, membros, user } = useAuth()
  const mes = mesAtualISO()
  const mesInicio = adicionarMeses(mes, -(MESES_HISTORICO - 1))
  const movimentos = useMovimentos(mesInicio, mes)
  const resumoFundo = useResumoFundo(mes)
  const { data: categorias = [] } = useCategorias()
  const { data: cartoes = [] } = useCartoes()
  const { data: contas = [] } = useContas()
  const { data: saldos } = useSaldos()
  const [verCalculo, setVerCalculo] = useState(false)

  const nomeCategoria = useMemo(() => new Map(categorias.map((c) => [c.id, c.nome])), [categorias])
  const categoriasFixas = useMemo(() => new Set(categorias.filter((c) => c.fixa).map((c) => c.id)), [categorias])
  const categoriasContribuicao = useMemo(
    () => new Set(categorias.filter((c) => c.owner_id === null && ['Dízimo', 'Oferta'].includes(c.nome)).map((c) => c.id)),
    [categorias],
  )

  if (!profile || !user) return null
  const primeiroNome = profile.nome.split(' ')[0]
  const conjugeAusente = household && membros.length < 2

  if (movimentos.isPending || resumoFundo.isPending) {
    return (
      <>
        <Cabecalho titulo={`Olá, ${primeiroNome}!`} descricao={`Resumo de ${nomeDoMes(mes).toLowerCase()}`} />
        <Carregando />
      </>
    )
  }

  const todos = movimentos.data ?? []
  const doMes = todos.filter((m) => competencia(m) === mes)
  const plano = calcularPlanoDoMes({
    movimentosDoMes: doMes,
    resumo: resumoFundo.data ?? null,
    profile,
    household,
    userId: user.id,
    categoriasContribuicao,
  })

  const saldoContas = contas.filter((c) => !c.arquivada).reduce((s, c) => s + (saldos?.get(c.id) ?? 0), 0)
  const usoOrcamento = plano.orcamento > 0 ? Math.min(100, (plano.gasto / plano.orcamento) * 100) : 0

  const porCategoria = new Map<string, number>()
  for (const m of doMes) {
    if (m.tipo !== 'despesa') continue
    const nome = (m.categoria_id && nomeCategoria.get(m.categoria_id)) || 'Sem categoria'
    porCategoria.set(nome, (porCategoria.get(nome) ?? 0) + m.valor_cents)
  }

  const evolucao: PontoEvolucao[] = Array.from({ length: MESES_HISTORICO }, (_, i) => {
    const m = adicionarMeses(mesInicio, i)
    const doPeriodo = todos.filter((x) => competencia(x) === m)
    const [a, mm] = m.split('-').map(Number)
    return {
      mes: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(a, mm - 1, 1)),
      rotulo: nomeDoMes(m),
      receitas: doPeriodo.filter((x) => x.tipo === 'receita').reduce((s, x) => s + x.valor_cents, 0),
      despesas: doPeriodo.filter((x) => x.tipo === 'despesa').reduce((s, x) => s + x.valor_cents, 0),
    }
  })

  const aPagar = contasAPagar(doMes, cartoes, mes)

  return (
    <>
      <Cabecalho titulo={`Olá, ${primeiroNome}!`} descricao={`Resumo de ${nomeDoMes(mes).toLowerCase()}`} />

      {conjugeAusente && (
        <Card className="mb-4 border-brand-200 bg-brand-50">
          <p className="text-sm text-slate-700">
            Aguardando seu cônjuge entrar na conta conjunta <strong>{household.nome}</strong>. Código de convite:{' '}
            <strong className="font-mono tracking-widest text-brand-800">{household.codigo_convite}</strong>
          </p>
        </Card>
      )}

      {/* Número principal: quanto ainda posso gastar */}
      <Card className="mb-4 bg-gradient-to-br from-brand-700 to-brand-800 text-white">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-brand-100">Disponível para gastar este mês</p>
          {plano.usaEstimativa && (
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs" title="Ainda não há receita lançada; usamos a renda do cadastro">
              estimativa
            </span>
          )}
        </div>
        <p className={cn('mt-1 text-4xl font-bold tabular-nums', plano.disponivel < 0 && 'text-red-200')}>
          {formatarBRL(plano.disponivel)}
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20" aria-hidden>
          <div
            className={cn('h-full rounded-full', usoOrcamento >= 100 ? 'bg-red-300' : usoOrcamento >= 80 ? 'bg-amber-300' : 'bg-brand-200')}
            style={{ width: `${usoOrcamento}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-brand-100">
          Gastou {formatarBRL(plano.gasto)} de {formatarBRL(plano.orcamento)} ({Math.round(usoOrcamento)}%)
        </p>
        <button
          onClick={() => setVerCalculo((v) => !v)}
          aria-expanded={verCalculo}
          className="mt-3 flex items-center gap-1 text-xs font-semibold text-white/90 hover:text-white"
        >
          Como calculamos
          <ChevronDown className={cn('size-4 transition-transform', verCalculo && 'rotate-180')} aria-hidden />
        </button>
        {verCalculo && (
          <dl className="mt-2 divide-y divide-white/10 rounded-xl bg-white/10 px-3 text-sm">
            {plano.linhas.map((l) => (
              <div key={l.rotulo} className={cn('flex justify-between gap-3 py-1.5', l.subtotal && 'font-semibold')}>
                <dt>
                  {l.rotulo}
                  {l.estimado && <span className="ml-1 text-xs opacity-75">(estimado)</span>}
                </dt>
                <dd className="tabular-nums">{formatarBRL(l.valor)}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      {plano.estimado && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-900">
            Você ainda não lançou nenhuma receita em {nomeDoMes(mes).toLowerCase()}. Os valores abaixo usam a renda do
            seu cadastro como <strong>previsão</strong>.
          </p>
          <Link
            to="/lancamentos"
            state={{
              novo: {
                tipo: 'receita',
                origem_receita: 'salario',
                descricao: 'Salário',
                valor_cents: profile.renda_mensal_cents,
              },
            }}
            className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Lançar salário do mês
          </Link>
        </Card>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador
          icone={TrendingUp}
          rotulo={plano.estimado ? 'Renda líquida (prevista)' : 'Renda líquida do mês'}
          valor={plano.receitas}
        />
        <Indicador icone={Church} rotulo="Dízimo e ofertas" valor={plano.contribuicoes} />
        <Indicador
          icone={PiggyBank}
          rotulo={household ? 'Reserva do casal no mês' : 'Reserva do mês'}
          valor={plano.reserva}
          detalhe={plano.investimento > 0 ? `+ ${formatarBRL(plano.investimento)} investimento` : undefined}
        />
        <Indicador icone={Wallet} rotulo="Saldo em contas" valor={saldoContas} link="/contas" />
      </div>

      <ResumoDespesas movimentos={doMes} categoriasFixas={categoriasFixas} />

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
            <CalendarClock className="size-5 text-brand-700" aria-hidden /> Contas a pagar
          </h2>
          {aPagar.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Nenhuma conta pendente este mês. 🎉</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {aPagar.slice(0, 6).map((c) => {
                const vencida = c.data < hojeISO()
                return (
                  <li key={c.chave} className="flex items-center gap-3 py-2.5">
                    {c.cartao ? (
                      <CreditCard className="size-4 shrink-0 text-slate-500" aria-hidden />
                    ) : (
                      <Receipt className="size-4 shrink-0 text-slate-500" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-slate-900">{c.descricao}</span>
                      <span className={cn('flex items-center gap-1 text-xs', vencida ? 'font-medium text-red-600' : 'text-slate-500')}>
                        {vencida && <AlertTriangle className="size-3" aria-hidden />}
                        {vencida ? 'Vencida em ' : 'Vence em '}
                        {rotuloDoDia(c.data)}
                      </span>
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-slate-900">{formatarBRL(c.valor)}</span>
                  </li>
                )
              })}
            </ul>
          )}
          {aPagar.length > 6 && (
            <Link to="/lancamentos" className="mt-2 block text-sm font-medium text-brand-700 hover:underline">
              Ver todas ({aPagar.length})
            </Link>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold text-slate-900">Despesas por categoria</h2>
          <DespesasPorCategoria itens={[...porCategoria].map(([nome, valor]) => ({ nome, valor }))} />
        </Card>
      </div>

      <Card className="mb-6">
        <h2 className="font-semibold text-slate-900">Receitas x despesas</h2>
        <p className="mb-3 text-xs text-slate-500">
          Últimos {MESES_HISTORICO} meses{household && ' · considera os lançamentos que você vê (seus e da casa)'}
        </p>
        <Suspense fallback={<Carregando />}>
          <GraficoEvolucao dados={evolucao} />
        </Suspense>
      </Card>

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

interface ContaAPagar {
  chave: string
  descricao: string
  data: string
  valor: number
  cartao: boolean
}

/** Despesas pendentes do mês + faturas de cartão em aberto, por data de vencimento. */
function contasAPagar(
  doMes: Movimento[],
  cartoes: { id: string; nome: string; dia_vencimento: number }[],
  mes: string,
): ContaAPagar[] {
  const pendentes = doMes.filter((m) => m.tipo === 'despesa' && !m.pago)
  const itens: ContaAPagar[] = pendentes
    .filter((m) => !m.cartao_id)
    .map((m) => ({ chave: m.id, descricao: m.descricao, data: m.data, valor: m.valor_cents, cartao: false }))

  const porCartao = new Map<string, number>()
  for (const m of pendentes) if (m.cartao_id) porCartao.set(m.cartao_id, (porCartao.get(m.cartao_id) ?? 0) + m.valor_cents)
  const [a, mm] = mes.split('-').map(Number)
  const ultimoDia = new Date(a, mm, 0).getDate()
  for (const [id, valor] of porCartao) {
    const c = cartoes.find((x) => x.id === id)
    const dia = String(Math.min(c?.dia_vencimento ?? ultimoDia, ultimoDia)).padStart(2, '0')
    itens.push({ chave: `fatura-${id}`, descricao: `Fatura ${c?.nome ?? 'do cartão'}`, data: `${mes}-${dia}`, valor, cartao: true })
  }
  return itens.sort((x, y) => x.data.localeCompare(y.data))
}

function Indicador({
  icone: Icone,
  rotulo,
  valor,
  link,
  detalhe,
}: {
  icone: typeof Wallet
  rotulo: string
  valor: number
  link?: string
  detalhe?: string
}) {
  const conteudo = (
    <>
      <Icone className="mb-2 size-5 text-brand-700" aria-hidden />
      <p className="text-xs text-slate-500">{rotulo}</p>
      <p className="text-lg font-semibold tabular-nums text-slate-900">{formatarBRL(valor)}</p>
      {detalhe && <p className="text-xs text-slate-500">{detalhe}</p>}
    </>
  )
  return link ? (
    <Link to={link} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-200">
      {conteudo}
    </Link>
  ) : (
    <Card className="p-4">{conteudo}</Card>
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
