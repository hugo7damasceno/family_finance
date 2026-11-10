import { useState } from 'react'
import { ArrowLeft, Home, Pause, Plus, Repeat, Trash2 } from 'lucide-react'
import { useAuth } from '@/auth/auth-context'
import { Button } from '@/components/ui/Button'
import { Aviso } from '@/components/ui/Card'
import { Escolha } from '@/components/ui/Escolha'
import { Input, MoneyInput, Select } from '@/components/ui/Field'
import { useCartoes } from '@/features/cartoes/api'
import { useContasAtivas } from '@/features/contas/api'
import { ORIGENS_RECEITA, useCategorias } from '@/features/lancamentos/api'
import { cn } from '@/lib/cn'
import { mesAtualISO, nomeDoMes } from '@/lib/datas'
import { formatarBRL } from '@/lib/money'
import { mensagemDeErro } from '@/lib/queries'
import { traduzirErro } from '@/lib/supabase'
import type { Escopo, OrigemReceita, Recorrencia } from '@/types/database'
import { useExcluirRecorrencia, useRecorrencias, useSalvarRecorrencia, type DadosRecorrencia } from './api'

/** Lista de recorrências com edição no mesmo painel (usado dentro de um Modal). */
export function PainelRecorrencias() {
  const { household } = useAuth()
  const { data: recorrencias = [], isPending } = useRecorrencias()
  const [editando, setEditando] = useState<Recorrencia | 'nova' | null>(null)

  if (editando) {
    return (
      <div>
        <button
          onClick={() => setEditando(null)}
          className="mb-4 flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden /> Voltar para a lista
        </button>
        <FormRecorrencia
          key={editando === 'nova' ? 'nova' : editando.id}
          recorrencia={editando === 'nova' ? undefined : editando}
          onConcluir={() => setEditando(null)}
        />
      </div>
    )
  }

  const totalMensal = (tipo: 'receita' | 'despesa') =>
    recorrencias.filter((r) => r.ativa && r.tipo === tipo).reduce((s, r) => s + r.valor_cents, 0)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600">
        Todo mês o app cria automaticamente estes lançamentos como <strong>pendentes</strong>. Valores que variam (como a
        conta de luz) podem ser ajustados no lançamento do mês.
      </p>
      {recorrencias.length > 0 && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Despesas fixas/mês</p>
            <p className="font-semibold tabular-nums">{formatarBRL(totalMensal('despesa'))}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Receitas fixas/mês</p>
            <p className="font-semibold tabular-nums">{formatarBRL(totalMensal('receita'))}</p>
          </div>
        </div>
      )}
      {isPending ? null : recorrencias.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">
          Nenhuma recorrência cadastrada.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
          {recorrencias.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => setEditando(r)}
                className={cn('flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-slate-50', !r.ativa && 'opacity-60')}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                  {r.dia_do_mes}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-900">
                    {r.descricao}
                    {household && r.escopo === 'casal' && <Home className="size-3.5 shrink-0 text-slate-500" aria-label="Da casa" />}
                    {!r.ativa && <Pause className="size-3.5 shrink-0 text-slate-500" aria-label="Pausada" />}
                  </span>
                  <span className="text-xs text-slate-500">
                    Todo dia {r.dia_do_mes}
                    {r.fim && ` · até ${nomeDoMes(r.fim.slice(0, 7)).toLowerCase()}`}
                  </span>
                </span>
                <span
                  className={cn(
                    'text-sm font-semibold tabular-nums',
                    r.tipo === 'receita' ? 'text-emerald-700' : 'text-slate-900',
                  )}
                >
                  {r.tipo === 'receita' ? '+ ' : '− '}
                  {formatarBRL(r.valor_cents)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button onClick={() => setEditando('nova')}>
        <Plus className="size-4" aria-hidden /> Nova recorrência
      </Button>
    </div>
  )
}

export function FormRecorrencia({
  recorrencia,
  inicial,
  onConcluir,
}: {
  recorrencia?: Recorrencia
  inicial?: Partial<DadosRecorrencia>
  onConcluir: () => void
}) {
  const { household } = useAuth()
  const { data: categorias = [] } = useCategorias()
  const { data: contas = [] } = useContasAtivas()
  const { data: cartoes = [] } = useCartoes()
  const salvar = useSalvarRecorrencia()
  const excluir = useExcluirRecorrencia()
  const [erro, setErro] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const [apagarPendentes, setApagarPendentes] = useState(true)
  const [d, setD] = useState<DadosRecorrencia>(() => ({
    tipo: recorrencia?.tipo ?? inicial?.tipo ?? 'despesa',
    origem_receita: recorrencia?.origem_receita ?? inicial?.origem_receita ?? 'salario',
    descricao: recorrencia?.descricao ?? inicial?.descricao ?? '',
    valor_cents: recorrencia?.valor_cents ?? inicial?.valor_cents ?? 0,
    categoria_id: recorrencia?.categoria_id ?? inicial?.categoria_id ?? null,
    conta_id: recorrencia?.conta_id ?? inicial?.conta_id ?? null,
    cartao_id: recorrencia?.cartao_id ?? inicial?.cartao_id ?? null,
    escopo: recorrencia?.escopo ?? inicial?.escopo ?? 'individual',
    dia_do_mes: recorrencia?.dia_do_mes ?? inicial?.dia_do_mes ?? 10,
    inicio: recorrencia?.inicio ?? inicial?.inicio ?? `${mesAtualISO()}-01`,
    fim: recorrencia?.fim ?? null,
    ativa: recorrencia?.ativa ?? true,
  }))
  const set = <K extends keyof DadosRecorrencia>(k: K, v: DadosRecorrencia[K]) => setD((a) => ({ ...a, [k]: v }))

  function categoriaDaOrigem(origem: OrigemReceita) {
    const nome = ORIGENS_RECEITA.find((o) => o.valor === origem)?.categoria
    return categorias.find((c) => c.owner_id === null && c.nome === nome)?.id ?? null
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!d.descricao.trim()) return setErro('Informe uma descrição.')
    if (d.valor_cents <= 0) return setErro('Informe o valor.')
    if (d.tipo === 'despesa' && !d.categoria_id) return setErro('Escolha uma categoria.')
    if (d.fim && d.fim.slice(0, 7) < d.inicio.slice(0, 7)) return setErro('O mês final deve ser depois do inicial.')
    try {
      await salvar.mutateAsync({
        id: recorrencia?.id,
        dados: {
          ...d,
          descricao: d.descricao.trim(),
          categoria_id: d.tipo === 'receita' ? categoriaDaOrigem(d.origem_receita!) : d.categoria_id,
        },
      })
      onConcluir()
    } catch (err) {
      setErro(traduzirErro(mensagemDeErro(err)))
    }
  }

  async function onExcluir() {
    try {
      await excluir.mutateAsync({ id: recorrencia!.id, apagarPendentes })
      onConcluir()
    } catch (err) {
      setErro(traduzirErro(mensagemDeErro(err)))
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {!recorrencia && (
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Tipo">
          {(['despesa', 'receita'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={d.tipo === t}
              onClick={() => setD((a) => ({ ...a, tipo: t, categoria_id: null, cartao_id: null }))}
              className={cn('h-10 rounded-lg text-sm font-semibold', d.tipo === t ? 'bg-white shadow-sm' : 'text-slate-600')}
            >
              {t === 'despesa' ? 'Despesa' : 'Receita'}
            </button>
          ))}
        </div>
      )}
      <Input
        label="Descrição"
        placeholder={d.tipo === 'receita' ? 'Ex.: Salário' : 'Ex.: Aluguel, Netflix, Internet'}
        value={d.descricao}
        onChange={(e) => set('descricao', e.target.value)}
      />
      <MoneyInput
        label={d.tipo === 'receita' ? 'Valor líquido' : 'Valor (ou média, se variar)'}
        valor={d.valor_cents}
        onChange={(v) => set('valor_cents', v)}
      />
      {d.tipo === 'receita' ? (
        <Select label="Origem" value={d.origem_receita ?? 'salario'} onChange={(e) => set('origem_receita', e.target.value as OrigemReceita)}>
          {ORIGENS_RECEITA.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </Select>
      ) : (
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
      )}
      <Select
        label={d.tipo === 'receita' ? 'Dia do recebimento' : 'Dia do vencimento'}
        value={d.dia_do_mes}
        onChange={(e) => set('dia_do_mes', Number(e.target.value))}
        ajuda="Em meses mais curtos, usa o último dia do mês."
      >
        {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </Select>
      <Select
        label={d.tipo === 'receita' ? 'Recebido em' : 'Pago com'}
        value={d.cartao_id ? `cartao:${d.cartao_id}` : d.conta_id ? `conta:${d.conta_id}` : ''}
        onChange={(e) => {
          const [t, id] = e.target.value.split(':')
          setD((a) => ({ ...a, conta_id: t === 'conta' ? id : null, cartao_id: t === 'cartao' ? id : null }))
        }}
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
        {d.tipo === 'despesa' && cartoes.some((c) => !c.arquivado) && (
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
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="A partir de"
          type="month"
          value={d.inicio.slice(0, 7)}
          onChange={(e) => e.target.value && set('inicio', `${e.target.value}-01`)}
        />
        <Input
          label="Até (opcional)"
          type="month"
          value={d.fim?.slice(0, 7) ?? ''}
          onChange={(e) => set('fim', e.target.value ? `${e.target.value}-01` : null)}
        />
      </div>
      {d.tipo === 'despesa' && household && (
        <Escolha<Escopo>
          legenda="De quem é essa despesa?"
          valor={d.escopo}
          onChange={(v) => set('escopo', v)}
          opcoes={[
            { valor: 'individual', titulo: 'Minha', descricao: 'Sai da minha parte.' },
            { valor: 'casal', titulo: 'Da casa', descricao: 'Sai do fundo comum.' },
          ]}
        />
      )}
      {recorrencia && (
        <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
          <input type="checkbox" className="size-5 accent-brand-700" checked={d.ativa} onChange={(e) => set('ativa', e.target.checked)} />
          Ativa (desmarque para pausar)
        </label>
      )}
      {recorrencia && (
        <p className="text-xs text-slate-500">
          Alterações valem para os próximos meses. Lançamentos já criados não mudam.
        </p>
      )}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {confirmar && (
        <label className="flex items-center gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <input
            type="checkbox"
            className="size-5 accent-brand-700"
            checked={apagarPendentes}
            onChange={(e) => setApagarPendentes(e.target.checked)}
          />
          Excluir também os lançamentos pendentes já criados
        </label>
      )}
      <div className="flex gap-3">
        {recorrencia && (
          <Button
            type="button"
            variante={confirmar ? 'perigo' : 'secundario'}
            carregando={excluir.isPending}
            onClick={() => (confirmar ? onExcluir() : setConfirmar(true))}
            aria-label="Excluir recorrência"
          >
            <Trash2 className="size-4" aria-hidden />
            {confirmar && 'Confirmar'}
          </Button>
        )}
        <Button type="submit" className="flex-1" carregando={salvar.isPending}>
          <Repeat className="size-4" aria-hidden /> Salvar recorrência
        </Button>
      </div>
    </form>
  )
}
