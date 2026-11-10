import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CreditCard, Home, Repeat, Landmark, Plus, Sparkles, User, Users } from 'lucide-react'
import { useAuth } from '@/auth/auth-context'
import { Cabecalho } from '@/components/layout/AuthLayout'
import { BotaoEmDesenvolvimento } from '@/components/EmDesenvolvimento'
import { Button } from '@/components/ui/Button'
import { Aviso, Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import { mensagemDeErro } from '@/lib/queries'
import { adicionarMeses, mesAtualISO, nomeDoMes, rotuloDoDia } from '@/lib/datas'
import { formatarBRL } from '@/lib/money'
import type { Lancamento } from '@/types/database'
import { useAlternarPago, useCategorias, useLancamentosDoMes, type DadosLancamento } from './api'
import { FormLancamento } from './FormLancamento'
import { PainelRecorrencias } from '@/features/recorrencias/PainelRecorrencias'
import { useTerceiros } from '@/features/terceiros/api'

type Filtro = 'todos' | 'meus' | 'casal'
type EstadoModal = { lancamento?: Lancamento; inicial?: Partial<DadosLancamento> } | null

export function PaginaLancamentos() {
  const { user, household, membros } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mes, setMes] = useState(mesAtualISO)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  // Atalhos da tela inicial chegam com valores iniciais via state da rota.
  const [modal, setModal] = useState<EstadoModal>(() => {
    const inicial = (location.state as { novo?: Partial<DadosLancamento> } | null)?.novo
    return inicial ? { inicial } : null
  })
  const [recorrentesAberto, setRecorrentesAberto] = useState(false)
  const { data: lancamentos, isPending, error } = useLancamentosDoMes(mes)
  const { data: categorias = [] } = useCategorias()
  const alternarPago = useAlternarPago()
  const { data: terceiros = [] } = useTerceiros()

  const nomeCategoria = useMemo(() => new Map(categorias.map((c) => [c.id, c.nome])), [categorias])
  const nomeTerceiro = useMemo(() => new Map(terceiros.map((t) => [t.id, t.nome.split(' ')[0]])), [terceiros])
  const nomeMembro = useMemo(() => new Map(membros.map((m) => [m.id, m.nome.split(' ')[0]])), [membros])

  const visiveis = (lancamentos ?? []).filter((l) =>
    filtro === 'meus' ? l.escopo === 'individual' : filtro === 'casal' ? l.escopo === 'casal' : true,
  )
  const totais = visiveis.reduce(
    (t, l) => {
      // Compras de terceiros e reembolsos não são renda nem gasto da família.
      if (l.terceiro_id) {
        if (l.tipo === 'despesa') t.terceiros += l.valor_cents
        if (l.tipo === 'despesa' && !l.pago) t.aPagar += l.valor_cents
        return t
      }
      if (l.tipo === 'receita') t.receitas += l.valor_cents
      if (l.tipo === 'despesa') {
        // Transferências entre contas não são receita nem despesa.
        t.despesas += l.valor_cents
        if (!l.pago) t.aPagar += l.valor_cents
      }
      return t
    },
    { receitas: 0, despesas: 0, aPagar: 0, terceiros: 0 },
  )
  const grupos = new Map<string, Lancamento[]>()
  for (const l of visiveis) grupos.set(l.data, [...(grupos.get(l.data) ?? []), l])
  const porDia = [...grupos.entries()]

  function fecharModal() {
    setModal(null)
    if (location.state) navigate(location.pathname, { replace: true, state: null })
  }

  return (
    <>
      <Cabecalho
        titulo="Lançamentos"
        acoes={
          <div className="flex gap-2">
            <Button variante="secundario" onClick={() => setRecorrentesAberto(true)}>
              <Repeat className="size-4" aria-hidden /> Recorrentes
            </Button>
            <Button onClick={() => setModal({})} className="hidden sm:inline-flex">
              <Plus className="size-4" aria-hidden /> Novo lançamento
            </Button>
          </div>
        }
      />

      {/* Navegação de mês */}
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-1.5">
        <button
          onClick={() => setMes((m) => adicionarMeses(m, -1))}
          className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          onClick={() => setMes(mesAtualISO())}
          className="text-sm font-semibold text-slate-900"
          title="Voltar para o mês atual"
        >
          {nomeDoMes(mes)}
        </button>
        <button
          onClick={() => setMes((m) => adicionarMeses(m, 1))}
          className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"
          aria-label="Próximo mês"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {/* Totais */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Total rotulo="Receitas" valor={totais.receitas} cor="text-emerald-700" />
        <Total rotulo="Despesas" valor={totais.despesas} cor="text-red-600" />
        <Total
          rotulo="Saldo"
          valor={totais.receitas - totais.despesas}
          cor={totais.receitas - totais.despesas < 0 ? 'text-red-600' : 'text-slate-900'}
        />
      </div>
      {totais.aPagar > 0 && (
        <p className="mb-4 text-sm text-slate-600">
          Ainda a pagar este mês: <strong className="text-slate-900">{formatarBRL(totais.aPagar)}</strong>
        </p>
      )}
      {totais.terceiros > 0 && (
        <p className="-mt-2 mb-4 text-sm text-slate-600">
          Compras de terceiros (fora das despesas):{' '}
          <strong className="text-slate-900">{formatarBRL(totais.terceiros)}</strong>
        </p>
      )}

      {household && (
        <div className="mb-4 flex gap-2" role="tablist" aria-label="Filtro">
          {(
            [
              ['todos', 'Tudo'],
              ['meus', 'Meus'],
              ['casal', 'Da casa'],
            ] as const
          ).map(([v, rotulo]) => (
            <button
              key={v}
              role="tab"
              aria-selected={filtro === v}
              onClick={() => setFiltro(v)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                filtro === v ? 'bg-brand-700 text-white' : 'border border-slate-200 bg-white text-slate-700',
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>
      )}

      {error && <Aviso tipo="erro">Não foi possível carregar os lançamentos.</Aviso>}
      {alternarPago.error && (
        <Aviso tipo="erro" className="mb-4">
          Não foi possível marcar como pago: {mensagemDeErro(alternarPago.error)}
        </Aviso>
      )}
      {isPending ? (
        <Carregando />
      ) : porDia.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="font-medium text-slate-900">Nenhum lançamento em {nomeDoMes(mes).toLowerCase()}</p>
          <p className="mt-1 text-sm text-slate-600">Toque em “+” para registrar uma receita ou despesa.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {porDia.map(([dia, itens]) => (
            <section key={dia}>
              <h2 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {rotuloDoDia(dia)}
              </h2>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {itens.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      className="size-5 shrink-0 accent-brand-700"
                      checked={l.pago}
                      disabled={Boolean(l.cartao_id)}
                      title={l.cartao_id ? 'Pago junto com a fatura do cartão' : undefined}
                      onChange={(e) => alternarPago.mutate({ id: l.id, pago: e.target.checked })}
                      aria-label={l.tipo === 'receita' ? 'Recebido' : 'Pago'}
                    />
                    <button
                      onClick={() => setModal({ lancamento: l })}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate text-sm font-medium', l.pago ? 'text-slate-900' : 'text-slate-500')}>
                          {l.descricao}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-slate-500">
                          {l.escopo === 'casal' ? (
                            <Home className="size-3" aria-label="Da casa" />
                          ) : (
                            household && <User className="size-3" aria-label="Individual" />
                          )}
                          {l.cartao_id && <CreditCard className="size-3" aria-label="Cartão de crédito" />}
                          {l.categoria_id && nomeCategoria.get(l.categoria_id)}
                          {l.terceiro_id && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 text-slate-600">
                              <Users className="size-3" aria-hidden />
                              {l.tipo === 'receita' ? 'reembolso de ' : ''}
                              {nomeTerceiro.get(l.terceiro_id) ?? 'terceiro'}
                            </span>
                          )}
                          {l.gerado_de_id && <Sparkles className="size-3 text-brand-600" aria-label="Automático" />}
                          {l.recorrencia_id && <Repeat className="size-3" aria-label="Recorrente" />}
                          {l.owner_id !== user?.id && <> · por {nomeMembro.get(l.owner_id) ?? 'cônjuge'}</>}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'shrink-0 text-sm font-semibold tabular-nums',
                          l.tipo === 'receita' ? 'text-emerald-700' : 'text-slate-900',
                        )}
                      >
                        {l.tipo === 'receita' ? '+ ' : l.tipo === 'despesa' ? '− ' : '⇄ '}
                        {formatarBRL(l.valor_cents)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="mt-6">
        <BotaoEmDesenvolvimento icone={Landmark} rotulo="Importar do banco (Open Finance)" />
      </div>

      {/* Botão flutuante (celular) */}
      <button
        onClick={() => setModal({})}
        className="fixed right-4 bottom-24 z-10 flex size-14 items-center justify-center rounded-full bg-brand-700 text-white shadow-lg sm:hidden"
        aria-label="Novo lançamento"
      >
        <Plus className="size-7" />
      </button>

      <Modal
        aberto={modal !== null}
        onFechar={fecharModal}
        titulo={modal?.lancamento ? 'Editar lançamento' : 'Novo lançamento'}
      >
        {modal && (
          <FormLancamento
            key={modal.lancamento?.id ?? 'novo'}
            lancamento={modal.lancamento}
            inicial={modal.inicial}
            onConcluir={fecharModal}
          />
        )}
      </Modal>

      <Modal aberto={recorrentesAberto} onFechar={() => setRecorrentesAberto(false)} titulo="Lançamentos recorrentes">
        {recorrentesAberto && <PainelRecorrencias />}
      </Modal>
    </>
  )
}

function Total({ rotulo, valor, cor }: { rotulo: string; valor: number; cor: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-slate-500">{rotulo}</p>
      <p className={cn('truncate text-sm font-bold tabular-nums sm:text-base', cor)}>{formatarBRL(valor)}</p>
    </Card>
  )
}
