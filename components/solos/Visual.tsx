'use client'

/* O visual de um conceito ou exercício: tab que toca, braço que se ouve, acordes que soam.
 *
 * É o mesmo braço, a mesma tab e o mesmo violão sintetizado do Treino — a lição só
 * traz as notas. Um visual tocando cala os outros: duas frases ao mesmo tempo
 * nunca ensinaram nada.
 */
import { Minus, Play, Plus, Square } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'

import { Fretboard, type LabelMode } from '@/components/Fretboard'
import { usePlayer } from '@/components/practice/usePlayer'
import { Tab } from '@/components/Tab'
import { STANDARD_TUNING } from '@/lib/fretboard'
import { Player } from '@/lib/practice/audio'
import { degreeColor } from '@/lib/roles'
import { TAB_COLS, chordMidis, hasNotes, parseShape, toBars, toMarks, toRings, toWindow } from '@/lib/solos/convert'
import type { LChord, LVisual } from '@/lib/solos/types'

const SOLO_EVENT = 'solos-play'

/** Um violão só para os toques avulsos (casa clicada, acorde): não briga com o loop da tab. */
let tapPlayer: Player | null = null
const tap = () => (tapPlayer ??= new Player())

export function strum(shape: string) {
  chordMidis(shape).forEach((m, i) => setTimeout(() => tap().pluckNow(m, 0.42), i * 28))
}

function TabVisual({ v, labelMode }: { v: LVisual; labelMode: LabelMode }) {
  const id = useId()
  const bars = useMemo(() => toBars(v), [v])
  const marks = useMemo(() => toMarks(v), [v])
  const rings = useMemo(() => toRings(v), [v])
  const focus = useMemo(() => toWindow(v), [v])
  const [bpm, setBpm] = useState(v.bpm || 70)
  const [click, setClick] = useState(true)
  const { playing, now, toggle, stop } = usePlayer(bars, TAB_COLS, bpm, click)

  useEffect(() => {
    const onOther = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) stop()
    }
    window.addEventListener(SOLO_EVENT, onOther)
    return () => window.removeEventListener(SOLO_EVENT, onOther)
  }, [id, stop])

  const onToggle = useCallback(() => {
    if (!playing) window.dispatchEvent(new CustomEvent(SOLO_EVENT, { detail: id }))
    toggle()
  }, [playing, toggle, id])

  return (
    <div className={`sl-vis${playing ? ' sl-vis-on' : ''}`}>
      <div className="sl-vis-bar">
        <button type="button" className={`btn ${playing ? 'btn-on' : 'btn-primary'}`} onClick={onToggle}>
          {playing ? <Square size={12} fill="currentColor" strokeWidth={0} /> : <Play size={13} fill="currentColor" strokeWidth={0} />}
          {playing ? 'Parar' : 'Ouvir em loop'}
        </button>
        <div className="bpm sl-bpm">
          <button type="button" className="icon-btn" aria-label="Mais lento" onClick={() => setBpm((b) => Math.max(40, b - 5))}>
            <Minus size={14} strokeWidth={1.8} />
          </button>
          <output aria-live="polite">{bpm}</output>
          <small>BPM</small>
          <button type="button" className="icon-btn" aria-label="Mais rápido" onClick={() => setBpm((b) => Math.min(160, b + 5))}>
            <Plus size={14} strokeWidth={1.8} />
          </button>
        </div>
        <button type="button" className={`toggle${click ? ' toggle-on' : ''}`} aria-pressed={click} onClick={() => setClick((c) => !c)}>
          Clique
        </button>
        {v.legenda && <span className="sl-vis-cap">{v.legenda}</span>}
      </div>
      <Tab bars={bars} cols={TAB_COLS} now={now?.key ?? null} />
      <div className="neck sl-neck">
        <Fretboard marks={marks} rings={rings} now={now?.pins} focus={focus} labelMode={labelMode} showOutside={false} onTap={(f, s) => tap().pluckNow(STANDARD_TUNING[s] + f)} />
      </div>
    </div>
  )
}

function NeckVisual({ v, labelMode }: { v: LVisual; labelMode: LabelMode }) {
  const marks = useMemo(() => toMarks(v), [v])
  const rings = useMemo(() => toRings(v), [v])
  const focus = useMemo(() => toWindow(v), [v])
  return (
    <div className="sl-vis">
      {v.legenda && (
        <div className="sl-vis-bar">
          <span className="sl-vis-cap">{v.legenda}</span>
          <span className="sl-vis-hint">toque numa nota para ouvir</span>
        </div>
      )}
      <div className="neck sl-neck">
        <Fretboard marks={marks} rings={rings} focus={focus} labelMode={labelMode} showOutside={false} onTap={(f, s) => tap().pluckNow(STANDARD_TUNING[s] + f)} />
      </div>
    </div>
  )
}

const SEMI_DEGREE: Record<number, string> = { 0: '1', 1: '♭9', 2: '9', 3: '♭3', 4: '3', 5: '4', 6: '♭5', 7: '5', 8: '♯5', 9: '6', 10: '♭7', 11: '7' }
const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

function rootPc(name: string): number | null {
  const m = name.match(/^([A-G])([♭♯b#]?)/)
  if (!m) return null
  const acc = m[2] === '♯' || m[2] === '#' ? 1 : m[2] === '♭' || m[2] === 'b' ? -1 : 0
  return (LETTER[m[1]] + acc + 12) % 12
}

/** O diagrama de acorde de pé, como no caderno: cordas na vertical, a 6ª à esquerda. */
function ChordBox({ c }: { c: LChord }) {
  const frets = parseShape(c.digitacao)
  const pressed = frets.filter((f): f is number => f !== null && f > 0)
  const low = pressed.length ? Math.min(...pressed) : 1
  const base = Math.max(...pressed, 0) <= 4 ? 1 : low
  const rows = 4
  const root = rootPc(c.nome)
  const X = (i: number) => 14 + i * 16
  const Y = (f: number) => 26 + (f - base + 0.5) * 20
  return (
    <button type="button" className="sl-chord" onClick={() => strum(c.digitacao)} title={`Tocar ${c.nome}`}>
      <span className="sl-chord-name">{c.nome}</span>
      <svg viewBox="0 0 108 116" aria-hidden>
        {base === 1 ? <rect x={X(0) - 1} y="22" width={X(5) - X(0) + 2} height="4" rx="1" fill="var(--fg-2)" /> : <text x="2" y={Y(base) + 4} className="sl-chord-fret">{base}</text>}
        {Array.from({ length: rows + 1 }, (_, r) => (
          <line key={r} x1={X(0)} x2={X(5)} y1={26 + r * 20} y2={26 + r * 20} stroke="var(--line-3)" />
        ))}
        {frets.map((_, i) => (
          <line key={i} x1={X(i)} x2={X(i)} y1="26" y2={26 + rows * 20} stroke="var(--fg-4)" />
        ))}
        {frets.map((f, i) => {
          if (f === null) return <text key={i} x={X(i)} y="16" textAnchor="middle" className="sl-chord-x">×</text>
          const pc = (STANDARD_TUNING[i] + f) % 12
          const deg = root === null ? '' : SEMI_DEGREE[(pc - root + 12) % 12]
          const col = degreeColor(deg)
          if (f === 0) return <circle key={i} cx={X(i)} cy="14" r="4.5" fill="none" stroke={col} strokeWidth="1.5" />
          return (
            <g key={i}>
              <circle cx={X(i)} cy={Y(f)} r="7" fill={col} />
              <text x={X(i)} y={Y(f) + 3} textAnchor="middle" className="sl-chord-deg">
                {deg}
              </text>
            </g>
          )
        })}
      </svg>
    </button>
  )
}

function ChordsVisual({ v }: { v: LVisual }) {
  return (
    <div className="sl-vis">
      <div className="sl-vis-bar">
        {v.legenda && <span className="sl-vis-cap">{v.legenda}</span>}
        <span className="sl-vis-hint">toque no acorde para ouvir</span>
      </div>
      <div className="sl-chords">
        {v.acordes.map((c) => (
          <ChordBox key={c.nome + c.digitacao} c={c} />
        ))}
      </div>
    </div>
  )
}

export function Visual({ v, labelMode }: { v: LVisual | null; labelMode: LabelMode }) {
  if (!hasNotes(v)) return null
  if (v.tipo === 'tab') return <TabVisual v={v} labelMode={labelMode} />
  if (v.tipo === 'braco') return <NeckVisual v={v} labelMode={labelMode} />
  return <ChordsVisual v={v} />
}
