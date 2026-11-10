import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Home,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  Undo2,
  UserPlus,
} from 'lucide-react'
import { useAuth } from '@/auth/auth-context'
import { Cabecalho } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Aviso, Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { Escolha } from '@/components/ui/Escolha'
import { Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useCartoes } from '@/features/cartoes/api'
import { useContasAtivas } from '@/features/contas/api'
import { useExcluirLancamento } from '@/features/lancamentos/api'
import { cn } from '@/lib/cn'
import { hojeISO, rotuloDoDia } from '@/lib/datas'
import { formatarBRL } from '@/lib/money'
import { mensagemDeErro } from '@/lib/queries'
import { traduzirErro } from '@/lib/supabase'
import type { Escopo, Terceiro } from '@/types/database'
import {
  useExcluirTerceiro,
  useMovimentosTerceiros,
  useRegistrarReembolso,
  useSalvarTerceiro,
  useTerceiros,
  type DadosTerceiro,
} from './api'
import { linkWhatsApp, mensagemCobranca, situacaoPorTerceiro, type SituacaoTerceiro } from './calculo'

// Paleta de status (skill dataviz): sempre com ícone + texto.
const COR_CRITICO = '#d03b3b'
const COR_BOM = '#0ca30c'

type EstadoModal = { tipo: 'pessoa'; terceiro?: Terceiro } | { tipo: 'reembolso'; terceiro: Terceiro } | null

const VAZIO: SituacaoTerceiro = { pendentes: [], devendo: 0, vencido: 0, proximos30: 0, reembolsos: [], recebido: 0 }

export function PaginaTerceiros() {
  const terceiros = useTerceiros()
  const movimentos = useMovimentosTerceiros()
  const { data: cartoes = [] } = useCartoes()
  const [modal, setModal] = useState<EstadoModal>(null)
  const [verArquivados, setVerArquivados] = useState(false)
  const hoje = hojeISO()

  const situacoes = useMemo(
    () => situacaoPorTerceiro(movimentos.data ?? [], new Map(cartoes.map((c) => [c.id, c])), hoje),
    [movimentos.data, cartoes, hoje],
  )

  const lista = (terceiros.data ?? [])
    .filter((t) => !t.arquivado)
    // Quem tem valor vencido primeiro; depois quem deve mais.
    .sort((a, b) => {
      const sa = situacoes.get(a.id) ?? VAZIO
      const sb = situacoes.get(b.id) ?? VAZIO
      return sb.vencido - sa.vencido || sb.devendo - sa.devendo || a.nome.localeCompare(b.nome)
    })
  const arquivados = (terceiros.data ?? []).filter((t) => t.arquivado)
  const totalDevendo = lista.reduce((s, t) => s + (situacoes.get(t.id)?.devendo ?? 0), 0)
  const totalVencido = lista.reduce((s, t) => s + (situacoes.get(t.id)?.vencido ?? 0), 0)

  return (
    <>
      <Cabecalho
        titulo="Terceiros"
        descricao="Quem comprou no seu cartão e quanto falta receber"
        acoes={
          <Button onClick={() => setModal({ tipo: 'pessoa' })}>
            <UserPlus className="size-4" aria-hidden /> <span className="hidden sm:inline">Nova pessoa</span>
          </Button>
        }
      />

      {(terceiros.error || movimentos.error) && <Aviso tipo="erro">Não foi possível carregar os terceiros.</Aviso>}

      {terceiros.isPending || movimentos.isPending ? (
        <Carregando />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <Card className="p-4">
              <p className="text-xs text-slate-500">A receber</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{formatarBRL(totalDevendo)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-slate-500">Já vencido</p>
              <p className="mt-1 flex items-center gap-1.5 text-xl font-bold tabular-nums text-slate-900">
                {totalVencido > 0 && <AlertTriangle className="size-5" style={{ color: COR_CRITICO }} aria-label="Vencido" />}
                {formatarBRL(totalVencido)}
              </p>
            </Card>
          </div>

          <Aviso tipo="info" className="mb-4">
            Para registrar uma compra, lance uma despesa no cartão e escolha a pessoa em “Compra de terceiro”. Ela entra
            na fatura, mas não conta como gasto de vocês.{' '}
            <Link to="/lancamentos" state={{ novo: { tipo: 'despesa' } }} className="font-semibold underline">
              Lançar compra
            </Link>
          </Aviso>

          {lista.length === 0 ? (
            <Card className="py-10 text-center">
              <p className="font-medium text-slate-900">Nenhuma pessoa cadastrada</p>
              <p className="mt-1 text-sm text-slate-600">
                Cadastre quem costuma usar seu cartão para acompanhar o que cada um deve.
              </p>
              <Button className="mt-4" onClick={() => setModal({ tipo: 'pessoa' })}>
                <Plus className="size-4" aria-hidden /> Cadastrar pessoa
              </Button>
            </Card>
          ) : (
            <div className="mb-4 flex flex-col gap-3">
              {lista.map((t) => (
                <CartaoTerceiro
                  key={t.id}
                  terceiro={t}
                  situacao={situacoes.get(t.id) ?? VAZIO}
                  hoje={hoje}
                  onEditar={() => setModal({ tipo: 'pessoa', terceiro: t })}
                  onReembolso={() => setModal({ tipo: 'reembolso', terceiro: t })}
                />
              ))}
            </div>
          )}

          {arquivados.length > 0 && (
            <div className="mb-6">
              <button
                onClick={() => setVerArquivados((v) => !v)}
                className="text-sm font-medium text-slate-600 hover:underline"
                aria-expanded={verArquivados}
              >
                {verArquivados ? 'Ocultar arquivados' : `Ver arquivados (${arquivados.length})`}
              </button>
              {verArquivados && (
                <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                  {arquivados.map((t) => (
                    <li key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <span className="text-slate-700">{t.nome}</span>
                      <button
                        onClick={() => setModal({ tipo: 'pessoa', terceiro: t })}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        Editar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      <Modal
        aberto={modal !== null}
        onFechar={() => setModal(null)}
        titulo={
          modal?.tipo === 'reembolso'
            ? `Pagamento de ${modal.terceiro.nome.split(' ')[0]}`
            : modal?.terceiro
              ? 'Editar pessoa'
              : 'Nova pessoa'
        }
      >
        {modal?.tipo === 'pessoa' && <FormTerceiro terceiro={modal.terceiro} onConcluir={() => setModal(null)} />}
        {modal?.tipo === 'reembolso' && (
          <FormReembolso
            terceiro={modal.terceiro}
            situacao={situacoes.get(modal.terceiro.id) ?? VAZIO}
            onConcluir={() => setModal(null)}
          />
        )}
      </Modal>
    </>
  )
}

function CartaoTerceiro({
  terceiro: t,
  situacao: s,
  hoje,
  onEditar,
  onReembolso,
}: {
  terceiro: Terceiro
  situacao: SituacaoTerceiro
  hoje: string
  onEditar: () => void
  onReembolso: () => void
}) {
  const { household } = useAuth()
  const [aberto, setAberto] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const excluir = useExcluirLancamento()
  const mensagem = s.pendentes.length > 0 ? mensagemCobranca(t.nome, s.pendentes, hoje) : ''

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensagem)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sem permissão de área de transferência: o WhatsApp continua disponível.
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 font-semibold text-brand-800"
          aria-hidden
        >
          {t.nome.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-semibold text-slate-900">
            <span className="truncate">{t.nome}</span>
            {household && t.escopo === 'casal' && <Home className="size-3.5 shrink-0 text-slate-400" aria-label="Do casal" />}
            <button onClick={onEditar} className="rounded p-1 text-slate-400 hover:text-slate-700" aria-label={`Editar ${t.nome}`}>
              <Pencil className="size-3.5" />
            </button>
          </p>
          {s.devendo === 0 ? (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-600">
              <CheckCircle2 className="size-4" style={{ color: COR_BOM }} aria-hidden /> Nada pendente
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-slate-600">
              Deve <strong className="tabular-nums text-slate-900">{formatarBRL(s.devendo)}</strong>
              {s.pendentes.length > 1 && ` em ${s.pendentes.length} parcelas`}
            </p>
          )}
          {s.vencido > 0 && (
            <p className="mt-0.5 flex items-center gap-1 text-sm font-medium text-slate-800">
              <AlertTriangle className="size-4" style={{ color: COR_CRITICO }} aria-hidden />
              Vencido: <span className="tabular-nums">{formatarBRL(s.vencido)}</span>
            </p>
          )}
          {s.proximos30 > 0 && (
            <p className="text-xs text-slate-500">
              Vence nos próximos 30 dias: <span className="tabular-nums">{formatarBRL(s.proximos30)}</span>
            </p>
          )}
        </div>
      </div>

      {s.pendentes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button className="h-9" onClick={onReembolso}>
            <Check className="size-4" aria-hidden /> Recebi
          </Button>
          <a
            href={linkWhatsApp(t.telefone, mensagem)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            <MessageCircle className="size-4" aria-hidden /> Cobrar no WhatsApp
          </a>
          <Button variante="fantasma" className="h-9" onClick={copiar}>
            <Copy className="size-4" aria-hidden /> {copiado ? 'Copiado!' : 'Copiar mensagem'}
          </Button>
        </div>
      )}

      {(s.pendentes.length > 0 || s.reembolsos.length > 0) && (
        <button
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="mt-3 flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
        >
          {aberto ? 'Ocultar detalhes' : 'Ver compras e pagamentos'}
          <ChevronDown className={cn('size-4 transition-transform', aberto && 'rotate-180')} aria-hidden />
        </button>
      )}

      {aberto && (
        <div className="mt-2 flex flex-col gap-3 text-sm">
          {s.pendentes.length > 0 && (
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Pendentes</h3>
              <ul className="divide-y divide-slate-100">
                {s.pendentes.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 py-1.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-slate-800">{p.descricao}</span>
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        {p.vencida && <AlertTriangle className="size-3" style={{ color: COR_CRITICO }} aria-hidden />}
                        {p.vencida ? 'venceu' : 'vence'} {rotuloDoDia(p.vencimento)}
                      </span>
                    </span>
                    <span className="tabular-nums text-slate-900">{formatarBRL(p.valor_cents)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {s.reembolsos.length > 0 && (
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Pagamentos recebidos ({formatarBRL(s.recebido)})
              </h3>
              <ul className="divide-y divide-slate-100">
                {s.reembolsos.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 py-1.5">
                    <span className="flex-1 text-slate-700">{rotuloDoDia(r.data)}</span>
                    <span className="tabular-nums text-slate-900">{formatarBRL(r.valor_cents)}</span>
                    <button
                      onClick={() => {
                        if (confirm('Desfazer este pagamento? As compras quitadas por ele voltam a ficar pendentes.')) {
                          excluir.mutate(r.id)
                        }
                      }}
                      className="rounded p-1 text-slate-400 hover:text-red-600"
                      aria-label="Desfazer pagamento"
                      title="Desfazer pagamento"
                    >
                      <Undo2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Card>
  )
}

function FormTerceiro({ terceiro, onConcluir }: { terceiro?: Terceiro; onConcluir: () => void }) {
  const { household } = useAuth()
  const salvar = useSalvarTerceiro()
  const excluir = useExcluirTerceiro()
  const [erro, setErro] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const [d, setD] = useState<DadosTerceiro>({
    nome: terceiro?.nome ?? '',
    telefone: terceiro?.telefone ?? null,
    observacao: terceiro?.observacao ?? null,
    escopo: terceiro?.escopo ?? (household ? 'casal' : 'individual'),
    arquivado: terceiro?.arquivado ?? false,
  })

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!d.nome.trim()) return setErro('Informe o nome.')
    try {
      await salvar.mutateAsync({
        id: terceiro?.id,
        dados: {
          ...d,
          nome: d.nome.trim(),
          telefone: d.telefone?.trim() || null,
          observacao: d.observacao?.trim() || null,
          escopo: household ? d.escopo : 'individual',
        },
      })
      onConcluir()
    } catch (err) {
      setErro(traduzirErro(mensagemDeErro(err)))
    }
  }

  async function onExcluir() {
    if (!terceiro) return
    try {
      await excluir.mutateAsync(terceiro.id)
      onConcluir()
    } catch (err) {
      setErro(traduzirErro(mensagemDeErro(err)))
      setConfirmar(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Input label="Nome" value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} placeholder="Ex.: Maria (irmã)" />
      <Input
        label="WhatsApp (opcional)"
        type="tel"
        inputMode="tel"
        value={d.telefone ?? ''}
        onChange={(e) => setD({ ...d, telefone: e.target.value })}
        placeholder="(11) 91234-5678"
        ajuda="Usado para abrir a conversa com a mensagem de cobrança pronta."
      />
      <Input
        label="Observação (opcional)"
        value={d.observacao ?? ''}
        onChange={(e) => setD({ ...d, observacao: e.target.value })}
      />
      {household && (
        <Escolha<Escopo>
          legenda="Quem acompanha?"
          valor={d.escopo}
          onChange={(v) => setD({ ...d, escopo: v })}
          opcoes={[
            { valor: 'casal', titulo: 'O casal', descricao: 'Os dois veem o que a pessoa deve.' },
            { valor: 'individual', titulo: 'Só eu', descricao: 'Só você vê.' },
          ]}
        />
      )}
      {terceiro && (
        <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            className="size-5 accent-brand-700"
            checked={d.arquivado}
            onChange={(e) => setD({ ...d, arquivado: e.target.checked })}
          />
          Arquivar (some da lista e da escolha nas compras)
        </label>
      )}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div className="flex gap-3 pt-1">
        {terceiro && (
          <Button
            type="button"
            variante={confirmar ? 'perigo' : 'secundario'}
            carregando={excluir.isPending}
            onClick={() => (confirmar ? onExcluir() : setConfirmar(true))}
            aria-label="Excluir pessoa"
          >
            <Trash2 className="size-4" aria-hidden />
            {confirmar && 'Confirmar'}
          </Button>
        )}
        <Button type="submit" className="flex-1" carregando={salvar.isPending}>
          Salvar
        </Button>
      </div>
    </form>
  )
}

function FormReembolso({
  terceiro,
  situacao,
  onConcluir,
}: {
  terceiro: Terceiro
  situacao: SituacaoTerceiro
  onConcluir: () => void
}) {
  const { data: contas = [] } = useContasAtivas()
  const registrar = useRegistrarReembolso()
  // Sugere quitar o que já venceu; se nada venceu, a próxima parcela.
  const [selecionados, setSelecionados] = useState<Set<string>>(() => {
    const vencidas = situacao.pendentes.filter((p) => p.vencida).map((p) => p.id)
    return new Set(vencidas.length > 0 ? vencidas : situacao.pendentes.slice(0, 1).map((p) => p.id))
  })
  const [data, setData] = useState(hojeISO)
  const [contaId, setContaId] = useState(contas[0]?.id ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const total = situacao.pendentes.filter((p) => selecionados.has(p.id)).reduce((s, p) => s + p.valor_cents, 0)
  const todos = selecionados.size === situacao.pendentes.length

  function alternar(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (selecionados.size === 0) return setErro('Marque o que foi pago.')
    try {
      await registrar.mutateAsync({ ids: [...selecionados], data, conta_id: contaId || null })
      onConcluir()
    } catch (err) {
      setErro(traduzirErro(mensagemDeErro(err)))
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <fieldset>
        <div className="mb-1 flex items-center justify-between">
          <legend className="text-sm font-medium text-slate-700">O que {terceiro.nome.split(' ')[0]} pagou?</legend>
          <button
            type="button"
            className="text-xs font-semibold text-brand-700 hover:underline"
            onClick={() => setSelecionados(new Set(todos ? [] : situacao.pendentes.map((p) => p.id)))}
          >
            {todos ? 'Desmarcar todas' : 'Marcar todas'}
          </button>
        </div>
        <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
          {situacao.pendentes.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  className="size-5 shrink-0 accent-brand-700"
                  checked={selecionados.has(p.id)}
                  onChange={() => alternar(p.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-slate-800">{p.descricao}</span>
                  <span className="text-xs text-slate-500">
                    {p.vencida ? 'venceu' : 'vence'} {rotuloDoDia(p.vencimento)}
                  </span>
                </span>
                <span className="tabular-nums text-slate-900">{formatarBRL(p.valor_cents)}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <p className="text-sm text-slate-600">
        Total recebido: <strong className="tabular-nums text-slate-900">{formatarBRL(total)}</strong>
      </p>
      <Input label="Data do pagamento" type="date" value={data} onChange={(e) => setData(e.target.value)} />
      <Select
        label="Recebido em"
        value={contaId}
        onChange={(e) => setContaId(e.target.value)}
        ajuda="O valor entra no saldo da conta, mas não conta como renda."
      >
        <option value="">Não informar</option>
        {contas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </Select>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <Button type="submit" carregando={registrar.isPending}>
        Registrar pagamento
      </Button>
    </form>
  )
}
