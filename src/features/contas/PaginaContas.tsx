import { useState } from 'react'
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Home, Landmark, PartyPopper, Plus, Trash2, Trophy, Wallet } from 'lucide-react'
import { useAuth } from '@/auth/auth-context'
import { Cabecalho } from '@/components/layout/AuthLayout'
import { BotaoEmDesenvolvimento } from '@/components/EmDesenvolvimento'
import { Button } from '@/components/ui/Button'
import { Aviso, Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { Escolha } from '@/components/ui/Escolha'
import { Input, MoneyInput, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import { hojeISO, nomeDoMes } from '@/lib/datas'
import { formatarBRL } from '@/lib/money'
import { mensagemDeErro } from '@/lib/queries'
import { traduzirErro } from '@/lib/supabase'
import type { Conta, Escopo, TipoConta } from '@/types/database'
import {
  ehCofrinho,
  ICONES_COFRINHO,
  TIPOS_COFRINHO,
  TIPOS_CONTA,
  useContas,
  useExcluirConta,
  useSalvarConta,
  useSaldos,
  useTransferir,
  type DadosConta,
} from './api'
import { progressoCofrinho } from './cofrinho'

type EstadoModal =
  | { tipo: 'conta'; conta?: Conta; cofrinho: boolean }
  | { tipo: 'transferencia' }
  | { tipo: 'movimento'; cofrinho: Conta; direcao: 'guardar' | 'retirar' }
  | null

const tituloModal = (m: EstadoModal): string => {
  if (!m) return ''
  if (m.tipo === 'transferencia') return 'Transferir entre contas'
  if (m.tipo === 'movimento') return `${m.direcao === 'guardar' ? 'Guardar em' : 'Retirar de'} ${m.cofrinho.nome}`
  if (m.conta) return m.cofrinho ? 'Editar cofrinho' : 'Editar conta'
  return m.cofrinho ? 'Novo cofrinho' : 'Nova conta'
}

export function PaginaContas() {
  const { household } = useAuth()
  const { data: contas, isPending } = useContas()
  const { data: saldos } = useSaldos()
  const [modal, setModal] = useState<EstadoModal>(null)
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false)
  const [mostrarConquistas, setMostrarConquistas] = useState(false)

  const lista = contas ?? []
  const ativas = lista.filter((c) => !c.arquivada)
  const contasComuns = ativas.filter((c) => !ehCofrinho(c))
  const cofrinhos = ativas.filter((c) => ehCofrinho(c) && !c.concluido_em)
  const conquistas = lista.filter((c) => ehCofrinho(c) && c.concluido_em)
  const arquivadas = lista.filter((c) => c.arquivada && !(ehCofrinho(c) && c.concluido_em))
  const saldo = (id: string) => saldos?.get(id) ?? 0
  const soma = (cs: Conta[]) => cs.reduce((s, c) => s + saldo(c.id), 0)
  const casal = Boolean(household)

  return (
    <>
      <Cabecalho
        titulo="Contas e cofrinhos"
        descricao="Onde está o seu dinheiro e para que ele está guardado"
        acoes={
          <div className="flex flex-wrap gap-2">
            {ativas.length >= 2 && (
              <Button variante="secundario" onClick={() => setModal({ tipo: 'transferencia' })}>
                <ArrowLeftRight className="size-4" aria-hidden /> Transferir
              </Button>
            )}
            <Button variante="secundario" onClick={() => setModal({ tipo: 'conta', cofrinho: true })}>
              <Plus className="size-4" aria-hidden /> Cofrinho
            </Button>
            <Button onClick={() => setModal({ tipo: 'conta', cofrinho: false })}>
              <Plus className="size-4" aria-hidden /> Conta
            </Button>
          </div>
        }
      />

      {isPending ? (
        <Carregando />
      ) : (
        <>
          <Card className="mb-5 grid grid-cols-2 gap-4 bg-gradient-to-br from-brand-700 to-brand-800 text-white sm:grid-cols-3">
            <div>
              <p className="text-xs text-brand-100">Em contas</p>
              <p className="text-xl font-bold tabular-nums">{formatarBRL(soma(contasComuns))}</p>
            </div>
            <div>
              <p className="text-xs text-brand-100">Guardado em cofrinhos</p>
              <p className="text-xl font-bold tabular-nums">{formatarBRL(soma(cofrinhos))}</p>
            </div>
            <div className="col-span-2 border-t border-white/15 pt-3 sm:col-span-1 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
              <p className="text-xs text-brand-100">Total</p>
              <p className="text-xl font-bold tabular-nums">{formatarBRL(soma(contasComuns) + soma(cofrinhos))}</p>
            </div>
          </Card>

          {/* Contas */}
          <h2 className="mb-2 text-lg font-semibold text-slate-900">Contas</h2>
          {contasComuns.length === 0 ? (
            <Card className="mb-6 py-8 text-center">
              <Wallet className="mx-auto mb-3 size-10 text-brand-600" aria-hidden />
              <p className="font-medium text-slate-900">Nenhuma conta cadastrada</p>
              <p className="mt-1 text-sm text-slate-600">Cadastre sua conta corrente para acompanhar o saldo.</p>
            </Card>
          ) : (
            <ul className="mb-6 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {contasComuns.map((c) => (
                <ItemConta key={c.id} conta={c} saldo={saldo(c.id)} casal={casal} onClick={() => setModal({ tipo: 'conta', conta: c, cofrinho: false })} />
              ))}
            </ul>
          )}

          {/* Cofrinhos */}
          <h2 className="mb-2 text-lg font-semibold text-slate-900">Cofrinhos</h2>
          {cofrinhos.length === 0 ? (
            <Card className="py-8 text-center">
              <p className="mb-2 text-4xl" aria-hidden>
                🐷
              </p>
              <p className="font-medium text-slate-900">Nenhum cofrinho ainda</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600">
                Separe dinheiro por objetivo: reserva de emergência, viagem, IPVA, troca do carro. Defina uma meta e acompanhe
                quanto falta.
              </p>
              <Button className="mt-4" onClick={() => setModal({ tipo: 'conta', cofrinho: true })}>
                <Plus className="size-4" aria-hidden /> Criar cofrinho
              </Button>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {cofrinhos.map((c) => (
                <CartaoCofrinho
                  key={c.id}
                  conta={c}
                  saldo={saldo(c.id)}
                  casal={casal}
                  onEditar={() => setModal({ tipo: 'conta', conta: c, cofrinho: true })}
                  onGuardar={() => setModal({ tipo: 'movimento', cofrinho: c, direcao: 'guardar' })}
                  onRetirar={() => setModal({ tipo: 'movimento', cofrinho: c, direcao: 'retirar' })}
                />
              ))}
            </div>
          )}

          {conquistas.length > 0 && (
            <div className="mt-5">
              <button
                className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:underline"
                onClick={() => setMostrarConquistas((v) => !v)}
              >
                <Trophy className="size-4 text-amber-500" aria-hidden />
                {mostrarConquistas ? 'Ocultar' : 'Ver'} conquistas ({conquistas.length})
              </button>
              {mostrarConquistas && (
                <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {conquistas.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => setModal({ tipo: 'conta', conta: c, cofrinho: true })}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                      >
                        <span className="text-2xl" aria-hidden>
                          {c.icone ?? '🏆'}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-900">{c.nome}</span>
                          <span className="text-xs text-slate-500">
                            Conquistado em {nomeDoMes(c.concluido_em!.slice(0, 7)).toLowerCase()}
                          </span>
                        </span>
                        {c.meta_cents && <span className="text-sm font-semibold tabular-nums">{formatarBRL(c.meta_cents)}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {arquivadas.length > 0 && (
        <div className="mt-5">
          <button className="text-sm font-medium text-slate-600 hover:underline" onClick={() => setMostrarArquivadas((v) => !v)}>
            {mostrarArquivadas ? 'Ocultar' : 'Mostrar'} arquivadas ({arquivadas.length})
          </button>
          {mostrarArquivadas && (
            <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white opacity-70">
              {arquivadas.map((c) => (
                <ItemConta
                  key={c.id}
                  conta={c}
                  saldo={saldo(c.id)}
                  casal={casal}
                  onClick={() => setModal({ tipo: 'conta', conta: c, cofrinho: ehCofrinho(c) })}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-6">
        <BotaoEmDesenvolvimento icone={Landmark} rotulo="Conectar banco (Open Finance)" />
      </div>

      <Modal aberto={modal !== null} onFechar={() => setModal(null)} titulo={tituloModal(modal)}>
        {modal?.tipo === 'conta' && (
          <FormConta
            key={modal.conta?.id ?? (modal.cofrinho ? 'novo-cofrinho' : 'nova-conta')}
            conta={modal.conta}
            cofrinho={modal.cofrinho}
            saldo={modal.conta ? saldo(modal.conta.id) : 0}
            onConcluir={() => setModal(null)}
          />
        )}
        {modal?.tipo === 'transferencia' && (
          <FormTransferencia contas={ativas} saldo={saldo} onConcluir={() => setModal(null)} />
        )}
        {modal?.tipo === 'movimento' && (
          <FormMovimentoCofrinho
            cofrinho={modal.cofrinho}
            direcao={modal.direcao}
            contas={ativas.filter((c) => c.id !== modal.cofrinho.id)}
            saldo={saldo}
            onConcluir={() => setModal(null)}
          />
        )}
      </Modal>
    </>
  )
}

function ItemConta({ conta, saldo, casal, onClick }: { conta: Conta; saldo: number; casal: boolean; onClick: () => void }) {
  const rotuloTipo = [...TIPOS_CONTA, ...TIPOS_COFRINHO].find((t) => t.valor === conta.tipo)?.rotulo
  return (
    <li>
      <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
            {conta.icone && <span aria-hidden>{conta.icone}</span>}
            {conta.nome}
            {casal && conta.escopo === 'casal' && <Home className="size-3.5 text-slate-500" aria-label="Do casal" />}
          </span>
          <span className="text-xs text-slate-500">{rotuloTipo}</span>
        </span>
        <span className={cn('text-sm font-semibold tabular-nums', saldo < 0 ? 'text-red-600' : 'text-slate-900')}>
          {formatarBRL(saldo)}
        </span>
      </button>
    </li>
  )
}

function CartaoCofrinho({
  conta,
  saldo,
  casal,
  onEditar,
  onGuardar,
  onRetirar,
}: {
  conta: Conta
  saldo: number
  casal: boolean
  onEditar: () => void
  onGuardar: () => void
  onRetirar: () => void
}) {
  const p = progressoCofrinho(conta, saldo)
  return (
    <Card className="flex flex-col gap-3 p-4">
      <button onClick={onEditar} className="flex items-start gap-3 text-left">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-2xl" aria-hidden>
          {conta.icone ?? (conta.tipo === 'reserva' ? '🛡️' : '🐷')}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 font-medium text-slate-900">
            <span className="truncate">{conta.nome}</span>
            {casal && conta.escopo === 'casal' && <Home className="size-3.5 shrink-0 text-slate-500" aria-label="Do casal" />}
          </span>
          <span className="block text-xl font-bold tabular-nums text-slate-900">{formatarBRL(saldo)}</span>
        </span>
      </button>

      {p.pct !== null && (
        <div>
          <div
            className="h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuenow={Math.round(p.pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progresso da meta de ${conta.nome}`}
          >
            <div className={cn('h-full rounded-full', p.atingida ? 'bg-emerald-600' : 'bg-brand-600')} style={{ width: `${p.pct}%` }} />
          </div>
          <p className="mt-1.5 flex justify-between gap-2 text-xs text-slate-600">
            <span>
              {Math.floor(p.pct)}% de {formatarBRL(conta.meta_cents!)}
            </span>
            {!p.atingida && <span className="tabular-nums">faltam {formatarBRL(p.falta)}</span>}
          </p>
          {p.atingida ? (
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-700">
              <PartyPopper className="size-3.5" aria-hidden /> Meta atingida! Edite o cofrinho para marcar como conquista.
            </p>
          ) : p.atrasado ? (
            <p className="mt-1 text-xs font-medium text-amber-700">A data da meta já passou.</p>
          ) : (
            p.porMes !== null && (
              <p className="mt-1 text-xs text-slate-500">
                Guarde {formatarBRL(p.porMes)}/mês até {nomeDoMes(conta.data_meta!.slice(0, 7)).toLowerCase()}
              </p>
            )
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variante="secundario" className="h-10" onClick={onRetirar} disabled={saldo <= 0} motivo="O cofrinho está sem saldo para retirar.">
          <ArrowUpFromLine className="size-4" aria-hidden /> Retirar
        </Button>
        <Button className="h-10" onClick={onGuardar}>
          <ArrowDownToLine className="size-4" aria-hidden /> Guardar
        </Button>
      </div>
    </Card>
  )
}

function FormConta({
  conta,
  cofrinho,
  saldo,
  onConcluir,
}: {
  conta?: Conta
  cofrinho: boolean
  saldo: number
  onConcluir: () => void
}) {
  const { household } = useAuth()
  const salvar = useSalvarConta()
  const excluir = useExcluirConta()
  const [erro, setErro] = useState<string | null>(null)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const [d, setD] = useState<DadosConta>({
    nome: conta?.nome ?? '',
    tipo: conta?.tipo ?? (cofrinho ? 'cofrinho' : 'corrente'),
    escopo: conta?.escopo ?? 'individual',
    saldo_inicial_cents: conta?.saldo_inicial_cents ?? 0,
    arquivada: conta?.arquivada ?? false,
    meta_cents: conta?.meta_cents ?? null,
    data_meta: conta?.data_meta ?? null,
    icone: conta?.icone ?? (cofrinho ? '🐷' : null),
    concluido_em: conta?.concluido_em ?? null,
  })
  const set = <K extends keyof DadosConta>(k: K, v: DadosConta[K]) => setD((a) => ({ ...a, [k]: v }))
  const tipos = cofrinho ? TIPOS_COFRINHO : TIPOS_CONTA
  const atingida = Boolean(d.meta_cents && saldo >= d.meta_cents)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (d.nome.trim().length < 2) return setErro(cofrinho ? 'Dê um nome ao cofrinho.' : 'Informe o nome da conta.')
    try {
      await salvar.mutateAsync({
        id: conta?.id,
        dados: {
          ...d,
          nome: d.nome.trim(),
          meta_cents: cofrinho ? d.meta_cents || null : null,
          data_meta: cofrinho ? d.data_meta || null : null,
          icone: cofrinho ? d.icone : null,
        },
      })
      onConcluir()
    } catch (err) {
      setErro(traduzirErro(mensagemDeErro(err)))
    }
  }

  async function onExcluir() {
    try {
      await excluir.mutateAsync(conta!.id)
      onConcluir()
    } catch (err) {
      setErro(traduzirErro(mensagemDeErro(err)))
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {cofrinho && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700">Ícone</legend>
          <div className="flex flex-wrap gap-1.5">
            {ICONES_COFRINHO.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => set('icone', i)}
                aria-pressed={d.icone === i}
                aria-label={`Ícone ${i}`}
                className={cn(
                  'flex size-10 items-center justify-center rounded-xl border text-xl',
                  d.icone === i ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50',
                )}
              >
                {i}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <Input
        label="Nome"
        placeholder={cofrinho ? 'Ex.: Viagem de férias' : 'Ex.: Nubank Hugo'}
        value={d.nome}
        onChange={(e) => set('nome', e.target.value)}
      />
      <Select label="Tipo" value={d.tipo} onChange={(e) => set('tipo', e.target.value as TipoConta)}>
        {tipos.map((t) => (
          <option key={t.valor} value={t.valor}>
            {t.rotulo}
          </option>
        ))}
      </Select>
      {cofrinho && (
        <div className="grid grid-cols-2 gap-3">
          <MoneyInput label="Meta (opcional)" valor={d.meta_cents ?? 0} onChange={(v) => set('meta_cents', v || null)} />
          <Input
            label="Até quando (opcional)"
            type="month"
            value={d.data_meta?.slice(0, 7) ?? ''}
            onChange={(e) => set('data_meta', e.target.value ? `${e.target.value}-01` : null)}
          />
        </div>
      )}
      {cofrinho && d.tipo === 'reserva' && (
        <p className="-mt-2 text-xs text-slate-500">
          Dica: o ideal é que a reserva cubra de 6 a 12 meses do seu custo de vida.
        </p>
      )}
      <MoneyInput
        label={cofrinho ? 'Quanto já tem guardado' : 'Saldo inicial'}
        valor={d.saldo_inicial_cents}
        onChange={(v) => set('saldo_inicial_cents', v)}
        ajuda={
          cofrinho
            ? 'O valor que já está no cofrinho hoje. Depois, use Guardar e Retirar.'
            : 'Quanto havia na conta antes do primeiro lançamento registrado no app.'
        }
      />
      {household && (
        <Escolha<Escopo>
          legenda={cofrinho ? 'De quem é o cofrinho?' : 'De quem é a conta?'}
          valor={d.escopo}
          onChange={(v) => set('escopo', v)}
          opcoes={[
            { valor: 'individual', titulo: 'Meu', descricao: 'Só eu vejo.' },
            {
              valor: 'casal',
              titulo: 'Do casal',
              descricao: cofrinho ? 'Objetivo dos dois. Ex.: reserva da família, viagem.' : 'Ex.: conta conjunta.',
            },
          ]}
        />
      )}
      {cofrinho && conta && (atingida || d.concluido_em) && (
        <label className="flex items-center gap-3 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-900">
          <input
            type="checkbox"
            className="size-5 accent-emerald-700"
            checked={Boolean(d.concluido_em)}
            onChange={(e) => set('concluido_em', e.target.checked ? hojeISO() : null)}
          />
          <Trophy className="size-4" aria-hidden /> Marcar como conquista
        </label>
      )}
      {conta && (
        <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            className="size-5 accent-brand-700"
            checked={d.arquivada}
            onChange={(e) => set('arquivada', e.target.checked)}
          />
          Arquivar (some das listas, mas mantém o histórico)
        </label>
      )}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {confirmarExclusao && (
        <Aviso tipo="atencao">
          Os lançamentos ligados a {cofrinho ? 'este cofrinho' : 'esta conta'} serão mantidos, mas ficarão sem conta. Prefira
          arquivar se houver histórico.
        </Aviso>
      )}
      <div className="flex gap-3">
        {conta && (
          <Button
            type="button"
            variante={confirmarExclusao ? 'perigo' : 'secundario'}
            carregando={excluir.isPending}
            onClick={() => (confirmarExclusao ? onExcluir() : setConfirmarExclusao(true))}
            aria-label="Excluir"
          >
            <Trash2 className="size-4" aria-hidden />
            {confirmarExclusao && 'Confirmar'}
          </Button>
        )}
        <Button type="submit" className="flex-1" carregando={salvar.isPending}>
          Salvar
        </Button>
      </div>
    </form>
  )
}

/** Guardar (conta → cofrinho) ou retirar (cofrinho → conta): é uma transferência. */
function FormMovimentoCofrinho({
  cofrinho,
  direcao,
  contas,
  saldo,
  onConcluir,
}: {
  cofrinho: Conta
  direcao: 'guardar' | 'retirar'
  contas: Conta[]
  saldo: (id: string) => number
  onConcluir: () => void
}) {
  const transferir = useTransferir()
  const p = progressoCofrinho(cofrinho, saldo(cofrinho.id))
  const comuns = contas.filter((c) => !ehCofrinho(c))
  const [outraId, setOutraId] = useState((comuns[0] ?? contas[0])?.id ?? '')
  const [valor, setValor] = useState(direcao === 'guardar' ? (p.porMes ?? 0) : 0)
  const [data, setData] = useState(hojeISO)
  const [erro, setErro] = useState<string | null>(null)
  const outra = contas.find((c) => c.id === outraId)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!outra) return setErro('Cadastre uma conta para movimentar o cofrinho.')
    if (valor <= 0) return setErro('Informe o valor.')
    if (direcao === 'retirar' && valor > saldo(cofrinho.id)) return setErro('O valor é maior que o saldo do cofrinho.')
    const [origem, destino] = direcao === 'guardar' ? [outra, cofrinho] : [cofrinho, outra]
    try {
      await transferir.mutateAsync({
        conta_id: origem.id,
        conta_destino_id: destino.id,
        valor_cents: valor,
        data,
        descricao: direcao === 'guardar' ? `Guardado em ${cofrinho.nome}` : `Retirado de ${cofrinho.nome}`,
        escopo: origem.escopo === 'casal' && destino.escopo === 'casal' ? 'casal' : 'individual',
      })
      onConcluir()
    } catch (err) {
      setErro(traduzirErro(mensagemDeErro(err)))
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-slate-600">
        Saldo do cofrinho: <strong className="tabular-nums text-slate-900">{formatarBRL(saldo(cofrinho.id))}</strong>
      </p>
      <MoneyInput
        label={direcao === 'guardar' ? 'Quanto guardar' : 'Quanto retirar'}
        valor={valor}
        onChange={setValor}
        ajuda={direcao === 'guardar' && p.porMes ? `Sugestão para bater a meta no prazo: ${formatarBRL(p.porMes)}` : undefined}
      />
      <Select
        label={direcao === 'guardar' ? 'Sai da conta' : 'Vai para a conta'}
        value={outraId}
        onChange={(e) => setOutraId(e.target.value)}
        ajuda={outra ? `Saldo: ${formatarBRL(saldo(outra.id))}` : undefined}
      >
        {comuns.length > 0 && (
          <optgroup label="Contas">
            {comuns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </optgroup>
        )}
        {contas.some(ehCofrinho) && (
          <optgroup label="Outros cofrinhos">
            {contas.filter(ehCofrinho).map((c) => (
              <option key={c.id} value={c.id}>
                {c.icone ? `${c.icone} ` : ''}
                {c.nome}
              </option>
            ))}
          </optgroup>
        )}
      </Select>
      <Input label="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
      <p className="text-xs text-slate-500">Movimentar cofrinhos não conta como receita nem despesa.</p>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <Button type="submit" carregando={transferir.isPending}>
        {direcao === 'guardar' ? <ArrowDownToLine className="size-4" aria-hidden /> : <ArrowUpFromLine className="size-4" aria-hidden />}
        {direcao === 'guardar' ? 'Guardar' : 'Retirar'}
      </Button>
    </form>
  )
}

function FormTransferencia({
  contas,
  saldo,
  onConcluir,
}: {
  contas: Conta[]
  saldo: (id: string) => number
  onConcluir: () => void
}) {
  const transferir = useTransferir()
  const [erro, setErro] = useState<string | null>(null)
  const [origem, setOrigem] = useState(contas[0]?.id ?? '')
  const [destino, setDestino] = useState(contas[1]?.id ?? '')
  const [valor, setValor] = useState(0)
  const [data, setData] = useState(hojeISO)
  const rotulo = (c: Conta) => `${c.icone ? `${c.icone} ` : ''}${c.nome}`

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (origem === destino) return setErro('Escolha contas diferentes.')
    if (valor <= 0) return setErro('Informe o valor.')
    const nome = (id: string) => contas.find((c) => c.id === id)?.nome ?? ''
    try {
      await transferir.mutateAsync({
        conta_id: origem,
        conta_destino_id: destino,
        valor_cents: valor,
        data,
        descricao: `Transferência ${nome(origem)} → ${nome(destino)}`,
        escopo: contas.filter((c) => c.id === origem || c.id === destino).every((c) => c.escopo === 'casal')
          ? 'casal'
          : 'individual',
      })
      onConcluir()
    } catch (err) {
      setErro(traduzirErro(mensagemDeErro(err)))
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Select label="De" value={origem} onChange={(e) => setOrigem(e.target.value)} ajuda={`Saldo: ${formatarBRL(saldo(origem))}`}>
        {contas.map((c) => (
          <option key={c.id} value={c.id}>
            {rotulo(c)}
          </option>
        ))}
      </Select>
      <Select label="Para" value={destino} onChange={(e) => setDestino(e.target.value)}>
        {contas.map((c) => (
          <option key={c.id} value={c.id}>
            {rotulo(c)}
          </option>
        ))}
      </Select>
      <MoneyInput label="Valor" valor={valor} onChange={setValor} />
      <Input label="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
      <p className="text-xs text-slate-500">Transferências não contam como receita nem despesa.</p>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <Button type="submit" carregando={transferir.isPending}>
        Transferir
      </Button>
    </form>
  )
}
