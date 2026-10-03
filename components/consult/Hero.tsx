'use client'

/* O topo da consulta, numa linha: o nome do que está no braço e as notas dele,
 * cada uma na cor do papel. O resto (forma, casas) já está nos controles e no braço. */
import { memo } from 'react'

import { QUALITIES, chordIntervals, chordSymbol, tabOf, type QualityId, type Voicing } from '@/lib/chords'
import { STRING_LABELS, type Scale, type ShapeId } from '@/lib/fretboard'
import { degreeColor } from '@/lib/roles'
import { sharpNames } from '@/lib/spelling'

import { useNames } from '../names'

const INTERVALS = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7']

function Pip({ top, main, degree }: { top: string; main: string; degree: string }) {
  const color = degreeColor(degree)
  return (
    <div className="pip">
      <span className="pip-main">
        <i className="pip-dot" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
        {main}
      </span>
      <span className="pip-top">{top}</span>
    </div>
  )
}

/* ── Escalas ──────────────────────────────────────────────────────────── */

function ScaleHeroView({ rootPc, scale }: { rootPc: number; scale: Scale }) {
  const nn = useNames()
  return (
    <>
      <h1 className="screen-title">
        {nn(rootPc)}
        <small>{scale.name}</small>
      </h1>
      <div className="pips">
        {scale.intervals.map((interval, i) => (
          <Pip key={interval} top={scale.degrees[i]} main={nn(rootPc + interval)} degree={scale.degrees[i]} />
        ))}
      </div>
    </>
  )
}

export const ScaleHero = memo(ScaleHeroView)

/* ── Acordes ──────────────────────────────────────────────────────────── */

function ChordHeroView({
  rootPc,
  quality,
  shape,
  voicing,
  triads,
}: {
  rootPc: number
  quality: QualityId
  shape: ShapeId
  voicing: Voicing | null
  /** Vendo as tríades: o grupo de cordas, no lugar da digitação. */
  triads?: string
}) {
  const nn = useNames()
  if (triads)
    return (
      <>
        <h1 className="screen-title">
          {chordSymbol(rootPc, quality, nn)}
          <small>tríades nas cordas {triads}</small>
        </h1>
        <div className="pips">
          {chordIntervals(quality).map((iv, i) => (
            <Pip key={iv} top={QUALITIES[quality].degrees[i] ?? ''} main={nn(rootPc + iv)} degree={QUALITIES[quality].degrees[i] ?? ''} />
          ))}
        </div>
      </>
    )
  return (
    <>
      <h1 className="screen-title">
        {chordSymbol(rootPc, quality, nn)}
        <small className="mono">{voicing ? tabOf(voicing) : `sem digitação na forma ${shape}`}</small>
      </h1>
      {voicing && (
        <div className="pips">
          {voicing.voices.map((voice) => (
            <Pip key={voice.string} top={`${STRING_LABELS[voice.string]}${voice.fret}`} main={nn(voice.pc)} degree={voice.degree} />
          ))}
        </div>
      )}
    </>
  )
}

export const ChordHero = memo(ChordHeroView)

/* ── Notas ────────────────────────────────────────────────────────────── */

function NoteHeroView({ pcs }: { pcs: number[] }) {
  const ref = pcs[0]
  /* Em ordem a partir da referência: C D E F G A B, e não na ordem dos toques. */
  const ordered = [...pcs].sort((a, b) => ((a - ref + 12) % 12) - ((b - ref + 12) % 12))
  const title = pcs.length === 0 ? 'Nenhuma nota' : pcs.length === 12 ? 'Todas as notas' : pcs.length === 1 ? sharpNames(ref) : 'Notas'

  return (
    <>
      <h1 className={`screen-title${pcs.length === 0 ? ' idle' : ''}`}>{title}</h1>
      {pcs.length > 1 && (
        <div className="pips">
          {ordered.map((p) => {
            const degree = INTERVALS[(p - ref + 12) % 12]
            return <Pip key={p} top={degree} main={sharpNames(p)} degree={degree} />
          })}
        </div>
      )}
    </>
  )
}

export const NoteHero = memo(NoteHeroView)
