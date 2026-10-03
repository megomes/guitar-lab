'use client'

/* Consulta — o Fretlab: escalas na forma CAGED, acordes nas cinco formas e o
 * mapa de notas. Configuração à esquerda, análise à direita, o braço no meio.
 */
import { ArrowUpRight } from 'lucide-react'
import { useMemo } from 'react'

import { chordIntervals, chordSymbol, chordVoicing, QUALITIES, type QualityId } from '@/lib/chords'
import { SCALES, boxFor, scaleSpots, type Scale, type ShapeId } from '@/lib/fretboard'
import { marksFromSpots } from '@/lib/marks'
import { noteSpots } from '@/lib/notes'
import { PROG_BY } from '@/lib/practice/caged'
import { computePractice, diagLegend, diagNeck } from '@/lib/practice/session'
import type { ScaleView, Settings } from '@/lib/settings'
import { isMinorish } from '@/lib/spelling'

import { Neck } from '../Neck'
import { Segmented } from '../ui'
import { ChordHero, NoteHero, ScaleHero } from './Hero'
import { ChordInsights, NoteInsights, ScaleInsights } from './Insights'
import { ChordSidebar, NoteSidebar, ScaleSidebar } from './Sidebars'

type Setter = <K extends keyof Settings>(key: K) => (value: Settings[K]) => void

interface Props {
  settings: Settings
  set: Setter
  onOpenChord: (root: number, quality: QualityId) => void
  onPractice: () => void
}

export function ConsultView({ settings, set, onOpenChord, onPractice }: Props) {
  const { mode, rootPc, scaleId, shape, labelMode, showOutside, lookup, quality, notePcs, scaleView } = settings

  const scale = useMemo(() => SCALES.find((s) => s.id === scaleId) ?? SCALES[0], [scaleId])
  const position = useMemo(() => boxFor(rootPc, shape, scale), [rootPc, shape, scale])

  /* A digitação na tela: a consultada por cima da escala, a do modo Acordes, e nada no mapa de notas. */
  const voicing = useMemo(() => {
    if (mode === 'chords') return chordVoicing(rootPc, quality, shape)
    if (mode === 'scales' && lookup) return chordVoicing(rootPc, lookup, shape)
    return null
  }, [mode, rootPc, quality, lookup, shape])

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
    return marksFromSpots(scaleSpots(rootPc, scale, position), !!voicing)
  }, [mode, notePcs, quality, rootPc, scale, position, voicing])

  const window = mode === 'notes' ? null : voicing ? voicing.window : (position?.window ?? null)

  /* Pentatônica: a diagonal que passa pela forma escolhida, com a escada das formas CAGED. */
  const isPenta = mode === 'scales' && (scaleId === 'pentaMinor' || scaleId === 'pentaMajor')
  const diag = useMemo(() => {
    if (!isPenta || scaleView !== 'diag') return null
    const t = scaleId === 'pentaMinor' ? 'min' : 'maj'
    const P = computePractice(rootPc, t, PROG_BY[t][0].id, shape)
    return { neck: diagNeck(P, P.diag.notes, (p) => `forma ${p.label[0]}`), legend: diagLegend(P) }
  }, [isPenta, scaleView, scaleId, rootPc, shape])

  const scaleMinor = isMinorish(scale.intervals)
  const chordMinor = isMinorish(chordIntervals(quality))
  const canPractice = scale.intervals.length >= 5

  return (
    <main className="wrap workspace">
      <div className="region region-left">
        {mode === 'scales' && (
          <ScaleSidebar
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
        {mode === 'chords' && (
          <ChordSidebar
            rootPc={rootPc}
            minor={chordMinor}
            shape={shape}
            quality={quality}
            onRoot={set('rootPc')}
            onShape={set('shape')}
            onQuality={set('quality')}
          />
        )}
        {mode === 'notes' && <NoteSidebar pcs={notePcs} onPcs={set('notePcs')} />}
      </div>

      <div className="region region-center">
        {mode === 'scales' && (
          <ScaleHero rootPc={rootPc} scale={scale} shape={shape} window={position?.window ?? null} quality={lookup}>
            {canPractice && (
              <div className="bridge">
                <button type="button" className="btn btn-primary" onClick={onPractice}>
                  Praticar esta posição
                  <ArrowUpRight size={15} strokeWidth={1.8} />
                </button>
              </div>
            )}
          </ScaleHero>
        )}
        {mode === 'chords' && <ChordHero rootPc={rootPc} quality={quality} shape={shape} voicing={voicing} />}
        {mode === 'notes' && <NoteHero pcs={notePcs} />}
      </div>

      <div className="region region-right">
        {mode === 'scales' && (
          <ScaleInsights
            rootPc={rootPc}
            scale={scale}
            shape={shape}
            lookup={lookup}
            voicing={voicing}
            onLookup={set('lookup')}
            onOpenChord={onOpenChord}
          />
        )}
        {mode === 'chords' && <ChordInsights rootPc={rootPc} quality={quality} shape={shape} onShape={set('shape')} />}
        {mode === 'notes' && <NoteInsights pcs={notePcs} />}
      </div>

      <div className="region region-neck">
        <Neck
          className="card"
          size="lg"
          marks={diag ? diag.neck.marks : marks}
          windows={diag ? diag.neck.windows : window ? [window] : []}
          voicing={diag ? null : voicing}
          shifts={diag?.neck.shifts}
          frets={diag?.neck.frets}
          focus={diag?.neck.focus}
          legend={diag?.legend}
          labelMode={labelMode}
          showOutside={showOutside}
          outsideLabel={mode === 'notes' ? null : diag ? 'fora da diagonal' : 'fora da forma'}
          onLabelMode={set('labelMode')}
          onShowOutside={set('showOutside')}
          extra={
            isPenta ? (
              <Segmented<ScaleView>
                options={[
                  { value: 'box', label: 'forma' },
                  { value: 'diag', label: 'diagonal' },
                ]}
                value={scaleView}
                onChange={set('scaleView')}
              />
            ) : undefined
          }
        />
      </div>
    </main>
  )
}
