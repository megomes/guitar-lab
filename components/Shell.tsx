'use client'

/* A casca: a barra de cima com as seis telas, a barra de baixo no celular e o
 * rodapé com a marca grande, pontilhada, como no Artivo. */
import { ArrowUpRight, CalendarDays, Crosshair, Guitar, Repeat, Video, Waypoints } from 'lucide-react'
import { Fragment } from 'react'

import { GROUP_NAME, MODES, type ModeId } from '@/lib/modes'

const ICON = { size: 18, strokeWidth: 1.6 }

export const MODE_ICON: Record<ModeId, React.ReactNode> = {
  scales: <Waypoints {...ICON} />,
  chords: <Guitar {...ICON} />,
  notes: <Crosshair {...ICON} />,
  practice: <Repeat {...ICON} />,
  meeting: <Video {...ICON} />,
  plan: <CalendarDays {...ICON} />,
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

export function TabBar({ mode, onMode }: { mode: ModeId; onMode: (m: ModeId) => void }) {
  return (
    <nav className="tabbar" aria-label="telas">
      {MODES.map((m) => (
        <button key={m.id} type="button" className={`tab-btn${m.id === mode ? ' tab-btn-on' : ''}`} aria-current={m.id === mode ? 'page' : undefined} onClick={() => onMode(m.id)}>
          {MODE_ICON[m.id]}
          {m.name}
        </button>
      ))}
    </nav>
  )
}

export function Footer({ onMode }: { onMode: (m: ModeId) => void }) {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="foot-cols">
          <div>
            <div className="brand" style={{ marginBottom: 10 }}>
              <BrandMark size={24} />
              Guitar Lab
            </div>
            <p>
              O Fretlab e o CAGED Lab num lugar só: a mesma tônica, a mesma forma e as mesmas cores do braço, da consulta ao treino.
              Funciona sem rede, depois de aberto uma vez.
            </p>
          </div>
          {(['consulta', 'treino'] as const).map((g) => (
            <div key={g}>
              <h4>{GROUP_NAME[g]}</h4>
              <ul>
                {MODES.filter((m) => m.group === g).map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => onMode(m.id)}>
                      {m.name} <span style={{ color: 'var(--fg-4)' }}>— {m.hint}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <span className="wordmark" aria-hidden>
        Guitar Lab
      </span>
    </footer>
  )
}
