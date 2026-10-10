'use client'

/* Consulta — o Fretlab: escalas na forma CAGED, acordes nas cinco formas e o
 * mapa de notas. Numa tela só, sem rolar: o nome e as notas em cima, os
 * controles numa faixa, e o braço com todo o resto da altura.
 */
import { ArrowUpRight } from 'lucide-react'
import { useMemo } from 'react'

import { chordIntervals, chordSymbol, chordVoicing, shiftVoicing, QUALITIES } from '@/lib/chords'
import { SCALES, SHAPE_IDS, boxFor, shapeLabel, scaleSpots, shiftPosition, type Scale, type ShapeId } from '@/lib/fretboard'
import { marksFromSpots, nearestWindow } from '@/lib/marks'
import { noteSpots, togglePc } from '@/lib/notes'
import { DIAG_STARTS, PROG_BY } from '@/lib/practice/caged'
import { computePractice, diagLegend, diagNeck } from '@/lib/practice/session'
import type { ScaleView, Settings } from '@/lib/settings'
import { isMinorish } from '@/lib/spelling'
import { INVERSION_NAME, STRING_SETS, closedTriads, hasTriad, setLabel } from '@/lib/triads'

import { Neck } from '../Neck'
import { Chip, Segmented } from '../ui'
import { CGroup, ChordControls, NoteControls, ScaleBar, ScaleControls } from './Controls'
import { ChordHero, NoteHero, ScaleHero } from './Hero'
import { ChordStage, NoteStage, ScaleStage, StageSwap, StageZoom } from './Stage'

type Setter = <K extends keyof Settings>(key: K) => (value: Settings[K]) => void

interface Props {
  settings: Settings
  set: Setter
  patch: (p: Partial<Settings>) => void
  onPractice: () => void
  /** Do mapa de notas para o jogo, com as mesmas notas. */
  onQuiz: () => void
}

/* A forma na oitava escolhida: o CAGED recomeça depois do D, até a casa 21. */
const atOct = <T,>(x: T | null, oct: number, shift: (x: T, by: number) => T | null): T | null => (x && oct ? (shift(x, 12) ?? x) : x)

export function ConsultView({ settings, set, patch, onPractice, onQuiz }: Props) {
  const { mode, rootPc, scaleId, shape, labelMode, showOutside, quality, notePcs, scaleView, chordView, triadSet } = settings

  const scale = useMemo(() => SCALES.find((s) => s.id === scaleId) ?? SCALES[0], [scaleId])
  const { shapeOct, diagString } = settings
  const position = useMemo(() => atOct(boxFor(rootPc, shape, scale), shapeOct, shiftPosition), [rootPc, shape, scale, shapeOct])

  /* A digitação na tela: só no modo Acordes. */
  const voicing = useMemo(
    () => (mode === 'chords' ? atOct(chordVoicing(rootPc, quality, shape), shapeOct, shiftVoicing) : null),
    [mode, rootPc, quality, shape, shapeOct],
  )

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

  const w = mode === 'notes' ? null : voicing ? voicing.window : (position?.window ?? null)
  /* A letra da forma em cima da faixa, para nunca ficar a dúvida de qual forma está acesa. */
  const window = w && { ...w, label: shapeLabel(shape, isMinorish(mode === 'scales' ? scale.intervals : chordIntervals(quality))) }

  /* Pentatônica: a diagonal do tom com a forma escolhida desenhada por cima. */
  const isPenta = mode === 'scales' && (scaleId === 'pentaMinor' || scaleId === 'pentaMajor')
  const diag = useMemo(() => {
    if (!isPenta || scaleView !== 'diag') return null
    const t = scaleId === 'pentaMinor' ? 'min' : 'maj'
    const P = computePractice(rootPc, t, PROG_BY[t][0].id, shape, shapeOct, diagString)
    /* A forma por cima é a mesma da visão "forma": a caixa da escala na forma escolhida. */
    const box = scaleSpots(rootPc, scale, position)
      .filter((sp) => sp.inShape)
      .map((sp) => ({ s: sp.string, f: sp.fret }))
    return { neck: diagNeck(P, P.diag.notes, box, shapeLabel(shape, t === 'min')), legend: diagLegend(P, `forma ${shapeLabel(shape, t === 'min')}`) }
  }, [isPenta, scaleView, scaleId, rootPc, shape, scale, position, shapeOct, diagString])

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
      windows: shapes.map((t) => ({ from: t.from, to: t.to, label: INVERSION_NAME[t.inv], strings: [set[0], set[2]] as [number, number] })),
    }
  }, [mode, chordView, quality, triadSet, rootPc, marks])

  /* Arrastar o dedo no braço leva a forma CAGED junto: a que tem o vão debaixo do dedo. */
  const onPick = useMemo(() => {
    if (mode === 'notes') return undefined
    /* Nas tríades o dedo escolhe o grupo de cordas: o que tem a corda tocada no meio. */
    if (triads)
      return (_fret: number, string: number) => {
        const next = Math.max(0, Math.min(STRING_SETS.length - 1, string - 1))
        if (next !== triadSet) set('triadSet')(next)
      }
    /* Cada forma em cada oitava que cabe: arrastando, o CAGED dá a volta até a casa 21. */
    const options = SHAPE_IDS.flatMap((id) => {
      const w = mode === 'chords' ? (chordVoicing(rootPc, quality, id)?.window ?? null) : (boxFor(rootPc, id, scale)?.window ?? null)
      if (!w) return []
      const up = w.to + 12 <= 21 ? [{ key: { id, oct: 1 }, window: { from: w.from + 12, to: w.to + 12 } }] : []
      return [{ key: { id, oct: 0 }, window: w }, ...up]
    })
    return (fret: number) => {
      const next = nearestWindow(options, fret)
      if (next && (next.id !== shape || next.oct !== shapeOct)) patch({ shape: next.id, shapeOct: next.oct })
    }
  }, [mode, triads, triadSet, set, rootPc, quality, scale, shape, shapeOct, patch])

  const scaleMinor = isMinorish(scale.intervals)
  const chordMinor = isMinorish(chordIntervals(quality))
  const canPractice = scale.intervals.length >= 5

  const zoom = { on: settings.stageZoom, toggle: () => set('stageZoom')(!settings.stageZoom) }

  return (
    <StageZoom.Provider value={zoom}>
    <main className={`wrap screen${zoom.on ? ' screen-zoom' : ''}`}>
      <div className="screen-head consult-head">
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
        {mode === 'notes' && notePcs.length > 0 && (
          <button type="button" className="btn btn-primary" onClick={onQuiz}>
            Decorar estas notas
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
            window={position?.window ?? null}
            onRoot={set('rootPc')}
            onShape={(s: ShapeId) => patch({ shape: s, shapeOct: 0 })}
          />
        )}
        {diag && (
          <CGroup label="Sai da" hint="corda da raiz">
            {DIAG_STARTS.map((s) => (
              <Chip key={s} label={`${6 - s}ª`} fixed on={diagString === s} onPress={() => set('diagString')(s)} />
            ))}
          </CGroup>
        )}
        {/* Só a pentatônica tem diagonal; nas outras o seletor fica guardado, invisível, para a
            faixa de controles não mudar de altura ao trocar de escala. */}
        {mode === 'scales' && (
          <span className="seg-slot" style={isPenta ? undefined : { visibility: 'hidden' }} aria-hidden={!isPenta} inert={!isPenta}>
          <Segmented<ScaleView>
            options={[
              { value: 'box', label: 'forma' },
              { value: 'diag', label: 'diagonal' },
            ]}
            value={scaleView}
            onChange={set('scaleView')}
          />
          </span>
        )}
        {mode === 'scales' && (
          <ScaleBar rootPc={rootPc} scaleId={scaleId} onScale={set('scaleId')} onRelative={(pc, id) => patch({ rootPc: pc, scaleId: id })} />
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
            onShape={(s: ShapeId) => patch({ shape: s, shapeOct: 0 })}
            onQuality={set('quality')}
            onView={set('chordView')}
            onTriadSet={set('triadSet')}
          />
        )}
        {mode === 'notes' && <NoteControls pcs={notePcs} onPcs={set('notePcs')} />}
      </div>

      {mode === 'scales' && (
        <ScaleStage
          rootPc={rootPc}
          scale={scale}
          shape={shape}
          onRoot={set('rootPc')}
          onShape={(s) => patch({ shape: s, shapeOct: 0 })}
        />
      )}
      {mode === 'chords' && (
        <ChordStage
          rootPc={rootPc}
          quality={quality}
          shape={shape}
          triadSet={triadSet}
          triads={!!triads}
          onRoot={set('rootPc')}
          onShape={(s) => patch({ shape: s, shapeOct: 0 })}
        />
      )}
      {mode === 'notes' && <NoteStage pcs={notePcs} onToggle={(pc) => set('notePcs')(togglePc(notePcs, pc))} />}

      <div className="screen-fill">
        <StageSwap />
        <Neck
          className="card"
          marks={diag ? diag.neck.marks : triads ? triads.marks : marks}
          windows={diag ? diag.neck.windows : triads ? triads.windows : window ? [window] : []}
          voicing={diag || triads ? null : voicing}
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
    </StageZoom.Provider>
  )
}
