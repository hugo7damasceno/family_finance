import { formatarBRL } from '@/lib/money'
import type { SaudeMes, SaudeSituacao } from './api'

export type Status = 'bom' | 'atencao' | 'critico' | 'sem_dados'

export interface Indicador {
  chave: 'poupanca' | 'reserva' | 'parcelas' | 'fixas' | 'atrasos'
  titulo: string
  /** Valor formatado para exibição (ex.: "18%", "4,2 meses"). */
  valor: string
  /** 0–100 */
  pontos: number | null
  peso: number
  status: Status
  /** Referência mostrada ao usuário (ex.: "ideal: 6 meses ou mais"). */
  referencia: string
  /** Recomendação quando não está saudável. */
  dica?: string
}

export interface Saude {
  nota: number | null
  status: Status
  rotulo: string
  indicadores: Indicador[]
  /** Base de cálculo usada (para transparência). */
  base: { rendaMensal: number; custoMensal: number; meses: number; estimada: boolean }
}

/** Interpolação linear entre pontos (x crescente) → pontos 0–100. */
function escala(x: number, pontos: [number, number][]): number {
  if (x <= pontos[0][0]) return pontos[0][1]
  for (let i = 1; i < pontos.length; i++) {
    const [x0, y0] = pontos[i - 1]
    const [x1, y1] = pontos[i]
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)
  }
  return pontos[pontos.length - 1][1]
}

const statusDe = (p: number | null): Status => (p === null ? 'sem_dados' : p >= 80 ? 'bom' : p >= 50 ? 'atencao' : 'critico')
const pct = (v: number) => `${Math.round(v * 100)}%`
const meses = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${v === 1 ? 'mês' : 'meses'}`

/**
 * Nota de 0 a 100 a partir de 5 indicadores (pesos em documentação/decisoes.md).
 * Base: média dos últimos 3 meses fechados com receita; sem histórico, usa o mês atual
 * (ou a renda do cadastro, se ainda não houver receita lançada).
 */
export function calcularSaude(dados: { meses: SaudeMes[]; situacao: SaudeSituacao }, mesAtual: string): Saude {
  const atual = dados.meses.find((m) => m.mes.startsWith(mesAtual))
  const fechados = dados.meses.filter((m) => !m.mes.startsWith(mesAtual) && m.receitas_cents > 0)
  const base = fechados.length > 0 ? fechados : atual ? [atual] : []
  const n = Math.max(1, base.length)
  const media = (f: (m: SaudeMes) => number) => base.reduce((s, m) => s + f(m), 0) / n

  let rendaMensal = media((m) => m.receitas_cents - m.contribuicoes_cents)
  const estimada = rendaMensal <= 0
  if (estimada) rendaMensal = atual?.renda_cadastro_cents ?? 0
  const custoMensal = media((m) => m.despesas_cents)
  const parcelasMes = atual?.parcelas_cents ?? 0
  const fixasMes = atual?.fixas_cents ?? 0
  const { reserva_cents: reserva, atrasadas_qtd: atrasadas, atrasadas_cents } = dados.situacao

  const indicadores: Indicador[] = []

  // 1. Taxa de poupança: quanto da renda sobra depois das despesas.
  {
    const taxa = rendaMensal > 0 && custoMensal > 0 ? (rendaMensal - custoMensal) / rendaMensal : null
    const p = taxa === null ? null : escala(taxa, [[0, 0], [0.1, 60], [0.2, 100]])
    indicadores.push({
      chave: 'poupanca',
      titulo: 'Taxa de poupança',
      valor: taxa === null ? '—' : pct(taxa),
      pontos: p,
      peso: 25,
      status: statusDe(p),
      referencia: 'ideal: guardar 20% ou mais da renda',
      dica:
        taxa === null
          ? 'Lance receitas e despesas por um mês para calcular.'
          : taxa < 0.2
            ? `Para chegar a 20%, as despesas precisariam caber em ${formatarBRL(Math.round(rendaMensal * 0.8))} por mês.`
            : undefined,
    })
  }

  // 2. Reserva de emergência em meses de custo de vida.
  {
    const qtd = custoMensal > 0 ? reserva / custoMensal : null
    const p = qtd === null ? null : escala(qtd, [[0, 0], [3, 60], [6, 100]])
    const falta = Math.max(0, Math.round(custoMensal * 6 - reserva))
    indicadores.push({
      chave: 'reserva',
      titulo: 'Reserva de emergência',
      valor: qtd === null ? (reserva > 0 ? formatarBRL(reserva) : '—') : meses(qtd),
      pontos: p,
      peso: 25,
      status: statusDe(p),
      referencia: 'ideal: 6 meses de custo de vida ou mais',
      dica:
        qtd === null
          ? 'Crie um cofrinho do tipo "Reserva de emergência" e lance suas despesas para medir.'
          : falta > 0
            ? `Faltam ${formatarBRL(falta)} para 6 meses de reserva.`
            : undefined,
    })
  }

  // 3. Renda comprometida com parcelas.
  {
    const taxa = rendaMensal > 0 ? parcelasMes / rendaMensal : null
    const p = taxa === null ? null : escala(taxa, [[0.1, 100], [0.3, 40], [0.5, 0]])
    indicadores.push({
      chave: 'parcelas',
      titulo: 'Renda comprometida com parcelas',
      valor: taxa === null ? '—' : pct(taxa),
      pontos: p,
      peso: 20,
      status: statusDe(p),
      referencia: 'ideal: até 10%; limite recomendado: 30%',
      dica: taxa !== null && taxa > 0.1 ? 'Evite novas compras parceladas até as atuais terminarem.' : undefined,
    })
  }

  // 4. Despesas fixas sobre a renda (regra 50/30/20: necessidades até 50%).
  {
    const taxa = rendaMensal > 0 ? fixasMes / rendaMensal : null
    const p = taxa === null ? null : escala(taxa, [[0.5, 100], [0.7, 50], [0.9, 0]])
    indicadores.push({
      chave: 'fixas',
      titulo: 'Despesas fixas',
      valor: taxa === null ? '—' : pct(taxa),
      pontos: p,
      peso: 15,
      status: statusDe(p),
      referencia: 'ideal: até 50% da renda',
      dica: taxa !== null && taxa > 0.5 ? 'Revise assinaturas, planos e contas fixas que podem ser reduzidos.' : undefined,
    })
  }

  // 5. Contas em atraso.
  {
    const p = escala(atrasadas, [[0, 100], [1, 40], [3, 0]])
    indicadores.push({
      chave: 'atrasos',
      titulo: 'Contas em atraso',
      valor: atrasadas === 0 ? 'nenhuma' : `${atrasadas} (${formatarBRL(atrasadas_cents)})`,
      pontos: p,
      peso: 15,
      status: statusDe(p),
      referencia: 'ideal: nenhuma',
      dica: atrasadas > 0 ? 'Quite as contas vencidas primeiro: juros e multas pesam mais que qualquer investimento rende.' : undefined,
    })
  }

  // Sem receitas e despesas lançadas não há como avaliar: "0% de parcelas" e
  // "nenhum atraso" não significam saúde quando ainda não existe movimentação.
  const temMovimentacao = !estimada && custoMensal > 0
  const validos = indicadores.filter((i) => i.pontos !== null)
  const pesoTotal = validos.reduce((s, i) => s + i.peso, 0)
  const nota =
    temMovimentacao && pesoTotal > 0 ? Math.round(validos.reduce((s, i) => s + i.pontos! * i.peso, 0) / pesoTotal) : null
  const status = statusDe(nota)
  const rotulo =
    nota === null ? 'Sem dados suficientes' : nota >= 80 ? 'Saudável' : nota >= 60 ? 'Estável' : nota >= 40 ? 'Atenção' : 'Crítica'

  return { nota, status, rotulo, indicadores, base: { rendaMensal, custoMensal, meses: base.length, estimada } }
}
