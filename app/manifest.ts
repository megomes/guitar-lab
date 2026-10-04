import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Guitar Lab',
    short_name: 'Guitar Lab',
    description: 'Escalas nas formas CAGED, acordes, mapa de notas e o treino de posições.',
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    /* Instalado: tela cheia e sempre deitado, sem barra de status e sem depender da
       rotação automática. O braço só cabe inteiro assim. */
    display: 'fullscreen',
    display_override: ['fullscreen', 'standalone'],
    orientation: 'landscape',
    background_color: '#0B0B0C',
    theme_color: '#0B0B0C',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
