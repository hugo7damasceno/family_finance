import {
  ArrowLeftRight,
  BarChart3,
  CalendarHeart,
  CreditCard,
  Gem,
  Hammer,
  Home,
  Layers,
  LineChart,
  Settings,
  ShoppingCart,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export interface Modulo {
  rota: string
  titulo: string
  descricao: string
  icone: LucideIcon
  fase: 1 | 2 | 3
  /** Aparece na barra inferior do celular. */
  atalhoMobile?: boolean
  /** Só faz sentido para contas conjuntas. */
  somenteCasal?: boolean
}

export const modulos: Modulo[] = [
  { rota: '/', titulo: 'Início', descricao: 'Resumo do mês', icone: Home, fase: 1, atalhoMobile: true },
  {
    rota: '/lancamentos',
    titulo: 'Lançamentos',
    descricao: 'Receitas, despesas e transferências por categoria',
    icone: ArrowLeftRight,
    fase: 1,
    atalhoMobile: true,
  },
  {
    rota: '/contas',
    titulo: 'Contas e cofrinhos',
    descricao: 'Contas bancárias, cofrinhos com metas e reserva de emergência',
    icone: Wallet,
    fase: 1,
  },
  {
    rota: '/cartoes',
    titulo: 'Cartões',
    descricao: 'Cartões de crédito, faturas e compras de terceiros',
    icone: CreditCard,
    fase: 1,
    atalhoMobile: true,
  },
  {
    rota: '/parcelamentos',
    titulo: 'Parcelamentos',
    descricao: 'Compras parceladas e percentual da renda comprometida',
    icone: Layers,
    fase: 1,
  },
  {
    rota: '/comparativos',
    titulo: 'Comparativos',
    descricao: 'Despesas mês a mês e ano a ano, por categoria',
    icone: BarChart3,
    fase: 1,
  },
  {
    rota: '/compras',
    titulo: 'Lista de compras',
    descricao: 'Lista do mercado com checklist durante a compra',
    icone: ShoppingCart,
    fase: 2,
    atalhoMobile: true,
  },
  {
    rota: '/terceiros',
    titulo: 'Terceiros',
    descricao: 'Pessoas que compraram no seu cartão e precisam reembolsar',
    icone: Users,
    fase: 1,
  },
  { rota: '/sonhos', titulo: 'Sonhos', descricao: 'Metas e conquistas: viagem, carro, móveis', icone: Sparkles, fase: 2 },
  {
    rota: '/investimentos',
    titulo: 'Investimentos',
    descricao: 'Ativos, compras, vendas, proventos e diversificação',
    icone: LineChart,
    fase: 3,
  },
  {
    rota: '/projetos',
    titulo: 'Projetos',
    descricao: 'Reforma, compra do carro, empréstimos e amortizações',
    icone: Hammer,
    fase: 3,
  },
  {
    rota: '/datas',
    titulo: 'Datas especiais',
    descricao: 'Aniversário de casamento, dia dos namorados e outras datas',
    icone: CalendarHeart,
    fase: 3,
    somenteCasal: true,
  },
  { rota: '/patrimonio', titulo: 'Patrimônio', descricao: 'Evolução do patrimônio líquido', icone: Gem, fase: 3 },
  { rota: '/configuracoes', titulo: 'Configurações', descricao: 'Perfil, conta conjunta e dados', icone: Settings, fase: 1 },
]
