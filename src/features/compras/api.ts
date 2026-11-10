import { useEffect, useState } from 'react'
import {
  onlineManager,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { useAuth } from '@/auth/auth-context'
import { invalidarFinanceiro } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import type { Escopo } from '@/types/database'
import type { Setor, Unidade } from './itens'

export interface ListaCompras {
  id: string
  owner_id: string
  household_id: string | null
  escopo: Escopo
  nome: string
  icone: string | null
  arquivada: boolean
  created_at: string
}

export interface ItemLista {
  id: string
  lista_id: string
  nome: string
  quantidade: number
  unidade: Unidade
  setor: Setor
  preco_cents: number | null
  comprado: boolean
  observacao: string | null
  created_at: string
}

export interface ListaComResumo extends ListaCompras {
  total_itens: number
  comprados: number
}

// ---------------------------------------------------------------------
// Cópia local (localStorage): a lista abre mesmo sem sinal no mercado.
// ---------------------------------------------------------------------
const CHAVE_CACHE = 'ff:compras:'

function lerCache<T>(chave: string): T | undefined {
  try {
    const bruto = localStorage.getItem(CHAVE_CACHE + chave)
    return bruto ? (JSON.parse(bruto) as T) : undefined
  } catch {
    return undefined
  }
}

function gravarCache(chave: string, dados: unknown) {
  try {
    localStorage.setItem(CHAVE_CACHE + chave, JSON.stringify(dados))
  } catch {
    // Sem espaço ou modo privado: segue sem cópia local.
  }
}

const chaveListas = ['compras', 'listas'] as const
const chaveItens = (listaId: string) => ['compras', 'itens', listaId] as const

export function useListas() {
  const query = useQuery({
    queryKey: chaveListas,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listas_compras')
        .select('*, itens:itens_lista(comprado)')
        .order('created_at')
      if (error) throw error
      return (data as (ListaCompras & { itens: { comprado: boolean }[] })[]).map(({ itens, ...l }) => ({
        ...l,
        total_itens: itens.length,
        comprados: itens.filter((i) => i.comprado).length,
      })) as ListaComResumo[]
    },
    initialData: () => lerCache<ListaComResumo[]>('listas'),
    initialDataUpdatedAt: 0, // a cópia local é sempre "velha": busca de novo quando houver rede
  })
  useEffect(() => {
    if (query.data && query.isFetchedAfterMount) gravarCache('listas', query.data)
  }, [query.data, query.isFetchedAfterMount])
  return query
}

export function useItens(listaId: string) {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: chaveItens(listaId),
    queryFn: async () => {
      const { data, error } = await supabase.from('itens_lista').select('*').eq('lista_id', listaId).order('created_at')
      if (error) throw error
      return data as ItemLista[]
    },
    initialData: () => lerCache<ItemLista[]>(`itens:${listaId}`),
    initialDataUpdatedAt: 0,
  })
  // Grava qualquer mudança (inclusive as otimistas feitas sem rede).
  useEffect(() => {
    if (query.data) gravarCache(`itens:${listaId}`, query.data)
  }, [query.data, listaId])

  // Tempo real: alterações feitas pelo cônjuge aparecem sem recarregar.
  useEffect(() => {
    const canal = supabase
      .channel(`itens-lista-${listaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'itens_lista', filter: `lista_id=eq.${listaId}` },
        () => {
          // Com alterações locais ainda pendentes, espera para não sobrescrever o que o usuário acabou de fazer.
          if (qc.isMutating({ mutationKey: ['compras'] }) === 0) {
            void qc.invalidateQueries({ queryKey: chaveItens(listaId) })
            void qc.invalidateQueries({ queryKey: chaveListas })
          }
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(canal)
    }
  }, [listaId, qc])

  return query
}

/** Aplica uma alteração otimista na lista de itens e devolve como desfazer. */
async function otimista(qc: QueryClient, listaId: string, alterar: (itens: ItemLista[]) => ItemLista[]) {
  const chave = chaveItens(listaId)
  await qc.cancelQueries({ queryKey: chave })
  const anterior = qc.getQueryData<ItemLista[]>(chave)
  qc.setQueryData<ItemLista[]>(chave, (itens) => alterar(itens ?? []))
  return { anterior }
}

/**
 * Mutações de itens: atualizam a tela na hora e, sem internet, ficam em
 * espera e são enviadas quando a conexão voltar (comportamento do TanStack Query).
 */
function useMutacaoItens<V>(
  listaId: string,
  enviar: (v: V) => PromiseLike<{ error: unknown }>,
  alterar: (itens: ItemLista[], v: V) => ItemLista[],
) {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['compras', listaId],
    mutationFn: async (v: V) => {
      const { error } = await enviar(v)
      if (error) throw error
    },
    onMutate: (v) => otimista(qc, listaId, (itens) => alterar(itens, v)),
    onError: (_e, _v, ctx) => {
      if (ctx?.anterior) qc.setQueryData(chaveItens(listaId), ctx.anterior)
    },
    onSettled: () => {
      if (qc.isMutating({ mutationKey: ['compras', listaId] }) <= 1) {
        void qc.invalidateQueries({ queryKey: chaveItens(listaId) })
        void qc.invalidateQueries({ queryKey: chaveListas })
      }
    },
  })
}

export type NovoItem = Pick<ItemLista, 'nome' | 'quantidade' | 'unidade' | 'setor' | 'preco_cents' | 'observacao'>

export function useAdicionarItem(listaId: string) {
  return useMutacaoItens<NovoItem & { id: string }>(
    listaId,
    (v) => supabase.from('itens_lista').insert({ ...v, lista_id: listaId }),
    (itens, v) => [...itens, { ...v, lista_id: listaId, comprado: false, created_at: new Date().toISOString() }],
  )
}

export function useAtualizarItem(listaId: string) {
  return useMutacaoItens<{ id: string; dados: Partial<NovoItem & { comprado: boolean }> }>(
    listaId,
    (v) => supabase.from('itens_lista').update(v.dados).eq('id', v.id),
    (itens, v) => itens.map((i) => (i.id === v.id ? { ...i, ...v.dados } : i)),
  )
}

export function useExcluirItem(listaId: string) {
  return useMutacaoItens<string>(
    listaId,
    (id) => supabase.from('itens_lista').delete().eq('id', id),
    (itens, id) => itens.filter((i) => i.id !== id),
  )
}

export function useDesmarcarTodos(listaId: string) {
  return useMutacaoItens<void>(
    listaId,
    () => supabase.from('itens_lista').update({ comprado: false }).eq('lista_id', listaId).eq('comprado', true),
    (itens) => itens.map((i) => ({ ...i, comprado: false })),
  )
}

export function useSalvarLista() {
  const qc = useQueryClient()
  const { user, profile } = useAuth()
  return useMutation({
    mutationFn: async ({ id, dados }: { id?: string; dados: Pick<ListaCompras, 'nome' | 'icone' | 'escopo'> }) => {
      const registro = { ...dados, household_id: profile?.household_id ?? null }
      const { data, error } = id
        ? await supabase.from('listas_compras').update(registro).eq('id', id).select('id').single()
        : await supabase
            .from('listas_compras')
            .insert({ ...registro, owner_id: user!.id })
            .select('id')
            .single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaveListas }),
  })
}

export function useExcluirLista() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('listas_compras').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaveListas }),
  })
}

export interface DadosFinalizacao {
  lista: ListaCompras
  valor_cents: number
  data: string
  categoria_id: string | null
  conta_id: string | null
  cartao_id: string | null
  escopo: Escopo
  /** O que fazer com os itens comprados: desmarcar (lista recorrente) ou remover (lista avulsa). */
  depois: 'desmarcar' | 'remover'
}

/** Registra a compra como despesa e prepara a lista para a próxima vez. */
export function useFinalizarCompra() {
  const qc = useQueryClient()
  const { user, profile } = useAuth()
  return useMutation({
    mutationFn: async (d: DadosFinalizacao) => {
      const { error } = await supabase.from('lancamentos').insert({
        owner_id: user!.id,
        household_id: profile?.household_id ?? null,
        escopo: d.escopo,
        tipo: 'despesa',
        descricao: d.lista.nome,
        valor_cents: d.valor_cents,
        data: d.data,
        categoria_id: d.categoria_id,
        conta_id: d.cartao_id ? null : d.conta_id,
        cartao_id: d.cartao_id,
        // No cartão, só fica paga quando a fatura for paga.
        pago: !d.cartao_id,
        lista_compra_id: d.lista.id,
      })
      if (error) throw error
      const itens = supabase.from('itens_lista')
      const { error: e2 } =
        d.depois === 'remover'
          ? await itens.delete().eq('lista_id', d.lista.id).eq('comprado', true)
          : await itens.update({ comprado: false }).eq('lista_id', d.lista.id).eq('comprado', true)
      if (e2) throw e2
    },
    onSuccess: (_r, d) => {
      void qc.invalidateQueries({ queryKey: chaveItens(d.lista.id) })
      void qc.invalidateQueries({ queryKey: chaveListas })
      void qc.invalidateQueries({ queryKey: ['compras', 'historico', d.lista.id] })
      void invalidarFinanceiro(qc)
    },
  })
}

/** Últimas compras finalizadas a partir de uma lista. */
export function useHistoricoCompras(listaId: string) {
  return useQuery({
    queryKey: ['compras', 'historico', listaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lancamentos')
        .select('id, data, valor_cents')
        .eq('lista_compra_id', listaId)
        .order('data', { ascending: false })
        .limit(6)
      if (error) throw error
      return data as { id: string; data: string; valor_cents: number }[]
    },
  })
}

/** Situação da conexão e quantas alterações esperam para ser enviadas. */
export function useSincronizacao() {
  const [online, setOnline] = useState(() => onlineManager.isOnline())
  useEffect(() => onlineManager.subscribe(setOnline), [])
  const pendentes = useMutationState({
    filters: { mutationKey: ['compras'], status: 'pending' },
    select: (m) => m.state.isPaused,
  })
  return { online, pendentes: pendentes.length, emEspera: pendentes.filter(Boolean).length }
}
