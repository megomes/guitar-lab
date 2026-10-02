'use client'

/* Tocar em loop, BPM, clique e o "Como funciona" — a barra de cima de cada exercício. */
import { CircleHelp, Minus, Play, Plus, Square } from 'lucide-react'

import { Segmented } from '../ui'

export type VisMode = 'both' | 'tab' | 'neck'

const VIS_OPTIONS: { value: VisMode; label: string }[] = [
  { value: 'both', label: 'Tab e braço' },
  { value: 'tab', label: 'Só tab' },
  { value: 'neck', label: 'Só braço' },
]

export function VisSwitch({ value, onChange }: { value: VisMode; onChange: (v: VisMode) => void }) {
  return <Segmented options={VIS_OPTIONS} value={value} onChange={onChange} />
}

export function PlayerBar({
  playing,
  bpm,
  click,
  onToggle,
  onBpm,
  onClick,
  onHow,
  children,
}: {
  playing: boolean
  bpm: number
  click: boolean
  onToggle: () => void
  onBpm: (bpm: number) => void
  onClick: () => void
  onHow: () => void
  children?: React.ReactNode
}) {
  const step = (d: number) => onBpm(Math.max(40, Math.min(160, bpm + d)))
  return (
    <div className="player">
      <button type="button" className={`btn btn-lg ${playing ? 'btn-on' : 'btn-primary'}`} onClick={onToggle}>
        {playing ? <Square size={14} fill="currentColor" strokeWidth={0} /> : <Play size={15} fill="currentColor" strokeWidth={0} />}
        {playing ? 'Parar' : 'Tocar em loop'}
      </button>
      <div className="bpm">
        <button type="button" className="icon-btn" aria-label="Mais lento" onClick={() => step(-5)}>
          <Minus size={15} strokeWidth={1.8} />
        </button>
        <output aria-live="polite">{bpm}</output>
        <small>BPM</small>
        <button type="button" className="icon-btn" aria-label="Mais rápido" onClick={() => step(5)}>
          <Plus size={15} strokeWidth={1.8} />
        </button>
      </div>
      <button type="button" className={`toggle${click ? ' toggle-on' : ''}`} aria-pressed={click} onClick={onClick}>
        Clique
      </button>
      {children}
      <span className="spacer" />
      <button type="button" className="btn btn-ghost" onClick={onHow}>
        <CircleHelp size={15} strokeWidth={1.7} />
        Como funciona
      </button>
    </div>
  )
}
