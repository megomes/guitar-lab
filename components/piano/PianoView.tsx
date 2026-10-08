'use client'

/* A consulta do Piano Lab: o acorde (com as inversões) e a escala numa oitava, no
 * teclado. A tônica é a mesma do resto do app; as cores dos papéis também. */
import { Play, Volume2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { QUALITIES, type QualityId } from '@/lib/chords'
import { SCALES } from '@/lib/fretboard'
import {
  INVERSION_NAMES,
  INVERSION_SHORT,
  NINTHS,
  NINTH_LABEL,
  SEVENTH_LABEL,
  TRIADS,
  pianoScale,
  pianoVoicing,
  seventhsFor,
  specBass,
  specIntervals,
  specName,
  specSize,
  specSuffix,
  type ChordSpec,
  type PianoNote,
} from '@/lib/piano'
import { PianoSynth } from '@/lib/piano-synth'
import { ROLE_COLOR, ROLE_NAME, ROLES, degreeColor } from '@/lib/roles'
import type { Settings } from '@/lib/settings'
import { isMinorish, spellDegree } from '@/lib/spelling'

import { CGroup, Tonics } from '../consult/Controls'
import { Pip, ScaleHero } from '../consult/Hero'
import { useNames } from '../names'
import { Chip, Legend } from '../ui'
import { Keyboard, type KeyMark } from './Keyboard'
import { PianoChordStage, PianoScaleStage } from './PianoStage'
import { useNoteInput } from './useNoteInput'

const qualityLabel = (id: QualityId) => (QUALITIES[id].symbol === '' ? 'maior' : QUALITIES[id].symbol)
const LEGEND = ROLES.map((role) => ({ kind: 'dot' as const, color: ROLE_COLOR[role], text: ROLE_NAME[role] }))

interface Props {
  view: 'chords' | 'scales'
  settings: Settings
  set: <K extends keyof Settings>(key: K) => (value: Settings[K]) => void
  patch: (p: Partial<Settings>) => void
}

export function PianoView({ view, settings, set, patch }: Props) {
  const nn = useNames()
  const { rootPc, pQuality: quality, pSeventh: seventh, pNinth: ninth, pInversion, pScaleId } = settings
  const scale = useMemo(() => SCALES.find((s) => s.id === pScaleId) ?? SCALES[0], [pScaleId])
  const spec: ChordSpec = useMemo(() => ({ root: rootPc, triad: quality, seventh, ninth }), [rootPc, quality, seventh, ninth])
  const size = specSize(spec)
  const inversion = pInversion % size

  const notes: PianoNote[] = useMemo(
    () => (view === 'chords' ? pianoVoicing(spec, inversion) : pianoScale(rootPc, scale)),
    [view, spec, rootPc, inversion, scale],
  )

  const synth = useRef<PianoSynth | null>(null)
  const sound = () => (synth.current ??= new PianoSynth())
  useEffect(() => () => synth.current?.dispose(), [])

  /* O que está soando: o que se toca e a sequência do botão. */
  const [playing, setPlaying] = useState<number[]>([])
  const input = useNoteInput({
    onNoteOn: (m, v) => sound().noteOn(m, v),
    onNoteOff: (m) => sound().noteOff(m),
  })

  const playChord = useCallback(
    (arp: boolean) => {
      const midis = notes.map((n) => n.midi)
      if (arp) sound().play(midis, { gap: 170, onStep: (m) => setPlaying(m === null ? [] : [m]) })
      else {
        sound().play(midis, { hold: 1200, onStep: (m) => setPlaying(m === null ? [] : midis) })
      }
    },
    [notes],
  )
  const playScale = useCallback(() => {
    const up = notes.map((n) => n.midi)
    sound().play([...up, ...up.slice(0, -1).reverse()], { gap: 260, onStep: (m) => setPlaying(m === null ? [] : [m]) })
  }, [notes])

  /* Trocou o acorde ou a escala: para o que estava tocando. */
  useEffect(() => {
    synth.current?.stop()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlaying([])
  }, [notes])

  /* No acorde, cada nota pela letra do grau; na escala, a grafia do tom já resolve. */
  const spell = useCallback((n: PianoNote) => (view === 'chords' ? spellDegree(nn(rootPc), n.pc, n.degree) : nn(n.pc)), [view, nn, rootPc])

  const marks = useMemo(() => {
    const m = new Map<number, KeyMark>()
    notes.forEach((n) => m.set(n.midi, { color: degreeColor(n.degree), note: spell(n), degree: n.degree }))
    return m
  }, [notes, spell])
  const lit = useMemo(() => new Set([...input.pressed, ...playing]), [input.pressed, playing])

  const minor = isMinorish(view === 'chords' ? specIntervals(spec) : scale.intervals)
  const symbol = nn(rootPc) + specSuffix(spec) + (inversion > 0 ? `/${nn(specBass(spec, inversion))}` : '')
  /* Trocou a tríade: a sétima que não existe nela volta para nenhuma. */
  const onTriad = (q: QualityId) => patch({ pQuality: q, pSeventh: seventhsFor(q).includes(seventh) ? seventh : 'none' })

  return (
    <main className="wrap screen piano">
      <div className="screen-head consult-head">
        {view === 'chords' ? (
          <>
            <h1 className="screen-title">
              {symbol}
              <small>
                {specName(spec)} · {INVERSION_NAMES[inversion]}
              </small>
            </h1>
            <div className="pips">
              {notes.map((n) => (
                <Pip key={n.midi} top={n.degree} main={spell(n)} degree={n.degree} />
              ))}
            </div>
          </>
        ) : (
          <ScaleHero rootPc={rootPc} scale={scale} />
        )}
        <span className="spacer" />
        {view === 'chords' ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => playChord(true)}>
              <Play size={13} strokeWidth={2} />
              Arpejo
            </button>
            <button type="button" className="btn btn-primary" onClick={() => playChord(false)}>
              <Volume2 size={14} strokeWidth={1.8} />
              Tocar o acorde
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={playScale}>
            <Play size={13} strokeWidth={2} />
            Tocar a escala
          </button>
        )}
      </div>

      <div className="controls card">
        <Tonics rootPc={rootPc} minor={minor} onRoot={set('rootPc')} />
        {view === 'chords' ? (
          <>
            <CGroup label="Tríade">
              {TRIADS.map((id) => (
                <Chip key={id} label={qualityLabel(id)} fixed on={quality === id} onPress={() => onTriad(id)} />
              ))}
            </CGroup>
            <CGroup label="Sétima" hint="ou a sexta">
              {seventhsFor(quality).map((v) => (
                <Chip key={v} label={SEVENTH_LABEL(v)} fixed on={seventh === v} onPress={() => set('pSeventh')(v)} />
              ))}
            </CGroup>
            <CGroup label="Nona">
              {NINTHS.map((v) => (
                <Chip key={v} label={NINTH_LABEL(v)} fixed on={ninth === v} onPress={() => set('pNinth')(v)} />
              ))}
            </CGroup>
            <CGroup label="Inversão" hint="a nota do baixo">
              {INVERSION_SHORT.slice(0, size).map((label, i) => (
                <Chip key={label} label={label} fixed on={inversion === i} onPress={() => set('pInversion')(i)} />
              ))}
            </CGroup>
          </>
        ) : (
          <label className="select">
            Escala
            <select value={pScaleId} onChange={(e) => set('pScaleId')(e.target.value)}>
              {SCALES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {view === 'chords' ? (
        <PianoChordStage spec={spec} symbol={nn(rootPc) + specSuffix(spec)} inversion={inversion} onRoot={set('rootPc')} onInversion={set('pInversion')} />
      ) : (
        <PianoScaleStage rootPc={rootPc} scale={scale} onRoot={set('rootPc')} onChord={(root, q) => patch({ mode: 'pChords', rootPc: root, pQuality: q, pSeventh: 'none', pNinth: 'none', pInversion: 0 })} />
      )}

      <div className="screen-fill">
        <section className="viewport card piano-viewport" aria-label="teclado">
          <div className="viewport-bar">
            <Legend items={LEGEND} />
            <span className="piano-hint">toque na tela, no teclado do computador (Z…M, Q…P) ou num controlador MIDI</span>
          </div>
          <div className="kb-wrap">
            <Keyboard marks={marks} lit={lit} onDown={input.noteOn} onUp={input.noteOff} />
          </div>
        </section>
      </div>
    </main>
  )
}
