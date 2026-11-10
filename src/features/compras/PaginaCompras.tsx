import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCheck,
  CloudOff,
  Home,
  ListChecks,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  ScanLine,
  ShoppingCart,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/auth/auth-context'
import { Cabecalho } from '@/components/layout/AuthLayout'
import { BotaoEmDesenvolvimento } from '@/components/EmDesenvolvimento'
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
import { hojeISO, rotuloDoDia } from '@/lib/datas'
import { formatarBRL } from '@/lib/money'
import { mensagemDeErro } from '@/lib/queries'
import { traduzirErro } from '@/lib/supabase'
import type { Escopo } from '@/types/database'
import {
  useAdicionarItem,
  useAtualizarItem,
  useDesmarcarTodos,
  useExcluirItem,
  useExcluirLista,
  useFinalizarCompra,
  useHistoricoCompras,
  useItens,
  useListas,
  useSalvarLista,
  useSincronizacao,
  type ItemLista,
  type ListaCompras,
  type NovoItem,
} from './api'
import {
  adivinharSetor,
  formatarQuantidade,
  interpretarItem,
  ROTULO_UNIDADE,
  SETORES,
  totalItem,
  UNIDADES,
  type Setor,
  type Unidade,
} from './itens'

const ICONES_LISTA = ['🛒', '🥦', '🥖', '💊', '🧽', '🎉', '🏠', '🐾']

export function PaginaCompras() {
  const { id } = useParams()
  return id ? <TelaLista listaId={id} /> : <TelaListas />
}

// ---------------------------------------------------------------------
// Todas as listas
// ---------------------------------------------------------------------
function TelaListas() {
  const { household } = useAuth()
  const { data: listas, isPending, error } = useListas()
  const [nova, setNova] = useState(false)
  const ativas = (listas ?? []).filter((l) => !l.arquivada)

  return (
    <>
      <Cabecalho
        titulo="Lista de compras"
        descricao="Monte a lista em casa e marque os itens no mercado"
        acoes={
          <Button onClick={() => setNova(true)}>
            <Plus className="size-4" aria-hidden /> <span className="hidden sm:inline">Nova lista</span>
          </Button>
        }
      />
      <IndicadorSincronizacao />
      {error && !listas && <Aviso tipo="erro">Não foi possível carregar as listas.</Aviso>}
      {isPending && !listas ? (
        <Carregando />
      ) : ativas.length === 0 ? (
        <Card className="py-10 text-center">
          <ShoppingCart className="mx-auto size-10 text-brand-600" aria-hidden />
          <p className="mt-3 font-medium text-slate-900">Nenhuma lista ainda</p>
          <p className="mt-1 text-sm text-slate-600">
            Crie uma lista para o mercado do mês, a feira da semana ou a farmácia. Ela é reaproveitada a cada compra.
          </p>
          <Button className="mt-4" onClick={() => setNova(true)}>
            <Plus className="size-4" aria-hidden /> Criar lista
          </Button>
        </Card>
      ) : (
        <ul className="mb-6 grid gap-3 sm:grid-cols-2">
          {ativas.map((l) => {
            const pct = l.total_itens > 0 ? (l.comprados / l.total_itens) * 100 : 0
            return (
              <li key={l.id}>
                <Link to={`/compras/${l.id}`} className="block">
                  <Card className="flex items-center gap-3 p-4 hover:border-brand-300">
                    <span
                      className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-2xl"
                      aria-hidden
                    >
                      {l.icone ?? '🛒'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 font-semibold text-slate-900">
                        <span className="truncate">{l.nome}</span>
                        {household && l.escopo === 'casal' && (
                          <Home className="size-3.5 shrink-0 text-slate-400" aria-label="Do casal" />
                        )}
                      </span>
                      <span className="block text-sm text-slate-500">
                        {l.total_itens === 0
                          ? 'Lista vazia'
                          : l.comprados > 0
                            ? `${l.comprados} de ${l.total_itens} no carrinho`
                            : `${l.total_itens} ${l.total_itens === 1 ? 'item' : 'itens'}`}
                      </span>
                      {l.comprados > 0 && (
                        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                          <span className="block h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
                        </span>
                      )}
                    </span>
                  </Card>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      <Modal aberto={nova} onFechar={() => setNova(false)} titulo="Nova lista">
        <FormLista onConcluir={() => setNova(false)} />
      </Modal>
    </>
  )
}

// ---------------------------------------------------------------------
// Uma lista (modo de compra)
// ---------------------------------------------------------------------
type EstadoModal = { tipo: 'item'; item: ItemLista } | { tipo: 'lista' } | { tipo: 'finalizar' } | null

function TelaLista({ listaId }: { listaId: string }) {
  const { household } = useAuth()
  const { data: listas } = useListas()
  const lista = listas?.find((l) => l.id === listaId)
  const { data: itens, isPending, error } = useItens(listaId)
  const adicionar = useAdicionarItem(listaId)
  const atualizar = useAtualizarItem(listaId)
  const desmarcar = useDesmarcarTodos(listaId)
  const [texto, setTexto] = useState('')
  const [ocultarComprados, setOcultarComprados] = useState(false)
  const [modal, setModal] = useState<EstadoModal>(null)
  const campo = useRef<HTMLInputElement>(null)

  const todos = itens ?? []
  const pendentes = todos.filter((i) => !i.comprado)
  const comprados = todos.filter((i) => i.comprado)
  const estimadoTotal = todos.reduce((s, i) => s + totalItem(i), 0)
  const noCarrinho = comprados.reduce((s, i) => s + totalItem(i), 0)
  const semPreco = todos.filter((i) => !i.preco_cents).length

  const grupos = useMemo(
    () =>
      SETORES.map((s) => ({ ...s, itens: pendentes.filter((i) => i.setor === s.valor) })).filter(
        (g) => g.itens.length > 0,
      ),
    [pendentes],
  )

  function onAdicionar(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    const { nome, quantidade, unidade } = interpretarItem(texto)
    // Mesmo item já na lista (e ainda não comprado): soma a quantidade em vez de duplicar.
    const existente = pendentes.find((i) => i.nome.toLowerCase() === nome.toLowerCase() && i.unidade === unidade)
    if (existente) {
      atualizar.mutate({ id: existente.id, dados: { quantidade: Number(existente.quantidade) + quantidade } })
    } else {
      adicionar.mutate({
        id: crypto.randomUUID(),
        nome,
        quantidade,
        unidade,
        setor: adivinharSetor(nome),
        preco_cents: null,
        observacao: null,
      })
    }
    setTexto('')
    campo.current?.focus()
  }

  if (!lista && listas) {
    return (
      <>
        <Cabecalho titulo="Lista de compras" />
        <Aviso tipo="atencao">Essa lista não existe mais.</Aviso>
        <Link to="/compras" className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline">
          Voltar para as listas
        </Link>
      </>
    )
  }

  return (
    <>
      <div className="mb-2">
        <Link
          to="/compras"
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" aria-hidden /> Listas
        </Link>
      </div>
      <Cabecalho
        titulo={lista ? `${lista.icone ?? '🛒'} ${lista.nome}` : 'Lista de compras'}
        descricao={
          household && lista?.escopo === 'casal' ? 'Lista do casal: os dois veem e marcam em tempo real' : undefined
        }
        acoes={
          lista && (
            <Button variante="secundario" onClick={() => setModal({ tipo: 'lista' })} aria-label="Editar lista">
              <Pencil className="size-4" aria-hidden />
            </Button>
          )
        }
      />
      <IndicadorSincronizacao />

      {/* Adição rápida: "2 kg arroz", "3 leite", "detergente" */}
      <form
        onSubmit={onAdicionar}
        className="sticky top-0 z-10 -mx-1 mb-4 flex gap-2 bg-slate-50/95 px-1 py-2 backdrop-blur"
      >
        <label htmlFor="novo-item" className="sr-only">
          Adicionar item
        </label>
        <input
          id="novo-item"
          ref={campo}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Adicionar: 2 kg arroz, 3 leite…"
          autoComplete="off"
          enterKeyHint="done"
          className="h-12 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-base focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
        />
        <Button
          type="submit"
          className="h-12"
          aria-label="Adicionar item"
          disabled={!texto.trim()}
          motivo="Digite o nome do item."
        >
          <Plus className="size-5" aria-hidden />
        </Button>
      </form>

      {error && !itens && <Aviso tipo="erro">Não foi possível carregar os itens.</Aviso>}

      {isPending && !itens ? (
        <Carregando />
      ) : todos.length === 0 ? (
        <Card className="py-8 text-center text-sm text-slate-600">
          Digite os itens acima. Dá para informar a quantidade junto: <strong>“2 kg arroz”</strong>,{' '}
          <strong>“6 ovos”</strong>. O setor do mercado é escolhido automaticamente.
        </Card>
      ) : (
        <>
          {/* Progresso da compra */}
          <div className="mb-4">
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="text-slate-600">
                <strong className="text-slate-900">{comprados.length}</strong> de {todos.length} no carrinho
              </span>
              {estimadoTotal > 0 && (
                <span
                  className="text-slate-600"
                  title={semPreco > 0 ? `${semPreco} itens sem preço estimado` : undefined}
                >
                  Carrinho <strong className="tabular-nums text-slate-900">{formatarBRL(noCarrinho)}</strong>
                  <span className="text-slate-400"> / {formatarBRL(estimadoTotal)}</span>
                </span>
              )}
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-valuenow={comprados.length}
              aria-valuemin={0}
              aria-valuemax={todos.length}
              aria-label="Itens no carrinho"
            >
              <div
                className="h-full rounded-full bg-brand-600 transition-all"
                style={{ width: `${(comprados.length / todos.length) * 100}%` }}
              />
            </div>
          </div>

          {pendentes.length === 0 && (
            <Aviso tipo="sucesso" className="mb-4">
              Tudo no carrinho! Finalize a compra para registrar o gasto.
            </Aviso>
          )}

          {grupos.map((g) => (
            <section key={g.valor} className="mb-4">
              <h2 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span aria-hidden>{g.emoji}</span> {g.rotulo}
              </h2>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {g.itens.map((i) => (
                  <LinhaItem
                    key={i.id}
                    item={i}
                    listaId={listaId}
                    onEditar={() => setModal({ tipo: 'item', item: i })}
                  />
                ))}
              </ul>
            </section>
          ))}

          {comprados.length > 0 && (
            <section className="mb-4">
              <div className="mb-1.5 flex items-center justify-between px-1">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  No carrinho ({comprados.length})
                </h2>
                <button
                  onClick={() => setOcultarComprados((v) => !v)}
                  className="text-xs font-semibold text-brand-700 hover:underline"
                  aria-expanded={!ocultarComprados}
                >
                  {ocultarComprados ? 'Mostrar' : 'Ocultar'}
                </button>
              </div>
              {!ocultarComprados && (
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {comprados.map((i) => (
                    <LinhaItem
                      key={i.id}
                      item={i}
                      listaId={listaId}
                      onEditar={() => setModal({ tipo: 'item', item: i })}
                    />
                  ))}
                </ul>
              )}
            </section>
          )}

          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            <Button
              onClick={() => setModal({ tipo: 'finalizar' })}
              disabled={comprados.length === 0}
              motivo="Marque ao menos um item como comprado."
            >
              <Receipt className="size-4" aria-hidden /> Finalizar compra
            </Button>
            <Button
              variante="secundario"
              onClick={() => desmarcar.mutate()}
              disabled={comprados.length === 0}
              motivo="Nenhum item marcado."
            >
              <RefreshCw className="size-4" aria-hidden /> Desmarcar todos
            </Button>
          </div>
        </>
      )}

      {lista && <Historico listaId={listaId} />}

      <div className="mb-6">
        <BotaoEmDesenvolvimento icone={ScanLine} rotulo="Ler nota fiscal (QR Code da NFC-e)" />
      </div>

      <Modal
        aberto={modal !== null}
        onFechar={() => setModal(null)}
        titulo={modal?.tipo === 'item' ? 'Editar item' : modal?.tipo === 'lista' ? 'Editar lista' : 'Finalizar compra'}
      >
        {modal?.tipo === 'item' && <FormItem item={modal.item} listaId={listaId} onConcluir={() => setModal(null)} />}
        {modal?.tipo === 'lista' && lista && <FormLista lista={lista} onConcluir={() => setModal(null)} />}
        {modal?.tipo === 'finalizar' && lista && (
          <FormFinalizar
            lista={lista}
            sugerido={noCarrinho}
            itensSemPreco={comprados.filter((i) => !i.preco_cents).length}
            onConcluir={() => setModal(null)}
          />
        )}
      </Modal>
    </>
  )
}

function LinhaItem({ item: i, listaId, onEditar }: { item: ItemLista; listaId: string; onEditar: () => void }) {
  const atualizar = useAtualizarItem(listaId)
  const total = totalItem(i)
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      {/* Área de toque grande: no mercado a lista é usada com uma mão. */}
      <input
        type="checkbox"
        className="size-6 shrink-0 accent-brand-700"
        checked={i.comprado}
        onChange={(e) => atualizar.mutate({ id: i.id, dados: { comprado: e.target.checked } })}
        aria-label={`${i.nome}: ${i.comprado ? 'no carrinho' : 'falta pegar'}`}
      />
      <button onClick={onEditar} className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left">
        <span className="min-w-0 flex-1">
          <span
            className={cn('block truncate text-base', i.comprado ? 'text-slate-400 line-through' : 'text-slate-900')}
          >
            {i.nome}
          </span>
          {i.observacao && <span className="block truncate text-xs text-slate-500">{i.observacao}</span>}
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-medium tabular-nums text-slate-700">
            {formatarQuantidade(Number(i.quantidade), i.unidade)}
          </span>
          {total > 0 && <span className="block text-xs tabular-nums text-slate-500">{formatarBRL(total)}</span>}
        </span>
      </button>
    </li>
  )
}

function Historico({ listaId }: { listaId: string }) {
  const { data } = useHistoricoCompras(listaId)
  if (!data || data.length === 0) return null
  const media = data.reduce((s, c) => s + c.valor_cents, 0) / data.length
  return (
    <Card className="mb-4 p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <ListChecks className="size-4 text-brand-700" aria-hidden /> Últimas compras
      </h2>
      <ul className="divide-y divide-slate-100 text-sm">
        {data.map((c) => (
          <li key={c.id} className="flex justify-between py-1.5">
            <span className="text-slate-600">{rotuloDoDia(c.data)}</span>
            <span className="tabular-nums text-slate-900">{formatarBRL(c.valor_cents)}</span>
          </li>
        ))}
      </ul>
      {data.length > 1 && (
        <p className="mt-2 text-xs text-slate-500">
          Média das últimas {data.length}: <span className="tabular-nums">{formatarBRL(Math.round(media))}</span>
        </p>
      )}
    </Card>
  )
}

function IndicadorSincronizacao() {
  const { online, pendentes } = useSincronizacao()
  if (online && pendentes === 0) return null
  return (
    <Aviso tipo={online ? 'info' : 'atencao'} className="mb-4 flex items-center gap-2">
      {online ? (
        <>
          <RefreshCw className="size-4 shrink-0 animate-spin" aria-hidden /> Sincronizando {pendentes}{' '}
          {pendentes === 1 ? 'alteração' : 'alterações'}…
        </>
      ) : (
        <>
          <CloudOff className="size-4 shrink-0" aria-hidden />
          Sem internet. Pode continuar marcando:{' '}
          {pendentes > 0
            ? `${pendentes} ${pendentes === 1 ? 'alteração será enviada' : 'alterações serão enviadas'}`
            : 'tudo será enviado'}{' '}
          quando a conexão voltar. Não feche o app até lá.
        </>
      )}
    </Aviso>
  )
}

// ---------------------------------------------------------------------
// Formulários
// ---------------------------------------------------------------------
function FormItem({ item, listaId, onConcluir }: { item: ItemLista; listaId: string; onConcluir: () => void }) {
  const atualizar = useAtualizarItem(listaId)
  const excluir = useExcluirItem(listaId)
  const [d, setD] = useState<NovoItem>({
    nome: item.nome,
    quantidade: Number(item.quantidade),
    unidade: item.unidade,
    setor: item.setor,
    preco_cents: item.preco_cents,
    observacao: item.observacao,
  })
  const [erro, setErro] = useState<string | null>(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!d.nome.trim()) return setErro('Informe o nome.')
    if (!(d.quantidade > 0)) return setErro('Informe uma quantidade maior que zero.')
    atualizar.mutate({
      id: item.id,
      dados: {
        ...d,
        nome: d.nome.trim(),
        observacao: d.observacao?.trim() || null,
        preco_cents: d.preco_cents || null,
      },
    })
    onConcluir()
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Input label="Item" value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Quantidade"
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={Number.isNaN(d.quantidade) ? '' : d.quantidade}
          onChange={(e) => setD({ ...d, quantidade: e.target.value === '' ? NaN : Number(e.target.value) })}
        />
        <Select label="Unidade" value={d.unidade} onChange={(e) => setD({ ...d, unidade: e.target.value as Unidade })}>
          {UNIDADES.map((u) => (
            <option key={u} value={u}>
              {ROTULO_UNIDADE[u]}
            </option>
          ))}
        </Select>
      </div>
      <Select label="Setor do mercado" value={d.setor} onChange={(e) => setD({ ...d, setor: e.target.value as Setor })}>
        {SETORES.map((s) => (
          <option key={s.valor} value={s.valor}>
            {s.emoji} {s.rotulo}
          </option>
        ))}
      </Select>
      <MoneyInput
        label={`Preço estimado por ${ROTULO_UNIDADE[d.unidade]} (opcional)`}
        valor={d.preco_cents ?? 0}
        onChange={(v) => setD({ ...d, preco_cents: v })}
        ajuda={
          d.preco_cents && d.quantidade > 0
            ? `Total do item: ${formatarBRL(totalItem(d))}`
            : 'Ajuda a prever quanto a compra vai custar.'
        }
      />
      <Input
        label="Observação (opcional)"
        value={d.observacao ?? ''}
        onChange={(e) => setD({ ...d, observacao: e.target.value })}
        placeholder="Ex.: marca X, sem lactose"
      />
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div className="flex gap-3 pt-1">
        <Button
          type="button"
          variante="secundario"
          onClick={() => {
            excluir.mutate(item.id)
            onConcluir()
          }}
          aria-label="Remover item"
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
        <Button type="submit" className="flex-1">
          Salvar
        </Button>
      </div>
    </form>
  )
}

function FormLista({ lista, onConcluir }: { lista?: ListaCompras; onConcluir: () => void }) {
  const { household } = useAuth()
  const navigate = useNavigate()
  const salvar = useSalvarLista()
  const excluir = useExcluirLista()
  const [nome, setNome] = useState(lista?.nome ?? '')
  const [icone, setIcone] = useState(lista?.icone ?? '🛒')
  const [escopo, setEscopo] = useState<Escopo>(lista?.escopo ?? (household ? 'casal' : 'individual'))
  const [erro, setErro] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return setErro('Dê um nome à lista.')
    try {
      const id = await salvar.mutateAsync({
        id: lista?.id,
        dados: { nome: nome.trim(), icone, escopo: household ? escopo : 'individual' },
      })
      onConcluir()
      if (!lista) navigate(`/compras/${id}`)
    } catch (err) {
      setErro(traduzirErro(mensagemDeErro(err)))
    }
  }

  async function onExcluir() {
    if (!lista) return
    try {
      await excluir.mutateAsync(lista.id)
      onConcluir()
      navigate('/compras')
    } catch (err) {
      setErro(traduzirErro(mensagemDeErro(err)))
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Input
        label="Nome"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Ex.: Mercado do mês, Feira"
      />
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-slate-700">Ícone</legend>
        <div className="flex flex-wrap gap-2">
          {ICONES_LISTA.map((ic) => (
            <button
              key={ic}
              type="button"
              onClick={() => setIcone(ic)}
              aria-pressed={icone === ic}
              className={cn(
                'flex size-11 items-center justify-center rounded-xl border text-2xl',
                icone === ic ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white',
              )}
            >
              {ic}
            </button>
          ))}
        </div>
      </fieldset>
      {household && (
        <Escolha<Escopo>
          legenda="Quem usa a lista?"
          valor={escopo}
          onChange={setEscopo}
          opcoes={[
            { valor: 'casal', titulo: 'O casal', descricao: 'Os dois editam e marcam juntos.' },
            { valor: 'individual', titulo: 'Só eu', descricao: 'Só você vê.' },
          ]}
        />
      )}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div className="flex gap-3 pt-1">
        {lista && (
          <Button
            type="button"
            variante={confirmar ? 'perigo' : 'secundario'}
            carregando={excluir.isPending}
            onClick={() => (confirmar ? onExcluir() : setConfirmar(true))}
            aria-label="Excluir lista"
          >
            <Trash2 className="size-4" aria-hidden />
            {confirmar && 'Confirmar'}
          </Button>
        )}
        <Button type="submit" className="flex-1" carregando={salvar.isPending}>
          {lista ? 'Salvar' : 'Criar lista'}
        </Button>
      </div>
      {confirmar && (
        <p className="-mt-2 text-xs text-slate-500">Os itens serão apagados. As compras já lançadas continuam.</p>
      )}
    </form>
  )
}

/** Valor do campo "Pago com": 'conta:<id>', 'cartao:<id>' ou ''. */
function FormFinalizar({
  lista,
  sugerido,
  itensSemPreco,
  onConcluir,
}: {
  lista: ListaCompras
  sugerido: number
  itensSemPreco: number
  onConcluir: () => void
}) {
  const { household } = useAuth()
  const { data: contas = [] } = useContasAtivas()
  const { data: cartoes = [] } = useCartoes()
  const { data: categorias = [] } = useCategorias()
  const finalizar = useFinalizarCompra()
  const categoriaMercado = categorias.find((c) => c.owner_id === null && c.nome === 'Mercado')?.id ?? ''
  const [valor, setValor] = useState(sugerido)
  const [data, setData] = useState(hojeISO)
  const [pagoCom, setPagoCom] = useState('')
  const [categoria, setCategoria] = useState<string | null>(null)
  const [depois, setDepois] = useState<'desmarcar' | 'remover'>('desmarcar')
  const [erro, setErro] = useState<string | null>(null)
  const categoriaEscolhida = categoria ?? categoriaMercado

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (valor <= 0) return setErro('Informe quanto foi pago.')
    if (!categoriaEscolhida) return setErro('Escolha uma categoria.')
    const [tipo, id] = pagoCom.split(':')
    try {
      await finalizar.mutateAsync({
        lista,
        valor_cents: valor,
        data,
        categoria_id: categoriaEscolhida,
        conta_id: tipo === 'conta' ? id : null,
        cartao_id: tipo === 'cartao' ? id : null,
        escopo: household ? lista.escopo : 'individual',
        depois,
      })
      onConcluir()
    } catch (err) {
      setErro(traduzirErro(mensagemDeErro(err)))
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <MoneyInput
        label="Valor pago (do cupom)"
        valor={valor}
        onChange={setValor}
        ajuda={
          sugerido > 0
            ? `Estimativa dos itens no carrinho: ${formatarBRL(sugerido)}${itensSemPreco > 0 ? ` (${itensSemPreco} sem preço)` : ''}.`
            : undefined
        }
      />
      <Input label="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
      <Select label="Pago com" value={pagoCom} onChange={(e) => setPagoCom(e.target.value)}>
        <option value="">Não informar</option>
        {contas.length > 0 && (
          <optgroup label="Contas">
            {contas.map((c) => (
              <option key={c.id} value={`conta:${c.id}`}>
                {c.nome}
              </option>
            ))}
          </optgroup>
        )}
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
      </Select>
      <Select label="Categoria" value={categoriaEscolhida} onChange={(e) => setCategoria(e.target.value || null)}>
        <option value="">Selecione…</option>
        {categorias
          .filter((c) => c.tipo === 'despesa' && !['Dízimo', 'Oferta'].includes(c.nome))
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
      </Select>
      <Escolha<'desmarcar' | 'remover'>
        legenda="E a lista?"
        valor={depois}
        onChange={setDepois}
        opcoes={[
          { valor: 'desmarcar', titulo: 'Manter os itens', descricao: 'Desmarca tudo para a próxima compra.' },
          { valor: 'remover', titulo: 'Remover comprados', descricao: 'Para listas de uma vez só.' },
        ]}
      />
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <Button type="submit" carregando={finalizar.isPending}>
        <CheckCheck className="size-4" aria-hidden /> Registrar compra
      </Button>
      <p className="-mt-2 text-xs text-slate-500">
        A compra entra em Lançamentos como despesa{household && lista.escopo === 'casal' ? ' da casa' : ''}. Itens que
        ficaram sem marcar continuam na lista.
      </p>
    </form>
  )
}
