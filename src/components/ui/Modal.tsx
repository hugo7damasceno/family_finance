import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface Props {
  aberto: boolean
  onFechar: () => void
  titulo: string
  children: ReactNode
}

/** Modal baseado em <dialog>: painel inferior no celular, centralizado no desktop. */
export function Modal({ aberto, onFechar, titulo, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (aberto && !d.open) d.showModal()
    if (!aberto && d.open) d.close()
  }, [aberto])

  return (
    <dialog
      ref={ref}
      onClose={onFechar}
      onClick={(e) => e.target === ref.current && onFechar()}
      aria-labelledby="modal-titulo"
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-3xl bg-white p-0 shadow-xl backdrop:bg-slate-900/40 sm:m-auto sm:max-w-lg sm:rounded-3xl"
    >
      {aberto && (
        <div className="pb-safe">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
            <h2 id="modal-titulo" className="text-lg font-semibold text-slate-900">
              {titulo}
            </h2>
            <button
              type="button"
              onClick={onFechar}
              className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Fechar"
            >
              <X className="size-5" />
            </button>
          </header>
          <div className="px-5 py-5">{children}</div>
        </div>
      )}
    </dialog>
  )
}
