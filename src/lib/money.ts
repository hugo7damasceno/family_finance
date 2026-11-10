// Todos os valores monetários circulam no app como CENTAVOS inteiros.
// Nunca usar float para dinheiro.

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

// Preferência "ocultar valores" (ícone do olho). Controlada por PrivacidadeProvider.
let ocultos = false
export const MASCARA = 'R$ •••••'

export function definirValoresOcultos(valor: boolean) {
  ocultos = valor
}

export function valoresOcultos(): boolean {
  return ocultos
}

/** Valor para exibição. Respeita a opção de ocultar valores. */
export function formatarBRL(cents: number): string {
  return ocultos ? MASCARA : brl.format(cents / 100)
}

/** Valor sempre visível (campos de digitação). */
export function formatarBRLSempre(cents: number): string {
  return brl.format(cents / 100)
}

/** Converte qualquer texto digitado ("1.234,56", "R$ 10") em centavos. */
export function centavosDeTexto(texto: string): number {
  const digitos = texto.replace(/\D/g, '')
  return digitos ? Number.parseInt(digitos, 10) : 0
}

/** Aplica um percentual sobre um valor em centavos, arredondando para o centavo. */
export function percentual(cents: number, pct: number): number {
  return Math.round((cents * pct) / 100)
}
