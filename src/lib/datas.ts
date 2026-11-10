// Datas trafegam como texto ISO local: 'AAAA-MM-DD' (dia) e 'AAAA-MM' (mês).

const doisDigitos = (n: number) => String(n).padStart(2, '0')

export function hojeISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`
}

export function mesAtualISO(): string {
  return hojeISO().slice(0, 7)
}

export function adicionarMeses(mes: string, qtd: number): string {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(a, m - 1 + qtd, 1)
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}`
}

/** Primeiro e último dia do mês ('AAAA-MM-DD'). */
export function limitesDoMes(mes: string): { inicio: string; fim: string } {
  const [a, m] = mes.split('-').map(Number)
  const ultimo = new Date(a, m, 0).getDate()
  return { inicio: `${mes}-01`, fim: `${mes}-${doisDigitos(ultimo)}` }
}

export function nomeDoMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  const nome = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(a, m - 1, 1))
  return nome.charAt(0).toUpperCase() + nome.slice(1)
}

/** Ex.: "qua., 5 de nov." */
export function rotuloDoDia(dia: string): string {
  const [a, m, d] = dia.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).format(
    new Date(a, m - 1, d),
  )
}
