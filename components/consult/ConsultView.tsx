'use client'

/* Consulta — o Fretlab: escalas na forma CAGED, acordes nas cinco formas e o
 * mapa de notas. Numa tela só, sem rolar: o nome e as notas em cima, os
 * controles numa faixa, e o braço com todo o resto da altura.
 */
import { ArrowUpRight } from 'lucide-react'
import { useMemo } from 'react'

import { chordIntervals, chordSymbol, chordVoicing, QUALITIES } from '@/lib/chords'
import { SCALES, boxFor, scaleSpots, type Scale, type ShapeId } from '@/lib/fretboard'
import { marksFromSpots } from '@/lib/marks'
import { noteSpots } from '@/lib/notes'
import { PROG_BY } from '@/lib/practice/caged'
import { computePractice, diagLegend, diagNeck } from '@/lib/practice/session'
import type { ScaleView, Settings } from '@/lib/settings'
import { isMinorish } from '@/lib/spelling'

import { Neck } from '../Neck'
import { Segmented } from '../ui'
import { ChordControls, NoteControls, ScaleControls } from './Controls'
import { ChordHero, NoteHero, ScaleHero } from './Hero'

type Setter = <K extends keyof Settings>(key: K) => (value: Settings[K]) => void

interface Props {
  settings: Settings
  set: Setter
  onPractice: () => void
}

export function ConsultView({ settings, set, onPractice }: Props) {
  const { mode, rootPc, scaleId, shape, labelMode, showOutside, quality, notePcs, scaleView } = settings

  const scale = useMemo(() => SCALES.find((s) => s.id === scaleId) ?? SCALES[0], [scaleId])
  const position = useMemo(() => boxFor(rootPc, shape, scale), [rootPc, shape, scale])

  /* A digitação na tela: só no modo Acordes. */
  const voicing = useMemo(() => (mode === 'chords' ? chordVoicing(rootPc, quality, shape) : null), [mode, rootPc, quality, shape])

  /* No modo Acordes o fundo é o arpejo: as notas do acorde pelo braço inteiro, apagadas. */
  const marks = useMemo(() => {
    if (mode === 'notes') return marksFromSpots(noteSpots(notePcs))
    if (mode === 'chords') {
      const q = QUALITIES[quality]
      const arpeggio: Scale = {
        id: 'arpeggio',
        name: chordSymbol(rootPc, quality),
        intervals: chordIntervals(quality),
        degrees: q.degrees.filter((d): d is string => d !== undefined),
      }
      return marksFromSpots(scaleSpots(rootPc, arpeggio, null))
    }
    return marksFromSpots(scaleSpots(rootPc, scale, position))
  }, [mode, notePcs, quality, rootPc, scale, position])

  const window = mode === 'notes' ? null : voicing ? voicing.window : (position?.window ?? null)

  /* Pentatônica: a diagonal do tom com a forma escolhida desenhada por cima. */
  const isPenta = mode === 'scales' && (scaleId === 'pentaMinor' || scaleId === 'pentaMajor')
  const diag = useMemo(() => {
    if (!isPenta || scaleView !== 'diag') return null
    const t = scaleId === 'pentaMinor' ? 'min' : 'maj'
    const P = computePractice(rootPc, t, PROG_BY[t][0].id, shape)
    /* A forma por cima é a mesma da visão "forma": a caixa da escala na forma escolhida. */
    const box = scaleSpots(rootPc, scale, position)
      .filter((sp) => sp.inShape)
      .map((sp) => ({ s: sp.string, f: sp.fret }))
    return { neck: diagNeck(P, P.diag.notes, box), legend: diagLegend(P, `forma ${shape}`) }
  }, [isPenta, scaleView, scaleId, rootPc, shape, scale, position])

  const scaleMinor = isMinorish(scale.intervals)
  const chordMinor = isMinorish(chordIntervals(quality))
  const canPractice = scale.intervals.length >= 5

  return (
    <main className="wrap screen">
      <div className="screen-head">
        {mode === 'scales' && <ScaleHero rootPc={rootPc} scale={scale} />}
        {mode === 'chords' && <ChordHero rootPc={rootPc} quality={quality} shape={shape} voicing={voicing} />}
        {mode === 'notes' && <NoteHero pcs={notePcs} />}
        <span className="spacer" />
        {mode === 'scales' && canPractice && (
          <button type="button" className="btn btn-primary" onClick={onPractice}>
            {diag ? 'Praticar a diagonal' : 'Praticar esta posição'}
            <ArrowUpRight size={15} strokeWidth={1.8} />
          </button>
        )}
      </div>

      <div className="controls card">
        {mode === 'scales' && (
          <ScaleControls
            rootPc={rootPc}
            minor={scaleMinor}
            shape={shape}
            scaleId={scaleId}
            window={position?.window ?? null}
            onRoot={set('rootPc')}
            onShape={set('shape') as (s: ShapeId) => void}
            onScale={set('scaleId')}
          />
        )}
        {mode === 'scales' && isPenta && (
          <Segmented<ScaleView>
            options={[
              { value: 'box', label: 'forma' },
              { value: 'diag', label: 'diagonal' },
            ]}
            value={scaleView}
            onChange={set('scaleView')}
          />
        )}
        {mode === 'chords' && (
          <ChordControls
            rootPc={rootPc}
            minor={chordMinor}
            shape={shape}
            quality={quality}
            onRoot={set('rootPc')}
            onShape={set('shape')}
            onQuality={set('quality')}
          />
        )}
        {mode === 'notes' && <NoteControls pcs={notePcs} onPcs={set('notePcs')} />}
      </div>

      <div className="screen-fill">
        <Neck
          className="card"
          marks={diag ? diag.neck.marks : marks}
          windows={diag ? diag.neck.windows : window ? [window] : []}
          voicing={diag ? null : voicing}
          frets={diag?.neck.frets}
          focus={diag?.neck.focus}
          legend={diag?.legend}
          labelMode={labelMode}
          showOutside={showOutside}
          outsideLabel={mode === 'notes' ? null : diag ? 'fora das duas' : 'fora da forma'}
          onLabelMode={set('labelMode')}
          onShowOutside={set('showOutside')}
        />
      </div>
    </main>
  )
}
