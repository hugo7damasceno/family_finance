import { formatarBRLSempre } from '@/lib/money'
import type { Cartao } from '@/types/database'
import type { MovimentoTerceiro } from './api'

export interface Pendencia extends MovimentoTerceiro {
  /** Quando o dinheiro deveria voltar: vencimento da fatura (cartão) ou a data da compra. */
  vencimento: string
  vencida: boolean
}

export interface SituacaoTerceiro {
  pendentes: Pendencia[]
  devendo: number
  vencido: number
  /** Parte do saldo devedor que vence nos próximos 30 dias. */
  proximos30: number
  reembolsos: MovimentoTerceiro[]
  recebido: number
}

const dd = (n: number) => String(n).padStart(2, '0')

/** Data de vencimento de uma compra de terceiro. */
export function vencimentoDe(m: Pick<MovimentoTerceiro, 'fatura_mes' | 'cartao_id' | 'data'>, cartoes: Map<string, Cartao>): string {
  const cartao = m.cartao_id ? cartoes.get(m.cartao_id) : undefined
  if (!cartao || !m.fatura_mes) return m.data
  const [a, mes] = m.fatura_mes.split('-').map(Number)
  const ultimo = new Date(a, mes, 0).getDate()
  return `${a}-${dd(mes)}-${dd(Math.min(cartao.dia_vencimento, ultimo))}`
}

function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const r = new Date(a, m - 1, d + dias)
  return `${r.getFullYear()}-${dd(r.getMonth() + 1)}-${dd(r.getDate())}`
}

export function situacaoPorTerceiro(
  movs: MovimentoTerceiro[],
  cartoes: Map<string, Cartao>,
  hoje: string,
): Map<string, SituacaoTerceiro> {
  const limite30 = somarDias(hoje, 30)
  const porPessoa = new Map<string, SituacaoTerceiro>()
  const de = (id: string) => {
    let s = porPessoa.get(id)
    if (!s) {
      s = { pendentes: [], devendo: 0, vencido: 0, proximos30: 0, reembolsos: [], recebido: 0 }
      porPessoa.set(id, s)
    }
    return s
  }
  for (const m of movs) {
    if (!m.terceiro_id) continue
    const s = de(m.terceiro_id)
    if (m.tipo === 'receita') {
      s.reembolsos.push(m)
      s.recebido += m.valor_cents
    } else if (m.tipo === 'despesa' && !m.reembolso_id) {
      const vencimento = vencimentoDe(m, cartoes)
      const vencida = vencimento < hoje
      s.pendentes.push({ ...m, vencimento, vencida })
      s.devendo += m.valor_cents
      if (vencida) s.vencido += m.valor_cents
      else if (vencimento <= limite30) s.proximos30 += m.valor_cents
    }
  }
  for (const s of porPessoa.values()) {
    s.pendentes.sort((a, b) => a.vencimento.localeCompare(b.vencimento))
    s.reembolsos.sort((a, b) => b.data.localeCompare(a.data))
  }
  return porPessoa
}

const dataCurta = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(a, m - 1, d))
}

/**
 * Mensagem de cobrança amigável. Usa sempre o valor real (mesmo com valores
 * ocultos na tela), porque é o texto que será enviado à pessoa.
 */
export function mensagemCobranca(nome: string, pendencias: Pendencia[], hoje: string): string {
  const primeiro = nome.split(' ')[0]
  const vencidas = pendencias.filter((p) => p.vencida)
  // Cobra o que já venceu e o que vence nos próximos 30 dias; o resto fica para depois.
  const limite = somarDias(hoje, 30)
  const itens = pendencias.filter((p) => p.vencida || p.vencimento <= limite)
  const lista = itens.length > 0 ? itens : pendencias.slice(0, 1)
  const total = lista.reduce((s, p) => s + p.valor_cents, 0)
  const linhas = lista.map((p) => `• ${p.descricao}: ${formatarBRLSempre(p.valor_cents)} (venc. ${dataCurta(p.vencimento)})`)
  return [
    `Oi, ${primeiro}! Tudo bem?`,
    vencidas.length === 0
      ? 'Passando para lembrar das próximas parcelas das compras no meu cartão:'
      : vencidas.length === lista.length
        ? 'Passando para lembrar das compras no meu cartão que já venceram:'
        : 'Passando para lembrar das compras no meu cartão (as vencidas e as que vencem nos próximos dias):',
    ...linhas,
    `Total: ${formatarBRLSempre(total)}`,
    'Obrigado!',
  ].join('\n')
}

/** Link do WhatsApp com a mensagem pronta. Sem telefone, abre a escolha de contato. */
export function linkWhatsApp(telefone: string | null, mensagem: string): string {
  let numero = (telefone ?? '').replace(/\D/g, '')
  // Número brasileiro sem DDI (10 ou 11 dígitos): acrescenta 55.
  if (numero.length === 10 || numero.length === 11) numero = `55${numero}`
  const texto = encodeURIComponent(mensagem)
  return numero ? `https://wa.me/${numero}?text=${texto}` : `https://wa.me/?text=${texto}`
}
