import { Loader2 } from 'lucide-react'

export function Carregando({ telaCheia }: { telaCheia?: boolean }) {
  return (
    <div className={telaCheia ? 'flex min-h-dvh items-center justify-center' : 'flex justify-center py-10'}>
      <Loader2 className="size-8 animate-spin text-brand-700" aria-label="Carregando" />
    </div>
  )
}
