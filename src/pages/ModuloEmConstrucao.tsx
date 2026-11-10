import { useLocation } from 'react-router-dom'
import { BarChart3, Landmark, ReceiptText } from 'lucide-react'
import { Cabecalho } from '@/components/layout/AuthLayout'
import { BotaoEmDesenvolvimento } from '@/components/EmDesenvolvimento'
import { Card } from '@/components/ui/Card'
import { modulos } from '@/config/modulos'

/** Integrações futuras exibidas como botões desabilitados em cada módulo. */
const integracoes: Record<string, { icone: typeof Landmark; rotulo: string }[]> = {
  '/lancamentos': [{ icone: Landmark, rotulo: 'Importar do banco (Open Finance)' }],
  '/cartoes': [{ icone: Landmark, rotulo: 'Importar fatura do banco (Open Finance)' }],
  '/compras': [{ icone: ReceiptText, rotulo: 'Ler itens da nota fiscal' }],
  '/investimentos': [{ icone: BarChart3, rotulo: 'Vincular conta da B3' }],
}

/** Página provisória para os módulos que ainda serão implementados. */
export function ModuloEmConstrucao() {
  const { pathname } = useLocation()
  const modulo = modulos.find((m) => m.rota === pathname)
  if (!modulo) return null

  return (
    <>
      <Cabecalho titulo={modulo.titulo} descricao={modulo.descricao} />
      <Card className="flex flex-col items-center gap-3 py-12 text-center">
        <modulo.icone className="size-12 text-brand-600" aria-hidden />
        <p className="font-semibold text-slate-900">Em construção</p>
        <p className="max-w-sm text-sm text-slate-600">
          Este módulo faz parte da <strong>fase {modulo.fase}</strong> do projeto e será liberado em breve.
        </p>
      </Card>
      {integracoes[pathname] && (
        <div className="mt-4 flex flex-col gap-2">
          {integracoes[pathname].map((i) => (
            <BotaoEmDesenvolvimento key={i.rotulo} icone={i.icone} rotulo={i.rotulo} />
          ))}
        </div>
      )}
    </>
  )
}
