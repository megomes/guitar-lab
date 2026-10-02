'use client'

/* O centro de cima: o nome grande do que está no braço e as métricas que ele
 * não diz sozinho. */
import { Grid3x3, Hand, Layers, Music, Ruler, Target, Triangle } from 'lucide-react'
import { memo } from 'react'

import { QUALITIES, barreFret, chordIntervals, chordSymbol, tabOf, type QualityId, type Voicing } from '@/lib/chords'
import { STRING_LABELS, type Scale, type ShapeId } from '@/lib/fretboard'
import { noteSpots } from '@/lib/notes'
import { degreeColor } from '@/lib/roles'
import { sharpNames } from '@/lib/spelling'

import { useNames } from '../names'
import { Eyebrow, Metric } from '../ui'

const ICON = { size: 17, strokeWidth: 1.6 }
const INTERVALS = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7']

function Pip({ top, main, degree }: { top: string; main: string; degree: string }) {
  const color = degreeColor(degree)
  return (
    <div className="pip">
      <span className="pip-top">{top}</span>
      <span className="pip-main">
        <i className="pip-dot" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
        {main}
      </span>
    </div>
  )
}

/* ── Escalas ──────────────────────────────────────────────────────────── */

function ScaleHeroView({
  rootPc,
  scale,
  shape,
  window,
  quality,
  children,
}: {
  rootPc: number
  scale: Scale
  shape: ShapeId
  window: { from: number; to: number } | null
  quality: QualityId | null
  children?: React.ReactNode
}) {
  const nn = useNames()
  const triad = scale.intervals
    .map((interval, i) => ({ pc: (rootPc + interval) % 12, degree: scale.degrees[i] }))
    .filter((d) => ['1', '3', '♭3', '5', '♭5'].includes(d.degree))

  return (
    <div className="hero">
      <Eyebrow group="Consulta · Escalas">{quality ? ` · consultando ${chordSymbol(rootPc, quality, nn)}` : ''}</Eyebrow>
      <h1 className="display">
        {nn(rootPc)}
        <span className="display-sub">{scale.name}</span>
      </h1>

      <div className="metrics">
        <Metric icon={<Music {...ICON} />} label="Notas" value={scale.intervals.length} />
        <Metric icon={<Layers {...ICON} />} label="Forma" value={shape} />
        <Metric icon={<Ruler {...ICON} />} label="Casas" value={window ? `${window.from}–${window.to}` : '—'} />
        <Metric icon={<Triangle {...ICON} />} label="Esqueleto" value={triad.map((d) => nn(d.pc)).join(' ')} />
      </div>

      <div className="pips">
        {scale.intervals.map((interval, i) => (
          <Pip key={interval} top={scale.degrees[i]} main={nn(rootPc + interval)} degree={scale.degrees[i]} />
        ))}
      </div>
      {children}
    </div>
  )
}

export const ScaleHero = memo(ScaleHeroView)

/* ── Acordes ──────────────────────────────────────────────────────────── */

function ChordHeroView({ rootPc, quality, shape, voicing }: { rootPc: number; quality: QualityId; shape: ShapeId; voicing: Voicing | null }) {
  const nn = useNames()
  const barre = voicing ? barreFret(voicing) : null
  const q = QUALITIES[quality]

  return (
    <div className="hero">
      <Eyebrow group="Consulta · Acordes">{` · ${q.name}`}</Eyebrow>
      <h1 className="display">
        {chordSymbol(rootPc, quality, nn)}
        <span className="display-sub mono">{voicing ? tabOf(voicing) : `sem digitação na forma ${shape}`}</span>
      </h1>

      <div className="metrics">
        <Metric icon={<Layers {...ICON} />} label="Forma" value={shape} />
        <Metric icon={<Hand {...ICON} />} label="Pestana" value={barre === null ? 'não' : `casa ${barre}`} />
        <Metric icon={<Ruler {...ICON} />} label="Casas" value={voicing ? `${voicing.window.from}–${voicing.window.to}` : '—'} />
        <Metric icon={<Triangle {...ICON} />} label="Notas" value={chordIntervals(quality).map((t) => nn(rootPc + t)).join(' ')} />
      </div>

      {voicing && (
        <div className="pips">
          {voicing.voices.map((voice) => (
            <Pip key={voice.string} top={`${STRING_LABELS[voice.string]} · ${voice.fret}`} main={nn(voice.pc)} degree={voice.degree} />
          ))}
        </div>
      )}
    </div>
  )
}

export const ChordHero = memo(ChordHeroView)

/* ── Notas ────────────────────────────────────────────────────────────── */

function NoteHeroView({ pcs }: { pcs: number[] }) {
  const ref = pcs[0]
  /* Em ordem a partir da referência: C D E F G A B, e não na ordem dos toques. */
  const ordered = [...pcs].sort((a, b) => ((a - ref + 12) % 12) - ((b - ref + 12) % 12))
  const title = pcs.length === 0 ? '—' : pcs.length === 12 ? 'Todas' : ordered.map((p) => sharpNames(p)).join(' ')

  return (
    <div className="hero">
      <Eyebrow group="Consulta · Notas" />
      <h1 className={`display${pcs.length > 3 ? ' display-long' : ''}${pcs.length === 0 ? ' idle' : ''}`}>{title}</h1>

      <div className="metrics">
        <Metric icon={<Music {...ICON} />} label="Escolhidas" value={pcs.length} />
        <Metric icon={<Target {...ICON} />} label="Referência" value={pcs.length ? sharpNames(ref) : '—'} />
        <Metric icon={<Grid3x3 {...ICON} />} label="Casas no braço" value={noteSpots(pcs).length} />
      </div>

      {pcs.length > 1 && (
        <div className="pips">
          {ordered.map((p) => {
            const degree = INTERVALS[(p - ref + 12) % 12]
            return <Pip key={p} top={degree} main={sharpNames(p)} degree={degree} />
          })}
        </div>
      )}
    </div>
  )
}

export const NoteHero = memo(NoteHeroView)
