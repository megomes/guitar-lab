'use client'

/* A grafia em uso (C♯ ou D♭), para qualquer componente escrever nota sem
 * precisar saber de que tela veio. Quem decide é o topo, pelo tom. */
import { createContext, useContext } from 'react'

import { sharpNames, type Names } from '@/lib/spelling'

export const NamesContext = createContext<Names>(sharpNames)

export const useNames = () => useContext(NamesContext)
