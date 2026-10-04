'use client'

import { useEffect } from 'react'

/* Registra o service worker que deixa o app abrir sem rede. Só em produção: no
   `next dev` ele guardaria versões velhas dos módulos e atrapalharia o reload. */
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    /* No dev, desfaz o que um `npm start` antigo deixou no mesmo localhost: o
       worker serviria o CSS velho do cache (no dev o arquivo não muda de nome). */
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .then((removed) => {
          if (!removed.some(Boolean)) return
          return caches
            .keys()
            .then((keys) => Promise.all(keys.filter((k) => k.startsWith('guitarlab-')).map((k) => caches.delete(k))))
            .then(() => window.location.reload())
        })
        .catch(() => {})
      return
    }
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
      // Sem service worker o app funciona igual, só não abre offline.
    })
  }, [])
  return null
}
