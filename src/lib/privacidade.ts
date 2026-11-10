import { createContext, useContext } from 'react'

export interface Privacidade {
  ocultos: boolean
  alternar: () => void
}

export const PrivacidadeContext = createContext<Privacidade>({ ocultos: false, alternar: () => {} })

export const usePrivacidade = () => useContext(PrivacidadeContext)

export const CHAVE_PRIVACIDADE = 'ff:valores-ocultos'
