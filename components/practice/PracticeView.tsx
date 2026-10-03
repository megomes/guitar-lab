'use client'

/* Prática — a "Janela" do CAGED Lab, numa tela só: as escolhas (exercício,
 * posição, tônica) em duas linhas e o exercício em tab e braço, com som.
 */
import { BookOpen } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { DIAG_STARTS, PROG_BY } from '@/lib/practice/caged'
import type { SeqEvent } from '@/lib/practice/audio'
import {
  EXERCISES,
  chordColor,
  exerciseBars,
  exerciseLegend,
  exerciseNeck,
  exerciseText,
  followsChord,
  romanOf,
  shapeOf,
  type Practice,
} from '@/lib/practice/session'
import type { Settings } from '@/lib/settings'
import { tonicLabel } from '@/lib/spelling'
import { FRET_COUNT } from '@/lib/fretboard'
import { nearestWindow } from '@/lib/marks'
import { ALL_PCS } from '@/lib/notes'

import { Neck } from '../Neck'
import { Tab } from '../Tab'
import { Chip, HowDialog, type HowContent } from '../ui'
import { PlayerBar, VisSwitch } from './PlayerBar'
import { usePlayer } from './usePlayer'
import { useSpaceToPlay } from './useSpaceToPlay'

type Setter = <K extends keyof Settings>(key: K) => (value: Settings[K]) => void

interface Props {
  P: Practice
  settings: Settings
  set: Setter
  patch: (p: Partial<Settings>) => void
  onConsult: () => void
}

export function PracticeView({ P, settings, set, patch, onConsult }: Props) {
  const { exercise, vis, chordSel, bpm, click, labelMode, showOutside, tonality, prog } = settings
  const ex = EXERCISES.find((e) => e.id === exercise) ?? EXERCISES[0]
  const sel = Math.min(chordSel, P.chords.length - 1)
  const [how, setHow] = useState<HowContent | null>(null)

  const bars = useMemo(() => exerciseBars(ex.id, P), [ex.id, P])
  const neck = useMemo(() => exerciseNeck(ex.id, P, sel), [ex.id, P, sel])
  const legend = useMemo(() => exerciseLegend(ex.id, P, sel), [ex.id, P, sel])

  /* Ao tocar, o braço acompanha o acorde do compasso. */
  const follow = useCallback(
    (e: SeqEvent) => {
      if (e.ci != null) patch({ chordSel: e.ci })
    },
    [patch],
  )
  const player = usePlayer(bars, ex.cols, bpm, click, follow)
  useSpaceToPlay(player.toggle)

  const openHow = () => {
    const t = exerciseText(ex.id, P)
    setHow({ title: ex.name, how: t.how, steps: t.more, src: t.src })
  }


  /* Arrastar o dedo no braço muda a posição: a que tem as casas debaixo do dedo. */
  const pickPosition = useCallback(
    (fret: number) => {
      /* Cada posição e a mesma uma oitava acima: arrastando, o CAGED dá a volta até a casa 21. */
      const next = nearestWindow(
        P.positions.flatMap((p) => [
          { key: { p, oct: 0 }, window: { from: p.lo, to: p.hi } },
          ...(p.hi + 12 <= FRET_COUNT ? [{ key: { p, oct: 1 }, window: { from: p.lo + 12, to: p.hi + 12 } }] : []),
        ]),
        fret,
      )
      if (next && (next.p.id !== P.pos.id || next.oct !== settings.shapeOct)) patch({ shape: shapeOf(next.p), shapeOct: next.oct })
    },
    [P, patch, settings.shapeOct],
  )

  /* Nos exercícios de escala o solo fica no tom: a progressão não muda nada, então nem aparece. */
  const onChords = followsChord(ex.id)

  return (
    <main className="wrap screen">
      <div className="card tree" role="group" aria-label="Escolhas do exercício">
        <div className="trow">
          <span className="tlbl">Exercício</span>
          <div className="chips chips-scroll">
            {EXERCISES.map((e) => (
              <Chip key={e.id} label={e.short} on={e.id === ex.id} onPress={() => set('exercise')(e.id)} />
            ))}
          </div>
          <button type="button" className="icon-btn icon-btn-line" onClick={onConsult} title="Ver a escala na consulta" aria-label="Ver a escala na consulta">
            <BookOpen size={15} strokeWidth={1.7} />
          </button>
        </div>
        <div className="trow">
          <span className="tlbl">Posição</span>
          <div className="chips chips-scroll">
            {P.positions.map((p) => (
              <Chip
                key={p.id}
                on={p.id === P.pos.id}
                onPress={() => patch({ shape: shapeOf(p), shapeOct: 0 })}
                label={
                  <>
                    {p.label}
                    <small>
                      {p.lo}–{p.hi}
                    </small>
                  </>
                }
              />
            ))}
          </div>
          <div className="tsub">
            {ex.id === 'diag' && (
              <label className="select">
                Sai da
                <select value={settings.diagString} onChange={(e) => set('diagString')(Number(e.target.value))}>
                  {DIAG_STARTS.map((s) => (
                    <option key={s} value={s}>
                      {6 - s}ª corda
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(['min', 'maj'] as const).map((t) => (
              <Chip
                key={t}
                strong
                label={t === 'min' ? 'Menor' : 'Maior'}
                on={tonality === t}
                onPress={() => tonality !== t && patch({ tonality: t, prog: PROG_BY[t][0].id, chordSel: 0 })}
              />
            ))}
            <label className="select">
              <span className="sr-only">Tônica</span>
              <select value={P.tonicPc} onChange={(e) => patch({ rootPc: Number(e.target.value), chordSel: 0 })}>
                {ALL_PCS.map((pc) => (
                  <option key={pc} value={pc}>
                    {tonicLabel(pc, P.minor) + (P.minor ? 'm' : '')}
                  </option>
                ))}
              </select>
            </label>
            {onChords && (
              <label className="select">
                <span className="sr-only">Progressão</span>
                <select value={prog} onChange={(e) => patch({ prog: e.target.value as Settings['prog'], chordSel: 0 })}>
                  {PROG_BY[tonality].map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
      </div>

      <div className="card practice screen-fill">
        <PlayerBar
          playing={player.playing}
          bpm={bpm}
          click={click}
          onToggle={player.toggle}
          onBpm={set('bpm')}
          onClick={() => set('click')(!click)}
          onHow={openHow}
        >
          <VisSwitch value={vis} onChange={set('vis')} />
        </PlayerBar>
        {onChords && (
          <div className="cpills" role="group" aria-label="Acordes da progressão">
            {P.chords.map((c, i) => {
              const on = i === sel
              const inPent = P.pent.includes(c.third)
              return (
                <button
                  key={i}
                  type="button"
                  className={`cpill${on ? ' cpill-on' : ''}`}
                  style={{ ['--c' as string]: chordColor(c) }}
                  aria-pressed={on}
                  onClick={() => patch({ chordSel: i })}
                >
                  <i />
                  <b>{c.name}</b>
                  <small>{romanOf(P, c)}</small>
                  <small className={inPent ? undefined : 'cpill-out'}>terça {P.names(c.third)}</small>
                </button>
              )
            })}
          </div>
        )}
        {vis !== 'neck' && <Tab bars={bars} cols={ex.cols} now={player.now?.key ?? null} strip={vis === 'both'} />}
        {vis !== 'tab' && (
          <Neck
            marks={neck.marks}
            windows={neck.windows}
            rings={neck.rings}
            focus={neck.focus}
            frets={neck.frets}
            now={player.now?.pins}
            legend={legend}
            labelMode={labelMode}
            showOutside={showOutside}
            outsideLabel={ex.id === 'box' ? 'fora da forma' : ex.id === 'diag' ? 'fora das duas' : ex.id === 'zig' ? 'fora das formas' : ex.id === 'neck' ? null : 'fora da posição'}
            onLabelMode={set('labelMode')}
            onShowOutside={set('showOutside')}
            onPick={ex.id === 'neck' || ex.id === 'zig' ? undefined : pickPosition}
          />
        )}
      </div>

      <HowDialog content={how} onClose={() => setHow(null)} />
    </main>
  )
}
