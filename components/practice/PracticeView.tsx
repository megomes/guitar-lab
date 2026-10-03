'use client'

/* Prática — a "Janela" do CAGED Lab: a árvore de escolhas (ver, exercício,
 * posição, tônica), os acordes da progressão e o exercício em tab e braço, com som.
 */
import { BookOpen } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { PROG_BY } from '@/lib/practice/caged'
import type { SeqEvent } from '@/lib/practice/audio'
import {
  EXERCISES,
  chordColor,
  exerciseBars,
  exerciseLegend,
  exerciseNeck,
  exerciseText,
  followsChord,
  modeName,
  romanOf,
  shapeOf,
  tonicName,
  type Practice,
} from '@/lib/practice/session'
import type { Settings } from '@/lib/settings'
import { tonicLabel } from '@/lib/spelling'
import { ALL_PCS } from '@/lib/notes'

import { Neck } from '../Neck'
import { Tab } from '../Tab'
import { Chip, Eyebrow, HowDialog, type HowContent } from '../ui'
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


  const tonic = `${tonicName(P)} ${modeName(P)}`
  /* Nos exercícios de escala o solo fica no tom: a progressão não muda nada, então nem aparece. */
  const onChords = followsChord(ex.id)

  return (
    <main className="wrap stack">
      <section className="intro">
        <Eyebrow group="Treino · Prática">{` · posição ${P.pos.id}`}</Eyebrow>
        <div className="intro-row">
          <h1 className="headline">
            {ex.name} <span className="dim">em</span> <em>{tonic}</em>
          </h1>
          <button type="button" className="btn btn-ghost" onClick={onConsult}>
            <BookOpen size={15} strokeWidth={1.7} />
            Ver a escala na consulta
          </button>
        </div>
        <p className="lede">
          Posição {P.pos.id}, forma {P.pos.label}, casas {P.pos.lo} a {P.pos.hi}.
          {onChords ? ` Progressão ${P.chords.map((c) => c.name).join(' · ')}.` : ` Só a escala de ${tonic}, sem progressão.`}
        </p>
      </section>

      <div className="card tree" role="group" aria-label="Escolhas do exercício">
        <div className="trow">
          <span className="tlbl">
            <i>1</i>Ver
          </span>
          <div className="chips chips-scroll">
            <VisSwitch value={vis} onChange={set('vis')} />
          </div>
        </div>
        <div className="trow">
          <span className="tlbl">
            <i>2</i>Exercício
          </span>
          <div className="chips chips-scroll">
            {EXERCISES.map((e) => (
              <Chip key={e.id} label={e.name} on={e.id === ex.id} onPress={() => set('exercise')(e.id)} />
            ))}
          </div>
        </div>
        <div className="trow">
          <span className="tlbl">
            <i>3</i>Posição
          </span>
          <div className="chips chips-scroll">
            {P.positions.map((p) => (
              <Chip
                key={p.id}
                on={p.id === P.pos.id}
                onPress={() => set('shape')(shapeOf(p))}
                label={
                  <>
                    {p.id} · forma {p.label}
                    <small>casas {p.lo} a {p.hi}</small>
                  </>
                }
              />
            ))}
          </div>
        </div>
        <div className="trow">
          <span className="tlbl">
            <i>4</i>Tônica
          </span>
          <div className="chips chips-scroll">
            {(['min', 'maj'] as const).map((t) => (
              <Chip
                key={t}
                strong
                label={t === 'min' ? 'Menor' : 'Maior'}
                on={tonality === t}
                onPress={() => tonality !== t && patch({ tonality: t, prog: PROG_BY[t][0].id, chordSel: 0 })}
              />
            ))}
            <span className="tsep" />
            {ALL_PCS.map((pc) => (
              <Chip
                key={pc}
                label={tonicLabel(pc, P.minor) + (P.minor ? 'm' : '')}
                on={pc === P.tonicPc}
                onPress={() => patch({ rootPc: pc, chordSel: 0 })}
              />
            ))}
          </div>
          <label className="select">
            Progressão
            <select value={prog} onChange={(e) => patch({ prog: e.target.value as Settings['prog'], chordSel: 0 })}>
              {PROG_BY[tonality].map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {onChords && (
        <div className="cchips">
          {P.chords.map((c, i) => {
            const on = i === sel
            const inPent = P.pent.includes(c.third)
            return (
              <button
                key={i}
                type="button"
                className={`cchip${on ? ' cchip-on' : ''}`}
                style={{ ['--c' as string]: chordColor(c) }}
                aria-pressed={on}
                onClick={() => patch({ chordSel: i })}
              >
                <span className="coin">{c.name}</span>
                <span className="cc-txt">
                  <b>
                    {c.name}
                    <span>{romanOf(P, c)}</span>
                  </b>
                  <small>forma {c.voicing.nm}</small>
                </span>
                <span className={`tgt${inPent ? '' : ' tgt-out'}`}>
                  <small>terça</small>
                  <b>{P.names(c.third)}</b>
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className="card practice">
        <PlayerBar
          playing={player.playing}
          bpm={bpm}
          click={click}
          onToggle={player.toggle}
          onBpm={set('bpm')}
          onClick={() => set('click')(!click)}
          onHow={openHow}
        />
        {vis !== 'neck' && <Tab bars={bars} cols={ex.cols} now={player.now?.key ?? null} />}
        {vis !== 'tab' && (
          <Neck
            marks={neck.marks}
            windows={neck.windows}
            rings={neck.rings}
            focus={neck.focus}
            shifts={neck.shifts}
            frets={neck.frets}
            now={player.now?.pins}
            legend={legend}
            labelMode={labelMode}
            showOutside={showOutside}
            outsideLabel={ex.id === 'box' ? 'fora da forma' : ex.id === 'diag' ? 'fora da diagonal' : ex.id === 'zig' ? 'fora das formas' : ex.id === 'neck' ? null : 'fora da posição'}
            onLabelMode={set('labelMode')}
            onShowOutside={set('showOutside')}
          />
        )}
      </div>

      <HowDialog content={how} onClose={() => setHow(null)} />
    </main>
  )
}
