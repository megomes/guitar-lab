'use client'

/* Consulta — o Fretlab: escalas na forma CAGED, acordes nas cinco formas e o
 * mapa de notas. Numa tela só, sem rolar: o nome e as notas em cima, os
 * controles numa faixa, e o braço com todo o resto da altura.
 */
import { ArrowUpRight } from 'lucide-react'
import { useMemo } from 'react'

import { chordIntervals, chordSymbol, chordVoicing, QUALITIES } from '@/lib/chords'
import { SCALES, SHAPE_IDS, boxFor, scaleSpots, type Scale, type ShapeId } from '@/lib/fretboard'
import { marksFromSpots, nearestWindow } from '@/lib/marks'
import { noteSpots } from '@/lib/notes'
import { PROG_BY } from '@/lib/practice/caged'
import { computePractice, diagLegend, diagNeck } from '@/lib/practice/session'
import type { ScaleView, Settings } from '@/lib/settings'
import { isMinorish } from '@/lib/spelling'
import { INVERSION_NAME, STRING_SETS, closedTriads, hasTriad, setLabel } from '@/lib/triads'

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
  const { mode, rootPc, scaleId, shape, labelMode, showOutside, quality, notePcs, scaleView, chordView, triadSet } = settings

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

  /* Acordes em tríades: as três inversões fechadas no grupo de cordas, subindo o braço,
     cada uma num vão com o nome; o resto do arpejo fica fantasma. */
  const triads = useMemo(() => {
    if (mode !== 'chords' || chordView !== 'triads' || !hasTriad(quality)) return null
    const set = STRING_SETS[triadSet] ?? STRING_SETS[0]
    const shapes = closedTriads(rootPc, quality, set)
    const lit = (s: number, f: number) => shapes.some((t) => t.notes.some((n) => n.string === s && n.fret === f))
    return {
      label: setLabel(set),
      marks: marks.map((m) => ({ ...m, level: lit(m.string, m.fret) ? ('on' as const) : ('ghost' as const) })),
      windows: shapes.map((t) => ({ from: t.from, to: t.to, label: INVERSION_NAME[t.inv] })),
    }
  }, [mode, chordView, quality, triadSet, rootPc, marks])

  /* Arrastar o dedo no braço leva a forma CAGED junto: a que tem o vão debaixo do dedo. */
  const onPick = useMemo(() => {
    if (mode === 'notes' || triads) return undefined
    const options = SHAPE_IDS.map((id) => ({
      key: id,
      window: mode === 'chords' ? (chordVoicing(rootPc, quality, id)?.window ?? null) : (boxFor(rootPc, id, scale)?.window ?? null),
    }))
    return (fret: number) => {
      const next = nearestWindow(options, fret)
      if (next && next !== shape) set('shape')(next)
    }
  }, [mode, triads, rootPc, quality, scale, shape, set])

  const scaleMinor = isMinorish(scale.intervals)
  const chordMinor = isMinorish(chordIntervals(quality))
  const canPractice = scale.intervals.length >= 5

  return (
    <main className="wrap screen">
      <div className="screen-head">
        {mode === 'scales' && <ScaleHero rootPc={rootPc} scale={scale} />}
        {mode === 'chords' && <ChordHero rootPc={rootPc} quality={quality} shape={shape} voicing={voicing} triads={triads?.label} />}
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
            view={chordView}
            triadSet={triadSet}
            onRoot={set('rootPc')}
            onShape={set('shape')}
            onQuality={set('quality')}
            onView={set('chordView')}
            onTriadSet={set('triadSet')}
          />
        )}
        {mode === 'notes' && <NoteControls pcs={notePcs} onPcs={set('notePcs')} />}
      </div>

      <div className="screen-fill">
        <Neck
          className="card"
          marks={diag ? diag.neck.marks : triads ? triads.marks : marks}
          windows={diag ? diag.neck.windows : triads ? triads.windows : window ? [window] : []}
          voicing={diag || triads ? null : voicing}
          frets={diag?.neck.frets}
          focus={diag?.neck.focus}
          legend={diag?.legend}
          labelMode={labelMode}
          showOutside={showOutside}
          outsideLabel={mode === 'notes' ? null : diag ? 'fora das duas' : triads ? 'resto do arpejo' : 'fora da forma'}
          onLabelMode={set('labelMode')}
          onShowOutside={set('showOutside')}
          onPick={onPick}
        />
      </div>
    </main>
  )
}
