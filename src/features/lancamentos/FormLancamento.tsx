import { useState } from 'react'
import { Repeat, Trash2 } from 'lucide-react'
import { useAuth } from '@/auth/auth-context'
import { Button } from '@/components/ui/Button'
import { Aviso } from '@/components/ui/Card'
import { Escolha } from '@/components/ui/Escolha'
import { Input, MoneyInput, Select } from '@/components/ui/Field'
import { mesDaFatura, useCartoes } from '@/features/cartoes/api'
import { useContasAtivas } from '@/features/contas/api'
import { useCriarParcelamento } from '@/features/parcelamentos/api'
import { criarRecorrenciaDoLancamento } from '@/features/recorrencias/api'
import { cn } from '@/lib/cn'
import { hojeISO, nomeDoMes } from '@/lib/datas'
import { formatarBRL, percentual } from '@/lib/money'
import { mensagemDeErro } from '@/lib/queries'
import { traduzirErro } from '@/lib/supabase'
import type { Escopo, Lancamento, OrigemReceita } from '@/types/database'
import {
  ORIGENS_RECEITA,
  useCategorias,
  useExcluirLancamento,
  useSalvarLancamento,
  type DadosLancamento,
} from './api'

interface Props {
  lancamento?: Lancamento
  /** Valores iniciais para um novo lançamento (ex.: atalho "Lançar 13º"). */
  inicial?: Partial<DadosLancamento>
  onConcluir: () => void
}

/** Valor do campo "Pago com": 'conta:<id>', 'cartao:<id>' ou '' (não informado). */
function codificarOrigem(d: Pick<DadosLancamento, 'conta_id' | 'cartao_id'>): string {
  if (d.cartao_id) return `cartao:${d.cartao_id}`
  if (d.conta_id) return `conta:${d.conta_id}`
  return ''
}

export function FormLancamento({ lancamento, inicial, onConcluir }: Props) {
  const { user, profile, household } = useAuth()
  const { data: categorias = [] } = useCategorias()
  const { data: contas = [] } = useContasAtivas()
  const { data: cartoes = [] } = useCartoes()
  const salvar = useSalvarLancamento()
  const criarParcelamento = useCriarParcelamento()
  const excluir = useExcluirLancamento()
  const [erro, setErro] = useState<string | null>(null)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const [numParcelas, setNumParcelas] = useState(1)
  const [repetir, setRepetir] = useState(false)
  const [salvandoRecorrencia, setSalvandoRecorrencia] = useState(false)

  const gerado = Boolean(lancamento?.gerado_de_id)
  const parcela = Boolean(lancamento?.parcelamento_id)
  const deOutroMembro = Boolean(lancamento && lancamento.owner_id !== user?.id)

  const [d, setD] = useState<DadosLancamento>(() => ({
    tipo: lancamento?.tipo === 'receita' ? 'receita' : (inicial?.tipo ?? 'despesa'),
    origem_receita: lancamento?.origem_receita ?? inicial?.origem_receita ?? 'salario',
    descricao: lancamento?.descricao ?? inicial?.descricao ?? '',
    valor_cents: lancamento?.valor_cents ?? inicial?.valor_cents ?? 0,
    data: lancamento?.data ?? hojeISO(),
    categoria_id: lancamento?.categoria_id ?? null,
    escopo: lancamento?.escopo ?? 'individual',
    pago: lancamento?.pago ?? true,
    observacao: lancamento?.observacao ?? null,
    conta_id: lancamento?.conta_id ?? null,
    cartao_id: lancamento?.cartao_id ?? inicial?.cartao_id ?? null,
  }))
  const set = <K extends keyof DadosLancamento>(k: K, v: DadosLancamento[K]) => setD((a) => ({ ...a, [k]: v }))

  const cartaoSelecionado = d.tipo === 'despesa' ? cartoes.find((c) => c.id === d.cartao_id) : undefined
  const ativos = cartoes.filter((c) => !c.arquivado || c.id === d.cartao_id)
  const parcelado = !lancamento && d.tipo === 'despesa' && numParcelas > 1

  const categoriasDoTipo = categorias.filter(
    (c) => c.tipo === d.tipo && !(d.tipo === 'despesa' && ['Dízimo', 'Oferta'].includes(c.nome) && !gerado),
  )

  function categoriaDaOrigem(origem: OrigemReceita): string | null {
    const nome = ORIGENS_RECEITA.find((o) => o.valor === origem)?.categoria
    return categorias.find((c) => c.owner_id === null && c.nome === nome)?.id ?? null
  }

  function escolherOrigem(valor: string) {
    const [tipo, id] = valor.split(':')
    setD((a) => ({
      ...a,
      conta_id: tipo === 'conta' ? id : null,
      cartao_id: tipo === 'cartao' ? id : null,
      // Compra no cartão só é "paga" quando a fatura for paga.
      pago: tipo === 'cartao' ? false : a.pago,
    }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!d.descricao.trim()) return setErro('Informe uma descrição.')
    if (d.valor_cents <= 0) return setErro('Informe um valor maior que zero.')
    if (d.tipo === 'despesa' && !d.categoria_id) return setErro('Escolha uma categoria.')
    if (parcelado && d.valor_cents < numParcelas) return setErro('Valor muito baixo para esse número de parcelas.')
    const dados: DadosLancamento = {
      ...d,
      descricao: d.descricao.trim(),
      observacao: d.observacao?.trim() || null,
      categoria_id: d.tipo === 'receita' ? categoriaDaOrigem(d.origem_receita!) : d.categoria_id,
      pago: cartaoSelecionado ? (lancamento?.pago ?? false) : d.pago,
    }
    try {
      if (parcelado) {
        await criarParcelamento.mutateAsync({
          descricao: dados.descricao,
          valor_total_cents: dados.valor_cents,
          num_parcelas: numParcelas,
          data_primeira: dados.data,
          categoria_id: dados.categoria_id,
          escopo: household ? dados.escopo : 'individual',
          cartao_id: dados.cartao_id,
          conta_id: dados.conta_id,
          pagas: 0,
        })
      } else if (repetir && !lancamento) {
        setSalvandoRecorrencia(true)
        const recorrenciaId = await criarRecorrenciaDoLancamento(
          {
            tipo: dados.tipo,
            origem_receita: dados.origem_receita,
            descricao: dados.descricao,
            valor_cents: dados.valor_cents,
            categoria_id: dados.categoria_id,
            conta_id: dados.conta_id,
            cartao_id: dados.cartao_id,
            escopo: household ? dados.escopo : 'individual',
            data: dados.data,
          },
          user!.id,
          profile?.household_id ?? null,
        )
        await salvar.mutateAsync({ dados: { ...dados, recorrencia_id: recorrenciaId } })
      } else {
        await salvar.mutateAsync({ id: lancamento?.id, dados })
      }
      onConcluir()
    } catch (err) {
      setErro(traduzirErro(mensagemDeErro(err)))
    } finally {
      setSalvandoRecorrencia(false)
    }
  }

  async function onExcluir() {
    if (!lancamento) return
    try {
      await excluir.mutateAsync(lancamento.id)
      onConcluir()
    } catch (err) {
      setErro(traduzirErro(mensagemDeErro(err)))
    }
  }

  const dizimoPrevisto =
    d.tipo === 'receita' && profile?.dizimista ? percentual(d.valor_cents, profile.percentual_dizimo) : 0
  const ofertaPrevista =
    d.tipo === 'receita' && profile?.ofertante ? percentual(d.valor_cents, profile.percentual_oferta) : 0

  if (lancamento?.tipo === 'transferencia') {
    const nome = (id: string | null) => contas.find((c) => c.id === id)?.nome ?? '—'
    return (
      <div className="flex flex-col gap-4">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">De</dt>
            <dd className="font-medium">{nome(lancamento.conta_id)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Para</dt>
            <dd className="font-medium">{nome(lancamento.conta_destino_id)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Valor</dt>
            <dd className="font-medium tabular-nums">{formatarBRL(lancamento.valor_cents)}</dd>
          </div>
        </dl>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <Button
          variante={confirmarExclusao ? 'perigo' : 'secundario'}
          carregando={excluir.isPending}
          onClick={() => (confirmarExclusao ? onExcluir() : setConfirmarExclusao(true))}
        >
          <Trash2 className="size-4" aria-hidden /> {confirmarExclusao ? 'Confirmar exclusão' : 'Excluir transferência'}
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {gerado && (
        <Aviso tipo="info">
          Gerado automaticamente a partir de uma receita. Para mudar o valor, edite a receita de origem.
        </Aviso>
      )}
      {lancamento?.recorrencia_id && (
        <Aviso tipo="info">
          Lançamento recorrente. As alterações valem só para este mês; para mudar os próximos, use “Recorrentes”.
        </Aviso>
      )}
      {parcela && (
        <Aviso tipo="info">
          Parcela de um parcelamento. As alterações valem só para esta parcela; para excluir todas, use a tela de
          Parcelamentos.
        </Aviso>
      )}

      {!lancamento && (
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Tipo">
          {(['despesa', 'receita'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={d.tipo === t}
              onClick={() => setD((a) => ({ ...a, tipo: t, categoria_id: null, cartao_id: null }))}
              className={cn(
                'h-10 rounded-lg text-sm font-semibold transition-colors',
                d.tipo === t
                  ? t === 'despesa'
                    ? 'bg-white text-red-600 shadow-sm'
                    : 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600',
              )}
            >
              {t === 'despesa' ? 'Despesa' : 'Receita'}
            </button>
          ))}
        </div>
      )}

      <MoneyInput
        label={d.tipo === 'receita' ? 'Valor líquido recebido' : parcelado ? 'Valor total da compra' : 'Valor'}
        valor={d.valor_cents}
        onChange={(v) => !gerado && set('valor_cents', v)}
        ajuda={parcelado ? `${numParcelas}x de ${formatarBRL(Math.floor(d.valor_cents / numParcelas))}` : undefined}
      />

      {d.tipo === 'receita' ? (
        <Select
          label="Origem"
          value={d.origem_receita ?? 'salario'}
          onChange={(e) => set('origem_receita', e.target.value as OrigemReceita)}
        >
          {ORIGENS_RECEITA.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </Select>
      ) : (
        <Select
          label="Categoria"
          value={d.categoria_id ?? ''}
          disabled={gerado}
          onChange={(e) => set('categoria_id', e.target.value || null)}
        >
          <option value="">Selecione…</option>
          {categoriasDoTipo.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>
      )}

      <Input
        label="Descrição"
        placeholder={d.tipo === 'receita' ? 'Ex.: Salário empresa X' : 'Ex.: Conta de luz'}
        value={d.descricao}
        disabled={gerado}
        onChange={(e) => set('descricao', e.target.value)}
      />

      <Input
        label={parcelado ? 'Data da compra (1ª parcela)' : 'Data'}
        type="date"
        value={d.data}
        disabled={gerado}
        onChange={(e) => set('data', e.target.value)}
      />

      <Select
        label={d.tipo === 'receita' ? 'Recebido em' : 'Pago com'}
        value={codificarOrigem(d)}
        disabled={parcela && Boolean(d.cartao_id)}
        onChange={(e) => escolherOrigem(e.target.value)}
        ajuda={
          contas.length === 0 && cartoes.length === 0
            ? 'Cadastre suas contas e cartões para acompanhar saldos e faturas.'
            : cartaoSelecionado
              ? `Entra na fatura de ${nomeDoMes(mesDaFatura(d.data, cartaoSelecionado.dia_fechamento, cartaoSelecionado.dia_vencimento)).toLowerCase()}.`
              : undefined
        }
      >
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
        {d.tipo === 'despesa' && ativos.length > 0 && (
          <optgroup label="Cartões de crédito">
            {ativos.map((c) => (
              <option key={c.id} value={`cartao:${c.id}`}>
                {c.nome}
              </option>
            ))}
          </optgroup>
        )}
      </Select>

      {!lancamento && d.tipo === 'despesa' && (
        <Select label="Parcelas" value={numParcelas} onChange={(e) => setNumParcelas(Number(e.target.value))}>
          {Array.from({ length: 48 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n === 1 ? 'À vista' : `${n}x`}
            </option>
          ))}
        </Select>
      )}

      {d.tipo === 'despesa' && household && !gerado && (
        <Escolha<Escopo>
          legenda="De quem é essa despesa?"
          valor={d.escopo}
          onChange={(v) => set('escopo', v)}
          opcoes={[
            { valor: 'individual', titulo: 'Minha', descricao: 'Sai da minha parte. Só eu vejo.' },
            { valor: 'casal', titulo: 'Da casa', descricao: 'Sai do fundo comum. O casal vê.' },
          ]}
        />
      )}

      {d.tipo === 'receita' && (dizimoPrevisto > 0 || ofertaPrevista > 0) && (
        <Aviso tipo="info">
          Serão separados automaticamente
          {dizimoPrevisto > 0 && (
            <>
              {' '}
              <strong>{formatarBRL(dizimoPrevisto)}</strong> de dízimo
            </>
          )}
          {dizimoPrevisto > 0 && ofertaPrevista > 0 && ' e'}
          {ofertaPrevista > 0 && (
            <>
              {' '}
              <strong>{formatarBRL(ofertaPrevista)}</strong> de oferta
            </>
          )}
          .
        </Aviso>
      )}

      {!lancamento && !parcelado && (
        <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            className="size-5 accent-brand-700"
            checked={repetir}
            onChange={(e) => setRepetir(e.target.checked)}
          />
          <Repeat className="size-4 text-slate-500" aria-hidden />
          Repetir todo mês (dia {Number(d.data.slice(8, 10))})
        </label>
      )}

      {!cartaoSelecionado && !parcelado && (
        <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            className="size-5 accent-brand-700"
            checked={d.pago}
            onChange={(e) => set('pago', e.target.checked)}
          />
          {d.tipo === 'receita' ? 'Já recebido' : 'Já pago'}
        </label>
      )}

      <Input
        label="Observação (opcional)"
        value={d.observacao ?? ''}
        onChange={(e) => set('observacao', e.target.value)}
      />

      {deOutroMembro && <p className="text-xs text-slate-500">Lançado pelo seu cônjuge.</p>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <div className="flex gap-3 pt-1">
        {lancamento && !gerado && !parcela && (
          <Button
            type="button"
            variante={confirmarExclusao ? 'perigo' : 'secundario'}
            carregando={excluir.isPending}
            onClick={() => (confirmarExclusao ? onExcluir() : setConfirmarExclusao(true))}
            aria-label="Excluir lançamento"
          >
            <Trash2 className="size-4" aria-hidden />
            {confirmarExclusao && 'Confirmar'}
          </Button>
        )}
        <Button type="submit" className="flex-1" carregando={salvar.isPending || criarParcelamento.isPending || salvandoRecorrencia}>
          {parcelado ? `Criar ${numParcelas} parcelas` : 'Salvar'}
        </Button>
      </div>
      {confirmarExclusao && d.tipo === 'receita' && (
        <p className="-mt-2 text-xs text-slate-500">O dízimo e a oferta gerados por esta receita também serão excluídos.</p>
      )}
    </form>
  )
}
