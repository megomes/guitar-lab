'use client'

import { useEffect } from 'react'

/** Espaço liga e desliga o som — menos quando o foco está num controle. */
export function useSpaceToPlay(toggle: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const t = e.target as HTMLElement | null
      if (t?.closest?.('input,select,textarea,button,dialog,[role="radio"],[role="switch"]')) return
      e.preventDefault()
      toggle()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [toggle])
}
