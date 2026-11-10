import { hojeISO } from '@/lib/datas'
import type { Conta } from '@/types/database'

export interface ProgressoCofrinho {
  /** 0–100 (limitado), ou null se não há meta. */
  pct: number | null
  /** Quanto falta para a meta (0 se já atingiu). */
  falta: number
  atingida: boolean
  /** Meses até a data-alvo (inclui o mês atual), ou null sem data. */
  mesesRestantes: number | null
  /** Quanto guardar por mês para chegar na data, ou null sem data/meta. */
  porMes: number | null
  /** A data-alvo já passou e a meta não foi atingida. */
  atrasado: boolean
}

export function progressoCofrinho(c: Pick<Conta, 'meta_cents' | 'data_meta'>, saldo: number, hoje = hojeISO()): ProgressoCofrinho {
  const meta = c.meta_cents ?? null
  const falta = meta ? Math.max(0, meta - saldo) : 0
  const atingida = meta !== null && saldo >= meta
  let mesesRestantes: number | null = null
  if (c.data_meta) {
    const [ah, mh] = hoje.split('-').map(Number)
    const [am, mm] = c.data_meta.split('-').map(Number)
    mesesRestantes = (am - ah) * 12 + (mm - mh) + 1
  }
  const atrasado = Boolean(c.data_meta && c.data_meta < hoje && !atingida)
  const porMes =
    meta && mesesRestantes !== null && !atingida ? Math.ceil(falta / Math.max(1, mesesRestantes)) : null
  return {
    pct: meta ? Math.min(100, Math.max(0, (saldo / meta) * 100)) : null,
    falta,
    atingida,
    mesesRestantes,
    porMes,
    atrasado,
  }
}
