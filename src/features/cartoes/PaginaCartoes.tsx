import { useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, CreditCard, Home, Landmark, Lock, Pencil, Plus, Undo2 } from 'lucide-react'
import { useAuth } from '@/auth/auth-context'
import { Cabecalho } from '@/components/layout/AuthLayout'
import { BotaoEmDesenvolvimento } from '@/components/EmDesenvolvimento'
import { Button } from '@/components/ui/Button'
import { Aviso, Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { Escolha } from '@/components/ui/Escolha'
import { Input, MoneyInput, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useContasAtivas } from '@/features/contas/api'
import { FormLancamento } from '@/features/lancamentos/FormLancamento'
import { cn } from '@/lib/cn'
import { adicionarMeses, hojeISO, nomeDoMes, rotuloDoDia } from '@/lib/datas'
import { formatarBRL } from '@/lib/money'
import { mensagemDeErro } from '@/lib/queries'
import { traduzirErro } from '@/lib/supabase'
import type { Cartao, Escopo, Lancamento } from '@/types/database'
import {
  faturaAtual,
  useCartoes,
  useDesfazerPagamento,
  useFatura,
  usePagarFatura,
  useSalvarCartao,
  useUsoCartoes,
  type DadosCartao,
} from './api'

type EstadoModal =
  | { tipo: 'cartao'; cartao?: Cartao }
  | { tipo: 'pagar' }
  | { tipo: 'compra'; lancamento?: Lancamento }
  | null

export function PaginaCartoes() {
  const { data: cartoes, isPending } = useCartoes()
  const { data: uso } = useUsoCartoes()
  const ativos = (cartoes ?? []).filter((c) => !c.arquivado)
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
  const selecionado = ativos.find((c) => c.id === selecionadoId) ?? ativos[0]
  const [modal, setModal] = useState<EstadoModal>(null)

  return (
    <>
      <Cabecalho
        titulo="Cartões"
        descricao="Faturas, limites e compras no crédito"
        acoes={
          <Button onClick={() => setModal({ tipo: 'cartao' })}>
            <Plus className="size-4" aria-hidden /> Novo cartão
          </Button>
        }
      />

      {isPending ? (
        <Carregando />
      ) : ativos.length === 0 ? (
        <Card className="py-10 text-center">
          <CreditCard className="mx-auto mb-3 size-10 text-brand-600" aria-hidden />
          <p className="font-medium text-slate-900">Nenhum cartão cadastrado</p>
          <p className="mt-1 text-sm text-slate-600">
            Cadastre seus cartões com o dia de fechamento e de vencimento para acompanhar as faturas.
          </p>
        </Card>
      ) : (
        <>
          <div className="-mx-4 mb-5 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            {ativos.map((c) => (
              <CartaoVisual
                key={c.id}
                cartao={c}
                utilizado={uso?.get(c.id) ?? 0}
                ativo={c.id === selecionado?.id}
                onClick={() => setSelecionadoId(c.id)}
              />
            ))}
          </div>
          {selecionado && (
            <Fatura
              key={selecionado.id}
              cartao={selecionado}
              onEditar={() => setModal({ tipo: 'cartao', cartao: selecionado })}
              onPagar={() => setModal({ tipo: 'pagar' })}
              onAbrirCompra={(l) => setModal({ tipo: 'compra', lancamento: l })}
              onNovaCompra={() => setModal({ tipo: 'compra' })}
              modalPagar={modal?.tipo === 'pagar'}
              onFecharPagar={() => setModal(null)}
            />
          )}
        </>
      )}

      <div className="mt-6">
        <BotaoEmDesenvolvimento icone={Landmark} rotulo="Importar fatura do banco (Open Finance)" />
      </div>

      <Modal
        aberto={modal?.tipo === 'cartao' || modal?.tipo === 'compra'}
        onFechar={() => setModal(null)}
        titulo={
          modal?.tipo === 'cartao'
            ? modal.cartao
              ? 'Editar cartão'
              : 'Novo cartão'
            : modal?.tipo === 'compra' && modal.lancamento
              ? 'Editar compra'
              : 'Nova compra no cartão'
        }
      >
        {modal?.tipo === 'cartao' && (
          <FormCartao key={modal.cartao?.id ?? 'novo'} cartao={modal.cartao} onConcluir={() => setModal(null)} />
        )}
        {modal?.tipo === 'compra' && (
          <FormLancamento
            key={modal.lancamento?.id ?? 'nova'}
            lancamento={modal.lancamento}
            inicial={{ tipo: 'despesa', cartao_id: selecionado?.id }}
            onConcluir={() => setModal(null)}
          />
        )}
      </Modal>
    </>
  )
}

function CartaoVisual({
  cartao,
  utilizado,
  ativo,
  onClick,
}: {
  cartao: Cartao
  utilizado: number
  ativo: boolean
  onClick: () => void
}) {
  const { household } = useAuth()
  const limite = cartao.limite_cents ?? 0
  const pct = limite > 0 ? Math.min(100, (utilizado / limite) * 100) : 0
  return (
    <button
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        'flex w-64 shrink-0 snap-start flex-col rounded-2xl p-4 text-left text-white shadow-sm transition',
        ativo ? 'bg-gradient-to-br from-slate-800 to-slate-900 ring-2 ring-brand-500 ring-offset-2' : 'bg-gradient-to-br from-slate-500 to-slate-600',
      )}
    >
      <span className="flex items-center justify-between">
        <span className="truncate font-semibold">{cartao.nome}</span>
        {household && cartao.escopo === 'casal' && <Home className="size-4 opacity-80" aria-label="Do casal" />}
      </span>
      <span className="mt-1 text-xs opacity-80">
        Fecha dia {cartao.dia_fechamento} · Vence dia {cartao.dia_vencimento}
      </span>
      {limite > 0 ? (
        <>
          <span className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/20">
            <span className="block h-full rounded-full bg-brand-200" style={{ width: `${pct}%` }} />
          </span>
          <span className="mt-1.5 text-xs opacity-90">
            Disponível <strong className="tabular-nums">{formatarBRL(limite - utilizado)}</strong> de{' '}
            {formatarBRL(limite)}
          </span>
        </>
      ) : (
        <span className="mt-4 text-xs opacity-90">
          Em aberto <strong className="tabular-nums">{formatarBRL(utilizado)}</strong>
        </span>
      )}
    </button>
  )
}

function Fatura({
  cartao,
  onEditar,
  onPagar,
  onAbrirCompra,
  onNovaCompra,
  modalPagar,
  onFecharPagar,
}: {
  cartao: Cartao
  onEditar: () => void
  onPagar: () => void
  onAbrirCompra: (l: Lancamento) => void
  onNovaCompra: () => void
  modalPagar: boolean
  onFecharPagar: () => void
}) {
  const [mes, setMes] = useState(() => faturaAtual(cartao))
  const { data, isPending, error } = useFatura(cartao.id, mes)
  const desfazer = useDesfazerPagamento()
  const [erro, setErro] = useState<string | null>(null)

  const resumo = data?.resumo
  const [a, m] = mes.split('-').map(Number)
  const ultimoDia = new Date(a, m, 0).getDate()
  const vencimento = `${mes}-${String(Math.min(cartao.dia_vencimento, ultimoDia)).padStart(2, '0')}`
  const atrasada = resumo && !resumo.pago && resumo.total_cents > 0 && vencimento < hojeISO()

  async function onDesfazer() {
    setErro(null)
    try {
      await desfazer.mutateAsync({ cartaoId: cartao.id, mes })
    } catch (err) {
      setErro(traduzirErro(mensagemDeErro(err)))
    }
  }

  return (
    <section aria-label={`Fatura do cartão ${cartao.nome}`}>
      <div className="mb-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-1.5">
        <button
          onClick={() => setMes((x) => adicionarMeses(x, -1))}
          className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"
          aria-label="Fatura anterior"
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="text-center">
          <span className="block text-sm font-semibold text-slate-900">Fatura de {nomeDoMes(mes).toLowerCase()}</span>
          <span className="block text-xs text-slate-500">Vence em {rotuloDoDia(vencimento)}</span>
        </span>
        <button
          onClick={() => setMes((x) => adicionarMeses(x, 1))}
          className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"
          aria-label="Próxima fatura"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {error && <Aviso tipo="erro">Não foi possível carregar a fatura.</Aviso>}
      {isPending ? (
        <Carregando />
      ) : (
        resumo && (
          <>
            <Card className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500">Total da fatura</p>
                <p className="text-2xl font-bold tabular-nums text-slate-900">{formatarBRL(resumo.total_cents)}</p>
                {resumo.pago ? (
                  <p className="mt-0.5 flex items-center gap-1 text-sm font-medium text-emerald-700">
                    <CheckCircle2 className="size-4" aria-hidden /> Paga em {rotuloDoDia(resumo.data_pagamento!)}
                  </p>
                ) : (
                  atrasada && <p className="mt-0.5 text-sm font-medium text-red-600">Vencida e não paga</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variante="fantasma" onClick={onEditar} aria-label="Editar cartão">
                  <Pencil className="size-4" aria-hidden />
                </Button>
                {resumo.pago ? (
                  <Button variante="secundario" onClick={onDesfazer} carregando={desfazer.isPending}>
                    <Undo2 className="size-4" aria-hidden /> Desfazer pagamento
                  </Button>
                ) : (
                  resumo.total_cents > 0 && <Button onClick={onPagar}>Pagar fatura</Button>
                )}
              </div>
            </Card>
            {erro && <Aviso tipo="erro" className="mb-3">{erro}</Aviso>}

            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {data.itens.map((l) => (
                <li key={l.id}>
                  <button
                    onClick={() => onAbrirCompra(l)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{l.descricao}</span>
                      <span className="text-xs text-slate-500">{rotuloDoDia(l.data)}</span>
                    </span>
                    <span className="text-sm font-semibold tabular-nums">{formatarBRL(l.valor_cents)}</span>
                  </button>
                </li>
              ))}
              {resumo.privado_cents > 0 && (
                <li className="flex items-center gap-3 px-4 py-3 text-sm text-slate-500">
                  <Lock className="size-4" aria-hidden />
                  <span className="flex-1">Compras individuais do cônjuge</span>
                  <span className="font-semibold tabular-nums">{formatarBRL(resumo.privado_cents)}</span>
                </li>
              )}
              {data.itens.length === 0 && resumo.privado_cents === 0 && (
                <li className="px-4 py-8 text-center text-sm text-slate-500">Nenhuma compra nesta fatura.</li>
              )}
            </ul>
            <Button variante="secundario" className="mt-3 w-full" onClick={onNovaCompra}>
              <Plus className="size-4" aria-hidden /> Nova compra neste cartão
            </Button>

            <Modal aberto={modalPagar} onFechar={onFecharPagar} titulo="Pagar fatura">
              {modalPagar && (
                <FormPagarFatura cartaoId={cartao.id} mes={mes} total={resumo.total_cents} onConcluir={onFecharPagar} />
              )}
            </Modal>
          </>
        )
      )}
    </section>
  )
}

function FormPagarFatura({
  cartaoId,
  mes,
  total,
  onConcluir,
}: {
  cartaoId: string
  mes: string
  total: number
  onConcluir: () => void
}) {
  const { data: contas = [] } = useContasAtivas()
  const pagar = usePagarFatura()
  const [contaId, setContaId] = useState(contas[0]?.id ?? '')
  const [data, setData] = useState(hojeISO)
  const [erro, setErro] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await pagar.mutateAsync({ cartaoId, mes, contaId: contaId || null, data })
      onConcluir()
    } catch (err) {
      setErro(traduzirErro(mensagemDeErro(err)))
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-slate-700">
        Valor da fatura: <strong className="tabular-nums">{formatarBRL(total)}</strong>
      </p>
      <Select label="Pago com a conta" value={contaId} onChange={(e) => setContaId(e.target.value)}>
        <option value="">Não informar</option>
        {contas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </Select>
      <Input label="Data do pagamento" type="date" value={data} onChange={(e) => setData(e.target.value)} />
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <Button type="submit" carregando={pagar.isPending}>
        Confirmar pagamento
      </Button>
    </form>
  )
}

function FormCartao({ cartao, onConcluir }: { cartao?: Cartao; onConcluir: () => void }) {
  const { household } = useAuth()
  const salvar = useSalvarCartao()
  const [erro, setErro] = useState<string | null>(null)
  const [d, setD] = useState<DadosCartao>({
    nome: cartao?.nome ?? '',
    bandeira: cartao?.bandeira ?? null,
    limite_cents: cartao?.limite_cents ?? null,
    dia_fechamento: cartao?.dia_fechamento ?? 1,
    dia_vencimento: cartao?.dia_vencimento ?? 10,
    escopo: cartao?.escopo ?? 'individual',
    arquivado: cartao?.arquivado ?? false,
  })
  const set = <K extends keyof DadosCartao>(k: K, v: DadosCartao[K]) => setD((a) => ({ ...a, [k]: v }))
  const dias = Array.from({ length: 31 }, (_, i) => i + 1)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (d.nome.trim().length < 2) return setErro('Informe o nome do cartão.')
    try {
      await salvar.mutateAsync({
        id: cartao?.id,
        dados: { ...d, nome: d.nome.trim(), bandeira: d.bandeira?.trim() || null, limite_cents: d.limite_cents || null },
      })
      onConcluir()
    } catch (err) {
      setErro(traduzirErro(mensagemDeErro(err)))
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Input label="Nome" placeholder="Ex.: Cartão Inter Hugo" value={d.nome} onChange={(e) => set('nome', e.target.value)} />
      <Input
        label="Bandeira (opcional)"
        placeholder="Ex.: Mastercard"
        value={d.bandeira ?? ''}
        onChange={(e) => set('bandeira', e.target.value)}
      />
      <MoneyInput label="Limite (opcional)" valor={d.limite_cents ?? 0} onChange={(v) => set('limite_cents', v)} />
      <div className="grid grid-cols-2 gap-3">
        <Select label="Dia do fechamento" value={d.dia_fechamento} onChange={(e) => set('dia_fechamento', Number(e.target.value))}>
          {dias.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
        <Select label="Dia do vencimento" value={d.dia_vencimento} onChange={(e) => set('dia_vencimento', Number(e.target.value))}>
          {dias.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </div>
      <p className="-mt-2 text-xs text-slate-500">
        Compras feitas no dia do fechamento ou depois entram na fatura do mês seguinte.
      </p>
      {household && (
        <Escolha<Escopo>
          legenda="De quem é o cartão?"
          valor={d.escopo}
          onChange={(v) => set('escopo', v)}
          opcoes={[
            { valor: 'individual', titulo: 'Meu', descricao: 'Só eu vejo as compras e a fatura.' },
            {
              valor: 'casal',
              titulo: 'Do casal',
              descricao: 'Os dois veem a fatura. Compras individuais aparecem só como total.',
            },
          ]}
        />
      )}
      {cartao && (
        <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            className="size-5 accent-brand-700"
            checked={d.arquivado}
            onChange={(e) => set('arquivado', e.target.checked)}
          />
          Arquivar cartão (cancelado ou sem uso)
        </label>
      )}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <Button type="submit" carregando={salvar.isPending}>
        Salvar
      </Button>
    </form>
  )
}
