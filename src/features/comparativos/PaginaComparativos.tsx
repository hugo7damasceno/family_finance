import { lazy, Suspense, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { useAuth } from '@/auth/auth-context'
import { Cabecalho } from '@/components/layout/AuthLayout'
import { Aviso, Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { daFamilia, useMovimentos, type Movimento } from '@/features/dashboard/api'
import { useCategorias } from '@/features/lancamentos/api'
import { cn } from '@/lib/cn'
import { adicionarMeses, mesAtualISO, nomeDoMes } from '@/lib/datas'
import { formatarBRL } from '@/lib/money'
import {
  agruparDespesas,
  compararCategorias,
  mesesDoAno,
  somarMeses,
  totalDe,
  variacao,
  type DespesasPorMes,
  type LinhaComparativo,
} from './calculo'
import type { PontoComparativo } from './GraficoComparativo'

// Recharts só é baixado quando o gráfico aparece.
const GraficoComparativo = lazy(() => import('./GraficoComparativo'))

type Modo = 'mensal' | 'anual'
type Filtro = 'todos' | 'meus' | 'casal'

const mesCurto = (mes: string) => {
  const [a, m] = mes.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(a, m - 1, 1))
}

export function PaginaComparativos() {
  const { household } = useAuth()
  const hoje = mesAtualISO()
  const [modo, setModo] = useState<Modo>('mensal')
  const [mes, setMes] = useState(hoje)
  const [ano, setAno] = useState(() => Number(hoje.slice(0, 4)))
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [comContribuicoes, setComContribuicoes] = useState(false)

  // Mensal: 13 meses (12 do gráfico + o mesmo mês do ano anterior). Anual: dois anos inteiros.
  const [inicio, fim] = modo === 'mensal' ? [adicionarMeses(mes, -12), mes] : [`${ano - 1}-01`, `${ano}-12`]
  const movimentos = useMovimentos(inicio, fim)
  const { data: categorias = [] } = useCategorias()

  const nomes = useMemo(() => new Map(categorias.map((c) => [c.id, c.nome])), [categorias])
  const contribuicoes = useMemo(
    () => new Set(categorias.filter((c) => c.owner_id === null && ['Dízimo', 'Oferta'].includes(c.nome)).map((c) => c.id)),
    [categorias],
  )

  const filtrados = (movimentos.data ?? []).filter(
    (m: Movimento) =>
      daFamilia(m) &&
      (filtro === 'todos' || (filtro === 'meus' ? m.escopo === 'individual' : m.escopo === 'casal')) &&
      (comContribuicoes || !m.categoria_id || !contribuicoes.has(m.categoria_id)),
  )
  const porMes = agruparDespesas(filtrados, (id) => (id && nomes.get(id)) || 'Sem categoria')

  return (
    <>
      <Cabecalho titulo="Comparativos" descricao="Como suas despesas mudam de um mês e de um ano para o outro" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Abas
          rotulo="Período"
          valor={modo}
          opcoes={[
            ['mensal', 'Mensal'],
            ['anual', 'Anual'],
          ]}
          aoMudar={setModo}
        />
        {household && (
          <Abas
            rotulo="Filtro"
            valor={filtro}
            opcoes={[
              ['todos', 'Tudo'],
              ['meus', 'Meus'],
              ['casal', 'Da casa'],
            ]}
            aoMudar={setFiltro}
          />
        )}
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={comContribuicoes}
            onChange={(e) => setComContribuicoes(e.target.checked)}
            className="size-4 accent-brand-700"
          />
          Incluir dízimo e ofertas
        </label>
      </div>

      {modo === 'mensal' ? (
        <Navegador
          rotulo={nomeDoMes(mes)}
          anterior={() => setMes((m) => adicionarMeses(m, -1))}
          proximo={() => setMes((m) => adicionarMeses(m, 1))}
          atual={() => setMes(hoje)}
          nomeAnterior="Mês anterior"
          nomeProximo="Próximo mês"
        />
      ) : (
        <Navegador
          rotulo={String(ano)}
          anterior={() => setAno((a) => a - 1)}
          proximo={() => setAno((a) => a + 1)}
          atual={() => setAno(Number(hoje.slice(0, 4)))}
          nomeAnterior="Ano anterior"
          nomeProximo="Próximo ano"
        />
      )}

      {movimentos.error && <Aviso tipo="erro">Não foi possível carregar as despesas.</Aviso>}
      {movimentos.isPending ? (
        <Carregando />
      ) : modo === 'mensal' ? (
        <VisaoMensal porMes={porMes} mes={mes} />
      ) : (
        <VisaoAnual porMes={porMes} ano={ano} hoje={hoje} />
      )}

      <p className="mb-6 text-xs text-slate-500">
        Compras no cartão contam no mês da fatura. Transferências e compras de terceiros não entram.
        {household && ' Considera os lançamentos que você vê: os seus e os da casa.'}
      </p>
    </>
  )
}

function VisaoMensal({ porMes, mes }: { porMes: DespesasPorMes; mes: string }) {
  const anterior = adicionarMeses(mes, -1)
  const anoPassado = adicionarMeses(mes, -12)
  const total = totalDe(porMes.get(mes))
  const meses12 = Array.from({ length: 12 }, (_, i) => adicionarMeses(mes, i - 11))
  const comGasto = meses12.slice(0, 11).map((m) => totalDe(porMes.get(m))).filter((v) => v > 0)
  const media = comGasto.length > 0 ? comGasto.reduce((s, v) => s + v, 0) / comGasto.length : 0

  const dados: PontoComparativo[] = meses12.map((m) => ({ eixo: mesCurto(m), rotulo: nomeDoMes(m), atual: totalDe(porMes.get(m)) }))
  const linhas = compararCategorias(porMes.get(mes) ?? new Map(), porMes.get(anterior) ?? new Map())

  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Resumo titulo={`Despesas de ${nomeDoMes(mes).toLowerCase()}`} valor={total} />
        <Resumo
          titulo={`vs. ${nomeDoMes(anterior).toLowerCase()}`}
          valor={totalDe(porMes.get(anterior))}
          atual={total}
        />
        <Resumo
          titulo={`vs. ${nomeDoMes(anoPassado).toLowerCase()}`}
          valor={totalDe(porMes.get(anoPassado))}
          atual={total}
        />
      </div>

      <Card className="mb-4">
        <h2 className="font-semibold text-slate-900">Últimos 12 meses</h2>
        <p className="mb-3 text-xs text-slate-500">
          {media > 0
            ? `Média dos 11 meses anteriores: ${formatarBRL(Math.round(media))}`
            : 'Ainda não há meses anteriores com despesas para comparar.'}
          {media > 0 && total > 0 && <> · este mês está <VariacaoTexto v={variacao(total, media)} /> da média</>}
        </p>
        <Suspense fallback={<Carregando />}>
          <GraficoComparativo
            dados={dados}
            nomeAtual="Despesas"
            destaque={11}
            descricao={`Despesas dos últimos 12 meses até ${nomeDoMes(mes)}`}
          />
        </Suspense>
      </Card>

      <TabelaCategorias
        titulo="Por categoria"
        linhas={linhas}
        rotuloAtual={mesCurto(mes)}
        rotuloAnterior={mesCurto(anterior)}
        vazio="Nenhuma despesa neste mês nem no anterior."
      />
    </>
  )
}

function VisaoAnual({ porMes, ano, hoje }: { porMes: DespesasPorMes; ano: number; hoje: string }) {
  const anoAtual = Number(hoje.slice(0, 4))
  // Ano em andamento: compara só até o mês atual (jan–nov x jan–nov), senão o ano anterior sempre "ganha".
  const ate = ano === anoAtual ? Number(hoje.slice(5, 7)) : 12
  const parcial = ate < 12
  const mesesAtual = mesesDoAno(ano, ate)
  const mesesAnterior = mesesDoAno(ano - 1, ate)
  const catAtual = somarMeses(porMes, mesesAtual)
  const catAnterior = somarMeses(porMes, mesesAnterior)
  const total = totalDe(catAtual)
  const totalAnterior = totalDe(catAnterior)
  const mesesComGasto = mesesAtual.filter((m) => totalDe(porMes.get(m)) > 0).length
  const periodo = parcial ? `jan. a ${mesCurto(`${ano}-${String(ate).padStart(2, '0')}`)}` : 'ano inteiro'

  const dados: PontoComparativo[] = mesesDoAno(ano).map((m, i) => ({
    eixo: mesCurto(m),
    rotulo: nomeDoMes(m).replace(/ de \d+$/, ''),
    atual: totalDe(porMes.get(m)),
    anterior: totalDe(porMes.get(mesesDoAno(ano - 1)[i])),
  }))
  const linhas = compararCategorias(catAtual, catAnterior)

  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Resumo titulo={`Despesas de ${ano} (${periodo})`} valor={total} />
        <Resumo titulo={`vs. ${ano - 1} (mesmo período)`} valor={totalAnterior} atual={total} />
        <Resumo titulo="Média mensal" valor={mesesComGasto > 0 ? Math.round(total / mesesComGasto) : 0} />
      </div>

      <Card className="mb-4">
        <h2 className="font-semibold text-slate-900">
          {ano} x {ano - 1}, mês a mês
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          {parcial && `${ano} ainda está em andamento: os totais comparam ${periodo} dos dois anos.`}
        </p>
        <Suspense fallback={<Carregando />}>
          <GraficoComparativo
            dados={dados}
            nomeAtual={String(ano)}
            nomeAnterior={String(ano - 1)}
            descricao={`Despesas mensais de ${ano} comparadas com ${ano - 1}`}
          />
        </Suspense>
      </Card>

      <TabelaCategorias
        titulo={`Por categoria (${periodo})`}
        linhas={linhas}
        rotuloAtual={String(ano)}
        rotuloAnterior={String(ano - 1)}
        vazio="Nenhuma despesa nesses dois anos."
      />
    </>
  )
}

/** Card de total; com `atual`, mostra a variação do total atual em relação a `valor`. */
function Resumo({ titulo, valor, atual }: { titulo: string; valor: number; atual?: number }) {
  const v = atual === undefined ? undefined : variacao(atual, valor)
  return (
    <Card className="p-4">
      <p className="text-xs text-slate-500">{titulo}</p>
      {atual === undefined ? (
        <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{formatarBRL(valor)}</p>
      ) : (
        <>
          <p className="mt-1 text-xl font-bold text-slate-900">
            <Variacao v={v ?? null} semBase={valor === 0} grande />
          </p>
          <p className="text-xs tabular-nums text-slate-500">
            {valor > 0 ? `era ${formatarBRL(valor)} (${atual >= valor ? '+' : '−'}${formatarBRL(Math.abs(atual - valor))})` : 'sem despesas no período'}
          </p>
        </>
      )}
    </Card>
  )
}

// Em despesas, subir é ruim: vermelho + seta para cima; cair é bom. Sempre com ícone e texto.
const COR_PIOROU = '#d03b3b'
const COR_MELHOROU = '#0ca30c'

const pctTexto = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`

function Variacao({ v, semBase, grande }: { v: number | null; semBase?: boolean; grande?: boolean }) {
  const icone = cn('shrink-0', grande ? 'size-5' : 'size-3.5')
  if (v === null) {
    return <span className="text-slate-400">{semBase ? 'novo' : '—'}</span>
  }
  if (Math.round(v * 100) === 0) {
    return (
      <span className="inline-flex items-center gap-1 tabular-nums text-slate-600">
        <Minus className={icone} aria-hidden /> estável
      </span>
    )
  }
  const subiu = v > 0
  const Icone = subiu ? TrendingUp : TrendingDown
  return (
    <span className="inline-flex items-center gap-1 tabular-nums text-slate-900">
      <Icone className={icone} style={{ color: subiu ? COR_PIOROU : COR_MELHOROU }} aria-hidden />
      <span className="sr-only">{subiu ? 'aumento de' : 'redução de'}</span>
      {pctTexto(v)}
    </span>
  )
}

function VariacaoTexto({ v }: { v: number | null }) {
  if (v === null || Math.round(v * 100) === 0) return <>na</>
  return (
    <strong className="font-semibold text-slate-700">
      {Math.abs(Math.round(v * 100))}% {v > 0 ? 'acima' : 'abaixo'}
    </strong>
  )
}

function TabelaCategorias({
  titulo,
  linhas,
  rotuloAtual,
  rotuloAnterior,
  vazio,
}: {
  titulo: string
  linhas: LinhaComparativo[]
  rotuloAtual: string
  rotuloAnterior: string
  vazio: string
}) {
  const [todas, setTodas] = useState(false)
  const MAX = 10
  const visiveis = todas ? linhas : linhas.slice(0, MAX)
  // Maiores altas em valor absoluto: o que mais explica a diferença.
  const destaques = linhas.filter((l) => l.diferenca > 0).sort((a, b) => b.diferenca - a.diferenca).slice(0, 3)

  return (
    <Card className="mb-4">
      <h2 className="mb-1 font-semibold text-slate-900">{titulo}</h2>
      {destaques.length > 0 && (
        <p className="mb-3 text-xs text-slate-500">
          Maiores aumentos:{' '}
          {destaques.map((d, i) => (
            <span key={d.nome}>
              {i > 0 && ', '}
              <strong className="font-medium text-slate-700">{d.nome}</strong> (+{formatarBRL(d.diferenca)})
            </span>
          ))}
        </p>
      )}
      {linhas.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">{vazio}</p>
      ) : (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[22rem] text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="px-1 py-1.5 font-medium">Categoria</th>
                <th className="px-1 py-1.5 text-right font-medium">{rotuloAtual}</th>
                <th className="px-1 py-1.5 text-right font-medium">{rotuloAnterior}</th>
                <th className="px-1 py-1.5 text-right font-medium">Variação</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {visiveis.map((l) => (
                <tr key={l.nome} className="border-t border-slate-100">
                  <td className="max-w-[10rem] truncate px-1 py-2 text-slate-700">{l.nome}</td>
                  <td className="px-1 py-2 text-right font-medium text-slate-900">{formatarBRL(l.atual)}</td>
                  <td className="px-1 py-2 text-right text-slate-500">{formatarBRL(l.anterior)}</td>
                  <td className="px-1 py-2 text-right text-xs">
                    <Variacao v={l.variacao} semBase={l.anterior === 0 && l.atual > 0} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {linhas.length > MAX && (
        <button onClick={() => setTodas((v) => !v)} className="mt-2 text-sm font-medium text-brand-700 hover:underline">
          {todas ? 'Mostrar menos' : `Ver todas as ${linhas.length} categorias`}
        </button>
      )}
    </Card>
  )
}

function Navegador(p: {
  rotulo: string
  anterior: () => void
  proximo: () => void
  atual: () => void
  nomeAnterior: string
  nomeProximo: string
}) {
  return (
    <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-1.5">
      <button onClick={p.anterior} className="rounded-xl p-2 text-slate-600 hover:bg-slate-100" aria-label={p.nomeAnterior}>
        <ChevronLeft className="size-5" />
      </button>
      <button onClick={p.atual} className="text-sm font-semibold text-slate-900" title="Voltar para o período atual">
        {p.rotulo}
      </button>
      <button onClick={p.proximo} className="rounded-xl p-2 text-slate-600 hover:bg-slate-100" aria-label={p.nomeProximo}>
        <ChevronRight className="size-5" />
      </button>
    </div>
  )
}

function Abas<T extends string>({
  rotulo,
  valor,
  opcoes,
  aoMudar,
}: {
  rotulo: string
  valor: T
  opcoes: (readonly [T, string])[]
  aoMudar: (v: T) => void
}) {
  return (
    <div className="flex gap-1 rounded-full border border-slate-200 bg-white p-1" role="tablist" aria-label={rotulo}>
      {opcoes.map(([v, texto]) => (
        <button
          key={v}
          role="tab"
          aria-selected={valor === v}
          onClick={() => aoMudar(v)}
          className={cn(
            'rounded-full px-3.5 py-1 text-sm font-medium transition-colors',
            valor === v ? 'bg-brand-700 text-white' : 'text-slate-700 hover:bg-slate-100',
          )}
        >
          {texto}
        </button>
      ))}
    </div>
  )
}
