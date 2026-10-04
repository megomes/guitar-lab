import type { Metadata, Viewport } from 'next'
import { Geist_Mono, Inter, Instrument_Serif } from 'next/font/google'

import { ServiceWorker } from '@/components/ServiceWorker'

import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

/* A serifa dos títulos, com o itálico da palavra em destaque. */
const serif = Instrument_Serif({
  variable: '--font-serif',
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
})

const mono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Guitar Lab',
  description: 'Escalas nas formas CAGED, acordes, mapa de notas e o treino de posições — tab e braço com som, drills e plano.',
  applicationName: 'Guitar Lab',
  appleWebApp: { capable: true, title: 'Guitar Lab', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#0B0B0C',
  colorScheme: 'dark',
  viewportFit: 'cover',
}

/* O tamanho de verdade da janela, antes da primeira pintura: com o celular em pé
   o app gira e usa isto no lugar de 100dvh, que no app instalado do Android às
   vezes conta a barra de navegação e deixa o app maior que a tela. */
const VIEWPORT = `(function(){var d=document.documentElement;function s(){d.style.setProperty('--win-w',innerWidth+'px');d.style.setProperty('--win-h',innerHeight+'px')}s();addEventListener('resize',s);if(window.visualViewport)visualViewport.addEventListener('resize',s)})()`

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${serif.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: VIEWPORT }} />
        {children}
        <ServiceWorker />
      </body>
    </html>
  )
}
