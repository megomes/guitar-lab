'use client'

import { useEffect } from 'react'

/* Registra o service worker que deixa o app abrir sem rede. Só em produção: no
   `next dev` ele guardaria versões velhas dos módulos e atrapalharia o reload. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
      // Sem service worker o app funciona igual, só não abre offline.
    })
  }, [])
  return null
}
