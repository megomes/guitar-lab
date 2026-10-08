'use client'

/* A casca: a barra de cima com as telas do instrumento escolhido e a barra de
 * baixo no celular, que vira um trilho na lateral no celular, que fica sempre
 * deitado. O seletor ao lado da marca troca guitarra e piano — o app é o mesmo. */
import { ArrowUpRight, CalendarDays, Crosshair, Gamepad2, GraduationCap, Guitar, LayoutGrid, Piano, Repeat, Video, Waypoints } from 'lucide-react'
import { Fragment } from 'react'

import { INSTRUMENT_NAME, instrumentOf, modesOf, type Instrument, type ModeId } from '@/lib/modes'

const ICON = { size: 18, strokeWidth: 1.6 }

export const MODE_ICON: Record<ModeId, React.ReactNode> = {
  scales: <Waypoints {...ICON} />,
  chords: <Guitar {...ICON} />,
  chords2: <LayoutGrid {...ICON} />,
  notes: <Crosshair {...ICON} />,
  practice: <Repeat {...ICON} />,
  meeting: <Video {...ICON} />,
  plan: <CalendarDays {...ICON} />,
  quiz: <Gamepad2 {...ICON} />,
  solos: <GraduationCap {...ICON} />,
  pChords: <Piano {...ICON} />,
  pScales: <Waypoints {...ICON} />,
  pGame: <Gamepad2 {...ICON} />,
}

const INSTRUMENTS: Instrument[] = ['guitar', 'piano']
const INSTRUMENT_LABEL: Record<Instrument, string> = { guitar: 'Guitarra', piano: 'Piano' }

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

/** Guitarra ou piano: as mesmas ideias, outras telas e outro acento. */
export function InstrumentSwitch({ value, onChange }: { value: Instrument; onChange: (i: Instrument) => void }) {
  return (
    <div className="inst" role="radiogroup" aria-label="instrumento">
      {INSTRUMENTS.map((i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} className={`inst-btn${value === i ? ' inst-on' : ''}`} title={INSTRUMENT_NAME[i]} onClick={() => onChange(i)}>
          {i === 'guitar' ? <Guitar size={14} strokeWidth={1.8} /> : <Piano size={14} strokeWidth={1.8} />}
          <span>{INSTRUMENT_LABEL[i]}</span>
        </button>
      ))}
    </div>
  )
}

interface NavProps {
  mode: ModeId
  onMode: (m: ModeId) => void
  /** "A menor · forma E": o que as duas metades estão olhando. */
  context: string
  /** A ponte entre as metades (Praticar, Consultar…). O piano ainda não tem. */
  cta?: { label: string; onPress: () => void }
  onInstrument: (i: Instrument) => void
}

export function Nav({ mode, onMode, context, cta, onInstrument }: NavProps) {
  const instrument = instrumentOf(mode)
  const modes = modesOf(instrument)
  return (
    <header className="nav">
      <div className="wrap nav-in">
        <div className="brand-row">
          <button type="button" className="brand" onClick={() => onMode(modes[0].id)} aria-label={`${INSTRUMENT_NAME[instrument]}, início`}>
            <BrandMark />
            {INSTRUMENT_NAME[instrument]}
          </button>
          <InstrumentSwitch value={instrument} onChange={onInstrument} />
        </div>
        <nav className="links" aria-label="telas">
          {modes.map((m, i) => (
            <Fragment key={m.id}>
              {i > 0 && modes[i - 1].group !== m.group && <span className="links-sep" aria-hidden />}
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
          {cta && (
            <button type="button" className="btn btn-primary" onClick={cta.onPress}>
              {cta.label}
              <ArrowUpRight size={14} strokeWidth={1.9} />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

export function TabBar({ mode, onMode, cta, onInstrument }: { mode: ModeId; onMode: (m: ModeId) => void; cta: NavProps['cta']; onInstrument: (i: Instrument) => void }) {
  const instrument = instrumentOf(mode)
  const modes = modesOf(instrument)
  const other: Instrument = instrument === 'guitar' ? 'piano' : 'guitar'
  return (
    <nav className="tabbar" aria-label="telas">
      {/* No trilho a barra de cima some: a troca de instrumento vem para cá. */}
      <button type="button" className="tab-inst" title={`Ir para o ${INSTRUMENT_NAME[other]}`} aria-label={`Ir para o ${INSTRUMENT_NAME[other]}`} onClick={() => onInstrument(other)}>
        {other === 'piano' ? <Piano size={16} strokeWidth={1.7} /> : <Guitar size={16} strokeWidth={1.7} />}
      </button>
      {modes.map((m, i) => (
        <Fragment key={m.id}>
          {/* Consulta, Treino e Jogo: um respiro entre os grupos, só no trilho. */}
          {i > 0 && modes[i - 1].group !== m.group && <span className="tab-sep" aria-hidden />}
          <button type="button" className={`tab-btn${m.id === mode ? ' tab-btn-on' : ''}`} aria-current={m.id === mode ? 'page' : undefined} title={m.name} onClick={() => onMode(m.id)}>
            {MODE_ICON[m.id]}
            <span>{m.name}</span>
          </button>
        </Fragment>
      ))}
      {/* A ponte da barra de cima (Praticar, Consultar…): só aparece no trilho. */}
      {cta && (
        <button type="button" className="tab-cta" title={cta.label} aria-label={cta.label} onClick={cta.onPress}>
          <ArrowUpRight size={18} strokeWidth={1.9} />
        </button>
      )}
    </nav>
  )
}
