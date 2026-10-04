'use client'

/* A casca: a barra de cima com as sete telas e a barra de baixo no celular, que
 * vira um trilho na lateral com o celular deitado. */
import { ArrowUpRight, CalendarDays, Crosshair, Gamepad2, Guitar, Repeat, RotateCw, Video, Waypoints, X } from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'

import { MODES, type ModeId } from '@/lib/modes'

const ICON = { size: 18, strokeWidth: 1.6 }

export const MODE_ICON: Record<ModeId, React.ReactNode> = {
  scales: <Waypoints {...ICON} />,
  chords: <Guitar {...ICON} />,
  notes: <Crosshair {...ICON} />,
  practice: <Repeat {...ICON} />,
  meeting: <Video {...ICON} />,
  plan: <CalendarDays {...ICON} />,
  quiz: <Gamepad2 {...ICON} />,
}

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }} aria-hidden>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
        <path d="M3 7h18M3 12h18M3 17h18" stroke="rgba(255,255,255,0.45)" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="8" cy="7" r="2.6" fill="#fff" />
        <circle cx="12" cy="17" r="2.6" fill="#fff" />
        <circle cx="16" cy="12" r="2.6" fill="#fff" />
      </svg>
    </span>
  )
}

interface NavProps {
  mode: ModeId
  onMode: (m: ModeId) => void
  /** "A menor · forma E": o que as duas metades estão olhando. */
  context: string
  cta: { label: string; onPress: () => void }
}

export function Nav({ mode, onMode, context, cta }: NavProps) {
  return (
    <header className="nav">
      <div className="wrap nav-in">
        <button type="button" className="brand" onClick={() => onMode('scales')} aria-label="Guitar Lab, início">
          <BrandMark />
          Guitar Lab
        </button>
        <nav className="links" aria-label="telas">
          {MODES.map((m, i) => (
            <Fragment key={m.id}>
              {i > 0 && MODES[i - 1].group !== m.group && <span className="links-sep" aria-hidden />}
              <button type="button" className={`link${m.id === mode ? ' link-on' : ''}`} aria-current={m.id === mode ? 'page' : undefined} title={m.hint} onClick={() => onMode(m.id)}>
                {m.name}
              </button>
            </Fragment>
          ))}
        </nav>
        <div className="nav-end">
          <span className="eyebrow" title="tônica e forma, compartilhadas por todas as telas">
            <i />
            {context}
          </span>
          <button type="button" className="btn btn-primary" onClick={cta.onPress}>
            {cta.label}
            <ArrowUpRight size={14} strokeWidth={1.9} />
          </button>
        </div>
      </div>
    </header>
  )
}

export function TabBar({ mode, onMode, cta }: { mode: ModeId; onMode: (m: ModeId) => void; cta: NavProps['cta'] }) {
  return (
    <nav className="tabbar" aria-label="telas">
      {MODES.map((m) => (
        <button key={m.id} type="button" className={`tab-btn${m.id === mode ? ' tab-btn-on' : ''}`} aria-current={m.id === mode ? 'page' : undefined} title={m.name} onClick={() => onMode(m.id)}>
          {MODE_ICON[m.id]}
          <span>{m.name}</span>
        </button>
      ))}
      {/* A ponte da barra de cima (Praticar, Consultar…): só aparece no trilho. */}
      <button type="button" className="tab-cta" title={cta.label} aria-label={cta.label} onClick={cta.onPress}>
        <ArrowUpRight size={18} strokeWidth={1.9} />
      </button>
    </nav>
  )
}

/* Celular em pé: o braço não cabe. O aviso pede para deitar e, onde o navegador
 * deixa (Chrome no Android), abre em tela cheia já travado deitado — sem depender
 * da rotação automática. Instalado, o manifest já abre deitado. */
export function RotateHint() {
  const [closed, setClosed] = useState(false)
  const [canLock, setCanLock] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanLock(!!document.documentElement.requestFullscreen && 'orientation' in screen && 'lock' in screen.orientation)
  }, [])

  if (closed) return null

  const open = async () => {
    try {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
      await (screen.orientation as ScreenOrientation & { lock: (o: string) => Promise<void> }).lock('landscape')
    } catch {
      // Recusou (iPhone, navegador sem suporte): fica o aviso para girar na mão.
    }
  }

  return (
    <div className="rotate" role="note">
      <RotateCw size={15} strokeWidth={1.8} />
      <span>O braço inteiro cabe com o celular deitado.</span>
      {canLock && (
        <button type="button" className="btn btn-primary btn-sm" onClick={open}>
          Abrir deitado
        </button>
      )}
      <button type="button" className="icon-btn" aria-label="Fechar o aviso" onClick={() => setClosed(true)}>
        <X size={15} strokeWidth={1.8} />
      </button>
    </div>
  )
}
