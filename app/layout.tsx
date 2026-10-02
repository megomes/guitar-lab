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

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${serif.variable} ${mono.variable}`}>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  )
}
