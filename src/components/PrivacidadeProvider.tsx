import { Fragment, useCallback, useMemo, useState, type ReactNode } from 'react'
import { definirValoresOcultos } from '@/lib/money'
import { CHAVE_PRIVACIDADE, PrivacidadeContext } from '@/lib/privacidade'

function lerPreferencia(): boolean {
  try {
    return localStorage.getItem(CHAVE_PRIVACIDADE) === '1'
  } catch {
    return false
  }
}

/**
 * Guarda a preferência "ocultar valores" (por aparelho) e re-renderiza o app
 * quando ela muda, para que todos os valores formatados sejam atualizados.
 */
export function PrivacidadeProvider({ children }: { children: ReactNode }) {
  const [ocultos, setOcultos] = useState(() => {
    const v = lerPreferencia()
    definirValoresOcultos(v)
    return v
  })

  const alternar = useCallback(() => {
    setOcultos((atual) => {
      const novo = !atual
      definirValoresOcultos(novo)
      try {
        localStorage.setItem(CHAVE_PRIVACIDADE, novo ? '1' : '0')
      } catch {
        // Sem armazenamento (navegação privada): vale só para esta sessão.
      }
      return novo
    })
  }, [])

  const valor = useMemo(() => ({ ocultos, alternar }), [ocultos, alternar])

  // A key força a re-renderização de toda a árvore; os dados vêm do cache do React Query.
  return (
    <PrivacidadeContext.Provider value={valor}>
      <Fragment key={ocultos ? 'ocultos' : 'visiveis'}>{children}</Fragment>
    </PrivacidadeContext.Provider>
  )
}
