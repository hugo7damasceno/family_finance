import { useState } from 'react'
import { CreditCard, Home, Layers, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/auth/auth-context'
import { Cabecalho } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Aviso, Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { Escolha } from '@/components/ui/Escolha'
import { Input, MoneyInput, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useCartoes } from '@/features/cartoes/api'
import { useContasAtivas } from '@/features/contas/api'
import { useCategorias } from '@/features/lancamentos/api'
import { cn } from '@/lib/cn'
import { hojeISO, mesAtualISO, rotuloDoDia } from '@/lib/datas'
import { formatarBRL } from '@/lib/money'
import { mensagemDeErro } from '@/lib/queries'
import { traduzirErro } from '@/lib/supabase'
import type { Escopo } from '@/types/database'
import {
  useCriarParcelamento,
  useExcluirParcelamento,
  useParcelamentos,
  type DadosParcelamento,
  type ParcelamentoComParcelas,
} from './api'

/** Mês em que a parcela pesa no orçamento: o da fatura (cartão) ou o da data. */
const mesDaParcela = (p: ParcelamentoComParcelas['parcelas'][number]) => (p.fatura_mes ?? p.data).slice(0, 7)

export function PaginaParcelamentos() {
  const { profile, household } = useAuth()
  const { data: parcelamentos, isPending } = useParcelamentos()
  const { data: cartoes = [] } = useCartoes()
  const [modal, setModal] = useState<{ parcelamento?: ParcelamentoComParcelas } | null>(null)
  const [verQuitados, setVerQuitados] = useState(false)

  const mes = mesAtualISO()
  const lista = parcelamentos ?? []
  const emAndamento = lista.filter((p) => p.parcelas.some((x) => !x.pago))
  const quitados = lista.filter((p) => p.parcelas.length > 0 && p.parcelas.every((x) => x.pago))

  const parcelasDoMes = (escopo: Escopo) =>
    lista
      .filter((p) => p.escopo === escopo)
      .flatMap((p) => p.parcelas)
      .filter((x) => mesDaParcela(x) === mes)
      .reduce((s, x) => s + x.valor_cents, 0)
  const minhasNoMes = parcelasDoMes('individual')
  const daCasaNoMes = parcelasDoMes('casal')
  const restante = emAndamento.flatMap((p) => p.parcelas).filter((x) => !x.pago).reduce((s, x) => s + x.valor_cents, 0)
  const renda = profile?.renda_mensal_cents ?? 0
  const comprometido = renda > 0 ? (minhasNoMes / renda) * 100 : 0

  return (
    <>
      <Cabecalho
        titulo="Parcelamentos"
        descricao="Compras parceladas, carnês e financiamentos"
        acoes={
          <Button onClick={() => setModal({})}>
            <Plus className="size-4" aria-hidden /> Novo parcelamento
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-slate-500">{household ? 'Minhas parcelas este mês' : 'Parcelas este mês'}</p>
          <p className="text-xl font-bold tabular-nums text-slate-900">{formatarBRL(minhasNoMes)}</p>
          {household && daCasaNoMes > 0 && (
            <p className="text-xs text-slate-500">+ {formatarBRL(daCasaNoMes)} da casa</p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Renda comprometida</p>
          <p
            className={cn(
              'text-xl font-bold tabular-nums',
              comprometido > 30 ? 'text-red-600' : comprometido > 20 ? 'text-amber-600' : 'text-emerald-700',
            )}
          >
            {comprometido.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
          </p>
          <p className="text-xs text-slate-500">Recomendado: até 30% da renda líquida</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Total ainda a pagar</p>
          <p className="text-xl font-bold tabular-nums text-slate-900">{formatarBRL(restante)}</p>
        </Card>
      </div>

      {isPending ? (
        <Carregando />
      ) : emAndamento.length === 0 ? (
        <Card className="py-10 text-center">
          <Layers className="mx-auto mb-3 size-10 text-brand-600" aria-hidden />
          <p className="font-medium text-slate-900">Nenhum parcelamento em andamento</p>
          <p className="mt-1 text-sm text-slate-600">
            Cadastre compras parceladas, mesmo as que já começaram, informando quantas parcelas já foram pagas.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {emAndamento.map((p) => (
            <ItemParcelamento
              key={p.id}
              p={p}
              cartao={cartoes.find((c) => c.id === p.cartao_id)?.nome}
              casal={Boolean(household)}
              onClick={() => setModal({ parcelamento: p })}
            />
          ))}
        </ul>
      )}

      {quitados.length > 0 && (
        <div className="mt-5">
          <button className="text-sm font-medium text-slate-600 hover:underline" onClick={() => setVerQuitados((v) => !v)}>
            {verQuitados ? 'Ocultar' : 'Mostrar'} quitados ({quitados.length})
          </button>
          {verQuitados && (
            <ul className="mt-2 flex flex-col gap-3 opacity-70">
              {quitados.map((p) => (
                <ItemParcelamento
                  key={p.id}
                  p={p}
                  cartao={cartoes.find((c) => c.id === p.cartao_id)?.nome}
                  casal={Boolean(household)}
                  onClick={() => setModal({ parcelamento: p })}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <Modal
        aberto={modal !== null}
        onFechar={() => setModal(null)}
        titulo={modal?.parcelamento ? modal.parcelamento.descricao : 'Novo parcelamento'}
      >
        {modal?.parcelamento ? (
          <DetalheParcelamento p={modal.parcelamento} onConcluir={() => setModal(null)} />
        ) : (
          modal && <FormParcelamento onConcluir={() => setModal(null)} />
        )}
      </Modal>
    </>
  )
}

function ItemParcelamento({
  p,
  cartao,
  casal,
  onClick,
}: {
  p: ParcelamentoComParcelas
  cartao?: string
  casal: boolean
  onClick: () => void
}) {
  const pagas = p.parcelas.filter((x) => x.pago).length
  const total = p.parcelas.length
  const proxima = p.parcelas.find((x) => !x.pago)
  const restante = p.parcelas.filter((x) => !x.pago).reduce((s, x) => s + x.valor_cents, 0)
  return (
    <li>
      <button onClick={onClick} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-brand-200">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate font-medium text-slate-900">
              {p.descricao}
              {casal && p.escopo === 'casal' && <Home className="size-3.5 shrink-0 text-slate-500" aria-label="Da casa" />}
            </p>
            <p className="flex items-center gap-1 text-xs text-slate-500">
              {cartao && <CreditCard className="size-3" aria-hidden />}
              {cartao ?? 'Boleto / carnê'} · {formatarBRL(p.valor_total_cents)} em {total}x
            </p>
          </div>
          <p className="shrink-0 text-right">
            <span className="block text-sm font-semibold tabular-nums">{formatarBRL(proxima?.valor_cents ?? 0)}</span>
            <span className="text-xs text-slate-500">por mês</span>
          </p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand-600" style={{ width: `${(pagas / total) * 100}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-slate-600">
          <span>
            {pagas} de {total} pagas · faltam {total - pagas}
          </span>
          <span className="tabular-nums">Restam {formatarBRL(restante)}</span>
        </div>
      </button>
    </li>
  )
}

function DetalheParcelamento({ p, onConcluir }: { p: ParcelamentoComParcelas; onConcluir: () => void }) {
  const { user } = useAuth()
  const excluir = useExcluirParcelamento()
  const [confirmar, setConfirmar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function onExcluir() {
    try {
      await excluir.mutateAsync(p.id)
      onConcluir()
    } catch (err) {
      setErro(traduzirErro(mensagemDeErro(err)))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
        {p.parcelas.map((x) => (
          <li key={x.id} className="flex items-center justify-between px-3 py-2 text-sm">
            <span className={x.pago ? 'text-slate-400 line-through' : 'text-slate-900'}>
              {x.parcela_numero}/{p.num_parcelas} · {rotuloDoDia(x.data)}
            </span>
            <span className="flex items-center gap-2 tabular-nums">
              {formatarBRL(x.valor_cents)}
              {x.pago && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">paga</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">
        Para marcar uma parcela como paga, use a tela de Lançamentos (ou pague a fatura, se for no cartão).
      </p>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {p.owner_id === user?.id || p.escopo === 'casal' ? (
        <Button
          variante={confirmar ? 'perigo' : 'secundario'}
          carregando={excluir.isPending}
          onClick={() => (confirmar ? onExcluir() : setConfirmar(true))}
        >
          <Trash2 className="size-4" aria-hidden />
          {confirmar ? 'Confirmar: excluir todas as parcelas' : 'Excluir parcelamento'}
        </Button>
      ) : null}
    </div>
  )
}

function FormParcelamento({ onConcluir }: { onConcluir: () => void }) {
  const { household } = useAuth()
  const { data: categorias = [] } = useCategorias()
  const { data: cartoes = [] } = useCartoes()
  const { data: contas = [] } = useContasAtivas()
  const criar = useCriarParcelamento()
  const [erro, setErro] = useState<string | null>(null)
  const [modoValor, setModoValor] = useState<'total' | 'parcela'>('parcela')
  const [valor, setValor] = useState(0)
  const [d, setD] = useState<Omit<DadosParcelamento, 'valor_total_cents'>>({
    descricao: '',
    num_parcelas: 10,
    data_primeira: hojeISO(),
    categoria_id: null,
    escopo: 'individual',
    cartao_id: null,
    conta_id: null,
    pagas: 0,
  })
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((a) => ({ ...a, [k]: v }))
  const total = modoValor === 'total' ? valor : valor * d.num_parcelas

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!d.descricao.trim()) return setErro('Informe uma descrição.')
    if (total <= 0) return setErro('Informe o valor.')
    if (!d.categoria_id) return setErro('Escolha uma categoria.')
    if (d.num_parcelas < 1) return setErro('Informe o número de parcelas.')
    if (d.pagas > d.num_parcelas) return setErro('As parcelas pagas não podem passar do total.')
    try {
      await criar.mutateAsync({ ...d, descricao: d.descricao.trim(), valor_total_cents: total })
      onConcluir()
    } catch (err) {
      setErro(traduzirErro(mensagemDeErro(err)))
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Input label="Descrição" placeholder="Ex.: Geladeira" value={d.descricao} onChange={(e) => set('descricao', e.target.value)} />
      <Select label="Categoria" value={d.categoria_id ?? ''} onChange={(e) => set('categoria_id', e.target.value || null)}>
        <option value="">Selecione…</option>
        {categorias
          .filter((c) => c.tipo === 'despesa' && !['Dízimo', 'Oferta'].includes(c.nome))
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
      </Select>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Informar valor">
        {(
          [
            ['parcela', 'Valor da parcela'],
            ['total', 'Valor total'],
          ] as const
        ).map(([v, r]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={modoValor === v}
            onClick={() => setModoValor(v)}
            className={cn('h-9 rounded-lg text-sm font-medium', modoValor === v ? 'bg-white shadow-sm' : 'text-slate-600')}
          >
            {r}
          </button>
        ))}
      </div>
      <MoneyInput
        label={modoValor === 'total' ? 'Valor total' : 'Valor de cada parcela'}
        valor={valor}
        onChange={setValor}
        ajuda={total > 0 ? `Total: ${formatarBRL(total)}` : undefined}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Nº de parcelas"
          type="number"
          inputMode="numeric"
          min={1}
          max={480}
          value={d.num_parcelas}
          onChange={(e) => set('num_parcelas', Math.max(1, Number(e.target.value) || 1))}
        />
        <Input
          label="Já pagas"
          type="number"
          inputMode="numeric"
          min={0}
          max={d.num_parcelas}
          value={d.pagas}
          onChange={(e) => set('pagas', Math.max(0, Number(e.target.value) || 0))}
        />
      </div>
      <Input
        label="Data da 1ª parcela"
        type="date"
        value={d.data_primeira}
        onChange={(e) => set('data_primeira', e.target.value)}
        ajuda="No cartão, use a data da compra: o app calcula em qual fatura cada parcela cai."
      />
      <Select
        label="Forma de pagamento"
        value={d.cartao_id ? `cartao:${d.cartao_id}` : d.conta_id ? `conta:${d.conta_id}` : ''}
        onChange={(e) => {
          const [t, id] = e.target.value.split(':')
          setD((a) => ({ ...a, cartao_id: t === 'cartao' ? id : null, conta_id: t === 'conta' ? id : null }))
        }}
      >
        <option value="">Boleto / carnê (sem conta definida)</option>
        {cartoes.filter((c) => !c.arquivado).length > 0 && (
          <optgroup label="Cartões de crédito">
            {cartoes
              .filter((c) => !c.arquivado)
              .map((c) => (
                <option key={c.id} value={`cartao:${c.id}`}>
                  {c.nome}
                </option>
              ))}
          </optgroup>
        )}
        {contas.length > 0 && (
          <optgroup label="Débito em conta">
            {contas.map((c) => (
              <option key={c.id} value={`conta:${c.id}`}>
                {c.nome}
              </option>
            ))}
          </optgroup>
        )}
      </Select>
      {household && (
        <Escolha<Escopo>
          legenda="De quem é esse parcelamento?"
          valor={d.escopo}
          onChange={(v) => set('escopo', v)}
          opcoes={[
            { valor: 'individual', titulo: 'Meu', descricao: 'Sai da minha parte.' },
            { valor: 'casal', titulo: 'Da casa', descricao: 'Sai do fundo comum.' },
          ]}
        />
      )}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <Button type="submit" carregando={criar.isPending}>
        Criar {d.num_parcelas} parcelas
      </Button>
    </form>
  )
}
