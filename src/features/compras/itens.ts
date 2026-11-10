// Setores na ordem em que costumam aparecer no mercado: a lista agrupada
// segue o caminho pelos corredores.
export const SETORES = [
  { valor: 'hortifruti', rotulo: 'Hortifrúti', emoji: '🥬' },
  { valor: 'padaria', rotulo: 'Padaria', emoji: '🥖' },
  { valor: 'frios', rotulo: 'Frios e laticínios', emoji: '🧀' },
  { valor: 'acougue', rotulo: 'Açougue', emoji: '🥩' },
  { valor: 'mercearia', rotulo: 'Mercearia', emoji: '🥫' },
  { valor: 'bebidas', rotulo: 'Bebidas', emoji: '🧃' },
  { valor: 'congelados', rotulo: 'Congelados', emoji: '🧊' },
  { valor: 'limpeza', rotulo: 'Limpeza', emoji: '🧽' },
  { valor: 'higiene', rotulo: 'Higiene', emoji: '🧴' },
  { valor: 'pet', rotulo: 'Pet', emoji: '🐾' },
  { valor: 'outros', rotulo: 'Outros', emoji: '🛒' },
] as const

export type Setor = (typeof SETORES)[number]['valor']

export const UNIDADES = ['un', 'kg', 'g', 'L', 'ml', 'pct', 'cx', 'dz'] as const
export type Unidade = (typeof UNIDADES)[number]

export const ROTULO_UNIDADE: Record<Unidade, string> = {
  un: 'unidade',
  kg: 'kg',
  g: 'g',
  L: 'litro',
  ml: 'ml',
  pct: 'pacote',
  cx: 'caixa',
  dz: 'dúzia',
}

const PALAVRAS_SETOR: Record<Exclude<Setor, 'outros'>, string[]> = {
  hortifruti: [
    'alface',
    'tomate',
    'cebola',
    'alho',
    'batata',
    'cenoura',
    'banana',
    'maçã',
    'maca',
    'laranja',
    'limão',
    'limao',
    'mamão',
    'mamao',
    'uva',
    'abacaxi',
    'melancia',
    'pepino',
    'abobrinha',
    'chuchu',
    'couve',
    'repolho',
    'brócolis',
    'brocolis',
    'pimentão',
    'pimentao',
    'cheiro verde',
    'mandioca',
    'aipim',
    'fruta',
    'verdura',
    'legume',
    'ovo',
    'ovos',
  ],
  padaria: ['pão', 'pao', 'pães', 'bisnaga', 'bolo', 'torrada', 'rosca'],
  frios: [
    'queijo',
    'presunto',
    'mussarela',
    'muçarela',
    'iogurte',
    'manteiga',
    'margarina',
    'requeijão',
    'requeijao',
    'leite',
    'nata',
    'creme de leite',
    'peito de peru',
    'salame',
    'mortadela',
  ],
  acougue: [
    'carne',
    'frango',
    'peixe',
    'linguiça',
    'linguica',
    'costela',
    'patinho',
    'acém',
    'acem',
    'alcatra',
    'picanha',
    'moída',
    'moida',
    'bife',
    'filé',
    'file',
    'coxa',
    'sobrecoxa',
    'bacon',
    'calabresa',
  ],
  mercearia: [
    'arroz',
    'feijão',
    'feijao',
    'açúcar',
    'acucar',
    'sal',
    'café',
    'cafe',
    'óleo',
    'oleo',
    'azeite',
    'macarrão',
    'macarrao',
    'farinha',
    'fubá',
    'fuba',
    'molho',
    'extrato',
    'milho',
    'ervilha',
    'atum',
    'sardinha',
    'biscoito',
    'bolacha',
    'aveia',
    'granola',
    'tempero',
    'vinagre',
    'maionese',
    'ketchup',
    'mostarda',
    'achocolatado',
    'chá',
    'cha',
    'gelatina',
    'fermento',
    'leite condensado',
  ],
  bebidas: ['refrigerante', 'suco', 'água', 'agua', 'cerveja', 'vinho', 'refri', 'energético', 'energetico'],
  congelados: ['sorvete', 'pizza', 'lasanha', 'congelado', 'nuggets', 'hambúrguer', 'hamburguer', 'polpa', 'gelo'],
  limpeza: [
    'detergente',
    'sabão',
    'sabao',
    'amaciante',
    'água sanitária',
    'agua sanitaria',
    'desinfetante',
    'esponja',
    'saco de lixo',
    'lixo',
    'multiuso',
    'alvejante',
    'vassoura',
    'pano',
    'papel toalha',
    'limpa',
  ],
  higiene: [
    'sabonete',
    'shampoo',
    'xampu',
    'condicionador',
    'pasta de dente',
    'creme dental',
    'escova',
    'papel higiênico',
    'papel higienico',
    'desodorante',
    'absorvente',
    'fralda',
    'fio dental',
    'algodão',
    'algodao',
    'cotonete',
    'barbeador',
  ],
  pet: ['ração', 'racao', 'areia', 'petisco', 'pet'],
}

const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Palpite de setor pelo nome do item (o usuário pode trocar). */
export function adivinharSetor(nome: string): Setor {
  const n = ` ${normalizar(nome)} `
  // Termos mais longos primeiro: "leite condensado" (mercearia) antes de "leite" (frios).
  const termos = Object.entries(PALAVRAS_SETOR)
    .flatMap(([setor, palavras]) => palavras.map((p) => [normalizar(p), setor] as const))
    .sort((a, b) => b[0].length - a[0].length)
  for (const [termo, setor] of termos) {
    if (new RegExp(`[^a-z]${termo.replace(/ /g, '\\s+')}s?[^a-z]`).test(n)) return setor as Setor
  }
  return 'outros'
}

const SINONIMOS_UNIDADE: Record<string, Unidade> = {
  un: 'un',
  und: 'un',
  unid: 'un',
  unidade: 'un',
  unidades: 'un',
  kg: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  quilo: 'kg',
  quilos: 'kg',
  g: 'g',
  gr: 'g',
  gramas: 'g',
  l: 'L',
  lt: 'L',
  litro: 'L',
  litros: 'L',
  ml: 'ml',
  pct: 'pct',
  pacote: 'pct',
  pacotes: 'pct',
  cx: 'cx',
  caixa: 'cx',
  caixas: 'cx',
  dz: 'dz',
  duzia: 'dz',
  duzias: 'dz',
}

/**
 * Lê o que foi digitado no campo rápido: "2 kg arroz", "3x leite", "1,5kg carne",
 * "pão" → { quantidade, unidade, nome }.
 */
export function interpretarItem(texto: string): { nome: string; quantidade: number; unidade: Unidade } {
  const t = texto.trim().replace(/\s+/g, ' ')
  const m = t.match(/^(\d+(?:[.,]\d+)?)\s*(?:x\s*)?([a-zA-ZçÇúÚ]+\.?)?\s+(.+)$/)
  if (m) {
    const quantidade = Number(m[1].replace(',', '.'))
    const unidadeTexto = m[2] ? normalizar(m[2].replace('.', '')) : ''
    const unidade = SINONIMOS_UNIDADE[unidadeTexto]
    if (quantidade > 0) {
      if (unidade) return { nome: limparDe(m[3]), quantidade, unidade }
      // "2 leite": o "texto" capturado como unidade era parte do nome.
      return { nome: limparDe(`${m[2] ?? ''} ${m[3]}`.trim()), quantidade, unidade: 'un' }
    }
  }
  return { nome: t, quantidade: 1, unidade: 'un' }
}

/** "de arroz" → "arroz" (de "2 kg de arroz"). */
const limparDe = (s: string) => s.replace(/^(de|do|da)\s+/i, '')

export function formatarQuantidade(qtd: number, unidade: Unidade): string {
  const n = qtd.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
  return unidade === 'un' ? `${n}x` : `${n} ${unidade}`
}

/** Preço total estimado do item (unitário × quantidade), em centavos. */
export function totalItem(i: { quantidade: number; preco_cents: number | null }): number {
  return i.preco_cents ? Math.round(i.preco_cents * i.quantidade) : 0
}
