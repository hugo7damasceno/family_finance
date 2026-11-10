import { useState } from 'react'
import { ArrowLeftRight, Home, Landmark, Plus, Trash2, Wallet } from 'lucide-react'
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
import { hojeISO } from '@/lib/datas'
import { formatarBRL } from '@/lib/money'
import { mensagemDeErro } from '@/lib/queries'
import { traduzirErro } from '@/lib/supabase'
import type { Conta, Escopo, TipoConta } from '@/types/database'
import {
  TIPOS_CONTA,
  useContas,
  useExcluirConta,
  useSalvarConta,
  useSaldos,
  useTransferir,
  type DadosConta,
} from './api'

type EstadoModal = { tipo: 'conta'; conta?: Conta } | { tipo: 'transferencia' } | null

export function PaginaContas() {
  const { household } = useAuth()
  const { data: contas, isPending } = useContas()
  const { data: saldos } = useSaldos()
  const [modal, setModal] = useState<EstadoModal>(null)
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false)

  const ativas = (contas ?? []).filter((c) => !c.arquivada)
  const arquivadas = (contas ?? []).filter((c) => c.arquivada)
  const saldo = (id: string) => saldos?.get(id) ?? 0
  const total = ativas.reduce((s, c) => s + saldo(c.id), 0)

  return (
    <>
      <Cabecalho
        titulo="Contas"
        descricao="Contas bancárias, poupança, reserva e dinheiro"
        acoes={
          <div className="flex gap-2">
            {ativas.length >= 2 && (
              <Button variante="secundario" onClick={() => setModal({ tipo: 'transferencia' })}>
                <ArrowLeftRight className="size-4" aria-hidden /> Transferir
              </Button>
            )}
            <Button onClick={() => setModal({ tipo: 'conta' })}>
              <Plus className="size-4" aria-hidden /> Nova conta
            </Button>
          </div>
        }
      />

      {isPending ? (
        <Carregando />
      ) : ativas.length === 0 ? (
        <Card className="py-10 text-center">
          <Wallet className="mx-auto mb-3 size-10 text-brand-600" aria-hidden />
          <p className="font-medium text-slate-900">Nenhuma conta cadastrada</p>
          <p className="mt-1 text-sm text-slate-600">
            Cadastre sua conta corrente, poupança e a reserva de emergência para acompanhar os saldos.
          </p>
        </Card>
      ) : (
        <>
          <Card className="mb-4 bg-gradient-to-br from-brand-700 to-brand-800 text-white">
            <p className="text-sm text-brand-100">Saldo total</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{formatarBRL(total)}</p>
          </Card>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {ativas.map((c) => (
              <ItemConta key={c.id} conta={c} saldo={saldo(c.id)} casal={Boolean(household)} onClick={() => setModal({ tipo: 'conta', conta: c })} />
            ))}
          </ul>
        </>
      )}

      {arquivadas.length > 0 && (
        <div className="mt-4">
          <button className="text-sm font-medium text-slate-600 hover:underline" onClick={() => setMostrarArquivadas((v) => !v)}>
            {mostrarArquivadas ? 'Ocultar' : 'Mostrar'} contas arquivadas ({arquivadas.length})
          </button>
          {mostrarArquivadas && (
            <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white opacity-70">
              {arquivadas.map((c) => (
                <ItemConta key={c.id} conta={c} saldo={saldo(c.id)} casal={Boolean(household)} onClick={() => setModal({ tipo: 'conta', conta: c })} />
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-6">
        <BotaoEmDesenvolvimento icone={Landmark} rotulo="Conectar banco (Open Finance)" />
      </div>

      <Modal
        aberto={modal !== null}
        onFechar={() => setModal(null)}
        titulo={modal?.tipo === 'transferencia' ? 'Transferir entre contas' : modal?.conta ? 'Editar conta' : 'Nova conta'}
      >
        {modal?.tipo === 'conta' && <FormConta key={modal.conta?.id ?? 'nova'} conta={modal.conta} onConcluir={() => setModal(null)} />}
        {modal?.tipo === 'transferencia' && <FormTransferencia contas={ativas} saldo={saldo} onConcluir={() => setModal(null)} />}
      </Modal>
    </>
  )
}

function ItemConta({ conta, saldo, casal, onClick }: { conta: Conta; saldo: number; casal: boolean; onClick: () => void }) {
  return (
    <li>
      <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
            {conta.nome}
            {casal && conta.escopo === 'casal' && <Home className="size-3.5 text-slate-500" aria-label="Do casal" />}
          </span>
          <span className="text-xs text-slate-500">{TIPOS_CONTA.find((t) => t.valor === conta.tipo)?.rotulo}</span>
        </span>
        <span className={cn('text-sm font-semibold tabular-nums', saldo < 0 ? 'text-red-600' : 'text-slate-900')}>
          {formatarBRL(saldo)}
        </span>
      </button>
    </li>
  )
}

function FormConta({ conta, onConcluir }: { conta?: Conta; onConcluir: () => void }) {
  const { household } = useAuth()
  const salvar = useSalvarConta()
  const excluir = useExcluirConta()
  const [erro, setErro] = useState<string | null>(null)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const [d, setD] = useState<DadosConta>({
    nome: conta?.nome ?? '',
    tipo: conta?.tipo ?? 'corrente',
    escopo: conta?.escopo ?? 'individual',
    saldo_inicial_cents: conta?.saldo_inicial_cents ?? 0,
    arquivada: conta?.arquivada ?? false,
  })
  const set = <K extends keyof DadosConta>(k: K, v: DadosConta[K]) => setD((a) => ({ ...a, [k]: v }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (d.nome.trim().length < 2) return setErro('Informe o nome da conta.')
    try {
      await salvar.mutateAsync({ id: conta?.id, dados: { ...d, nome: d.nome.trim() } })
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
      <Input label="Nome" placeholder="Ex.: Nubank Hugo" value={d.nome} onChange={(e) => set('nome', e.target.value)} />
      <Select label="Tipo" value={d.tipo} onChange={(e) => set('tipo', e.target.value as TipoConta)}>
        {TIPOS_CONTA.map((t) => (
          <option key={t.valor} value={t.valor}>
            {t.rotulo}
          </option>
        ))}
      </Select>
      <MoneyInput
        label="Saldo inicial"
        valor={d.saldo_inicial_cents}
        onChange={(v) => set('saldo_inicial_cents', v)}
        ajuda="Quanto havia na conta antes do primeiro lançamento registrado no app."
      />
      {household && (
        <Escolha<Escopo>
          legenda="De quem é a conta?"
          valor={d.escopo}
          onChange={(v) => set('escopo', v)}
          opcoes={[
            { valor: 'individual', titulo: 'Minha', descricao: 'Só eu vejo o saldo.' },
            { valor: 'casal', titulo: 'Do casal', descricao: 'Ex.: conta conjunta ou reserva de emergência.' },
          ]}
        />
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
          Os lançamentos desta conta serão mantidos, mas ficarão sem conta. Prefira arquivar se a conta tiver histórico.
        </Aviso>
      )}
      <div className="flex gap-3">
        {conta && (
          <Button
            type="button"
            variante={confirmarExclusao ? 'perigo' : 'secundario'}
            carregando={excluir.isPending}
            onClick={() => (confirmarExclusao ? onExcluir() : setConfirmarExclusao(true))}
            aria-label="Excluir conta"
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
            {c.nome}
          </option>
        ))}
      </Select>
      <Select label="Para" value={destino} onChange={(e) => setDestino(e.target.value)}>
        {contas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
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
