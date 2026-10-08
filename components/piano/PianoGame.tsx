'use client'

/* O jogo do Piano Lab, do ChordLab: o app pede um acorde, você toca, ele julga.
 *
 * Toca-se no controlador MIDI, no teclado do computador ou na tela. Na tela não dá
 * para apertar três teclas de uma vez, então lá cada toque liga ou desliga a
 * tecla, e o acorde é julgado quando as notas fecham. A dica nunca aparece de
 * saída: só depois de alguns erros no mesmo acorde, ou no "Não sei".
 */
import { Eye, Flame, Keyboard as KeyboardIcon, RotateCcw, SkipForward, Timer, Volume2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { QUALITIES, QUALITY_IDS, chordIntervals, type QualityId } from '@/lib/chords'
import {
  INVERSION_NAMES,
  INVERSION_SHORT,
  challengeNotes,
  groupOf,
  judge,
  KEY_OPTIONS,
  parseKey,
  pickChallenge,
  romanOf,
  type Challenge,
} from '@/lib/piano'
import { PianoSynth } from '@/lib/piano-synth'
import { degreeColor } from '@/lib/roles'
import { DEFAULTS, type Settings } from '@/lib/settings'
import { isMinorish, namesForTonic, sharpNames, spellDegree, type Names } from '@/lib/spelling'

import { Pip } from '../consult/Hero'
import { Chip, Switch } from '../ui'
import { Keyboard, type KeyMark, type KeyTone } from './Keyboard'
import { useNoteInput, type MidiStatus } from './useNoteInput'

const CORRECT_DELAY = 650
const WRONG_DELAY = 950

const secs = (ms: number) => `${(ms / 1000).toFixed(2)} s`

const MIDI_TEXT: Record<MidiStatus, string> = {
  idle: 'conectar MIDI',
  connecting: 'conectando…',
  connected: 'MIDI conectado',
  empty: 'nenhum MIDI',
  denied: 'MIDI negado',
  unsupported: 'sem MIDI aqui',
}

type Verdict = { kind: 'idle' } | { kind: 'correct'; ms: number } | { kind: 'wrong'; played: number[] }

interface Session {
  right: number
  wrong: number
  streak: number
  best: number
  times: number[]
  /** Os acordes que mais escapam, pela cifra. */
  misses: Record<string, number>
}

const EMPTY: Session = { right: 0, wrong: 0, streak: 0, best: 0, times: [], misses: {} }

interface Props {
  settings: Settings
  set: <K extends keyof Settings>(key: K) => (value: Settings[K]) => void
}

export function PianoGame({ settings, set }: Props) {
  const { pgQualities: qualities, pgInversions: inversions, pgKey: keyId, pgReveal: revealAfter, pgBass: requireBass, pgSound: soundOn } = settings

  const synth = useRef<PianoSynth | null>(null)
  const sound = () => (synth.current ??= new PianoSynth())
  useEffect(() => () => synth.current?.dispose(), [])
  useEffect(() => {
    if (synth.current) synth.current.enabled = soundOn
  }, [soundOn])
  const noteOn = (m: number, v = 96) => soundOn && sound().noteOn(m, v)
  const noteOff = (m: number) => synth.current?.noteOff(m)

  const input = useNoteInput({ onNoteOn: (m, v) => noteOn(m, v), onNoteOff: noteOff })
  /* As teclas ligadas pelo dedo na tela. */
  const [latched, setLatched] = useState<number[]>([])
  const pressed = useMemo(() => [...new Set([...input.pressed, ...latched])].sort((a, b) => a - b), [input.pressed, latched])

  const [chord, setChord] = useState<Challenge | null>(null)
  const [misses, setMisses] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [verdict, setVerdict] = useState<Verdict>({ kind: 'idle' })
  const [tones, setTones] = useState<Map<number, KeyTone>>(new Map())
  const [session, setSession] = useState<Session>(EMPTY)

  const askedAt = useRef(0)
  const missCount = useRef(0)
  const locked = useRef(false)
  const armed = useRef(true)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms))
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  /* A grafia: a do tom escolhido; no cromático, a de cada acorde. */
  const key = parseKey(keyId)
  const names: Names = useMemo(() => {
    if (key) return namesForTonic(key.tonic, key.minor)
    if (chord) return namesForTonic(chord.root, isMinorish(chordIntervals(chord.quality)))
    return namesForTonic(0, false)
  }, [key, chord])

  const labelOf = (c: Challenge, nn: Names) => `${nn(c.root)}${QUALITIES[c.quality].symbol}${c.inversion ? `/${nn(c.bassPc)}` : ''}`

  const next = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setChord((prev) => pickChallenge(qualities, inversions, keyId, prev))
    setMisses(0)
    missCount.current = 0
    setRevealed(false)
    setVerdict({ kind: 'idle' })
    setTones(new Map())
    setLatched([])
    askedAt.current = performance.now()
    locked.current = false
    armed.current = true
  }, [qualities, inversions, keyId])

  /* O primeiro acorde, e um novo quando os filtros mudam. */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    next()
  }, [next])

  /** Pular conta como erro: senão a sequência vira moeda de troca. */
  const skip = useCallback(() => {
    if (chord) setSession((s) => ({ ...s, wrong: s.wrong + 1, streak: 0, misses: { ...s.misses, [labelOf(chord, names)]: (s.misses[labelOf(chord, names)] ?? 0) + 1 } }))
    next()
  }, [chord, names, next])

  const hear = useCallback(() => {
    if (chord) sound().play(challengeNotes(chord).map((n) => n.midi), { gap: 70, hold: 900 })
  }, [chord])

  /* O julgamento, a cada mudança nas notas. */
  useEffect(() => {
    if (!chord) return
    /* Depois de um veredito só julga de novo quando as mãos saem do teclado. */
    if (pressed.length === 0) {
      armed.current = true
      return
    }
    if (locked.current || !armed.current) return
    const result = judge(pressed, chord, requireBass)
    if (result === 'pending') return

    locked.current = true
    armed.current = false
    const played = [...pressed]
    const label = labelOf(chord, names)

    if (result === 'correct') {
      const ms = Math.round(performance.now() - askedAt.current)
      setVerdict({ kind: 'correct', ms })
      setTones(new Map(played.map((m) => [m, 'hit'])))
      setSession((s) => {
        const streak = s.streak + 1
        return { ...s, right: s.right + 1, streak, best: Math.max(s.best, streak), times: [...s.times, ms] }
      })
      later(next, CORRECT_DELAY)
      return
    }

    const wanted = new Set(chord.pcs)
    setTones(new Map(played.map((m) => [m, wanted.has(m % 12) ? 'hit' : 'miss'])))
    setVerdict({ kind: 'wrong', played })
    setSession((s) => ({ ...s, wrong: s.wrong + 1, streak: 0, misses: { ...s.misses, [label]: (s.misses[label] ?? 0) + 1 } }))
    missCount.current += 1
    setMisses(missCount.current)
    if (revealAfter > 0 && missCount.current >= revealAfter) setRevealed(true)
    later(() => {
      locked.current = false
      setTones(new Map())
      setVerdict({ kind: 'idle' })
      setLatched([])
    }, WRONG_DELAY)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pressed, chord, requireBass, revealAfter, next])

  /* Atalhos: Enter próximo, Espaço pula, 1 ouve, ? mostra. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return
      if (e.key === 'Enter') next()
      else if (e.key === ' ') {
        e.preventDefault()
        skip()
      } else if (e.key === '1') hear()
      else if (e.key === '?') setRevealed(true)
      else return
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, skip, hear])

  /* O dedo na tela: liga ou desliga a tecla, com som. */
  const onTap = (m: number) => {
    if (locked.current) return
    setLatched((l) => {
      if (l.includes(m)) return l.filter((x) => x !== m)
      noteOn(m)
      setTimeout(() => noteOff(m), 700)
      return [...l, m]
    })
  }

  /* A dica no teclado: a voicing de referência, só em contorno. */
  const marks = useMemo(() => {
    const m = new Map<number, KeyMark>()
    if (chord && revealed) challengeNotes(chord).forEach((n) => m.set(n.midi, { color: degreeColor(n.degree), note: spellDegree(names(chord.root), n.pc, n.degree), degree: n.degree, ghost: true }))
    return m
  }, [chord, revealed, names])
  const lit = useMemo(() => new Set(pressed), [pressed])

  const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x])
  const setQualities = (q: QualityId) => {
    const nextQ = toggle(qualities, q)
    if (nextQ.length) set('pgQualities')(nextQ)
  }
  const setInversions = (i: number) => {
    const nextI = toggle(inversions, i).sort()
    if (nextI.length) set('pgInversions')(nextI)
  }

  const avg = session.times.length ? session.times.reduce((a, b) => a + b, 0) / session.times.length : null
  const last = session.times.at(-1)
  const worst = Object.entries(session.misses)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
  const keyLabel = KEY_OPTIONS.find((o) => o.id === keyId)?.label ?? ''

  const roman = chord && romanOf(chord)
  const over = verdict.kind === 'correct' ? 'Boa!' : verdict.kind === 'wrong' ? 'De novo' : 'Toque este acorde'
  const tone = verdict.kind === 'correct' ? ' quiz-big-good' : verdict.kind === 'wrong' ? ' pg-big-bad' : ''
  const ordered = chord ? challengeNotes(chord) : []
  const held = new Set(pressed.map((n) => n % 12))

  return (
    <main className="wrap screen quiz piano">
      <div className="pg-mid">
        <Filters settings={settings} set={set} onToggleQuality={setQualities} onToggleInversion={setInversions} />
        <div className="quiz-stage" aria-live="polite">
          <span className="quiz-over">{over}</span>
          {chord ? (
            <>
              <span key={`${chord.root}-${chord.quality}-${chord.inversion}-${session.right + session.wrong}`} className={`quiz-big${tone}`}>
                {names(chord.root)}
                {QUALITIES[chord.quality].symbol}
                {chord.inversion > 0 && <span className="pg-slash">/{names(chord.bassPc)}</span>}
              </span>
              <span className="quiz-under">
                {QUALITIES[chord.quality].name} · {INVERSION_NAMES[chord.inversion]}
                {roman && key && ` · grau ${roman} de ${keyLabel}`}
              </span>
            </>
          ) : (
            <>
              <span className="quiz-big quiz-big-plain">–</span>
              <span className="quiz-under">escolha pelo menos um tipo de acorde nos ajustes</span>
            </>
          )}
          <span className="quiz-msg-slot">
            {verdict.kind === 'correct' && <span className="quiz-msg quiz-msg-good">certo · {secs(verdict.ms)}</span>}
            {verdict.kind === 'wrong' && <span className="quiz-msg quiz-msg-bad">você tocou {verdict.played.map((m) => names(m % 12)).join(' ')}</span>}
            {verdict.kind === 'idle' && revealed && chord && (
              <span className="pips">
                {ordered.map((n) => (
                  <span key={n.midi} className={held.has(n.pc) ? 'pg-held' : undefined}>
                    <Pip top={n.degree} main={spellDegree(names(chord.root), n.pc, n.degree)} degree={n.degree} />
                  </span>
                ))}
              </span>
            )}
            {verdict.kind === 'idle' && !revealed && revealAfter > 0 && (
              <span className="pg-tries" aria-label={`${misses} de ${revealAfter} erros antes de mostrar`}>
                {Array.from({ length: revealAfter }, (_, i) => (
                  <i key={i} className={i < misses ? 'pg-spent' : undefined} />
                ))}
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="quiz-bar">
        <div className="quiz-stats">
          <span className="quiz-stat" title="acertos · erros">
            <b>{session.right}</b>
            <small>/ {session.wrong} erros</small>
          </span>
          <span className={`quiz-stat${session.streak >= 5 ? ' quiz-hot' : ''}`} title="sequência sem errar (melhor da sessão)">
            <Flame size={14} strokeWidth={1.8} />
            <b>{session.streak}</b>
            <small>máx {session.best}</small>
          </span>
          <span className="quiz-stat" title="tempo do último acerto · média">
            <Timer size={14} strokeWidth={1.8} />
            <b>{last != null ? secs(last) : '–'}</b>
            {avg != null && <small>média {secs(avg)}</small>}
          </span>
          {worst.length > 0 && (
            <span className="quiz-stat pg-worst" title="os que mais escaparam nesta sessão">
              <small>mais errados</small>
              {worst.map(([label, n]) => (
                <b key={label}>
                  {label}
                  <small>{n}×</small>
                </b>
              ))}
            </span>
          )}
        </div>
        <span className="spacer" />
        <div className="quiz-menu">
          <button type="button" className="btn btn-ghost btn-sm" onClick={hear} disabled={!chord} title="Ouvir o acorde (1)">
            <Volume2 size={13} strokeWidth={1.8} />
            Ouvir
          </button>
          {!revealed && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRevealed(true)} disabled={!chord} title="Mostrar o acorde (?)">
              <Eye size={13} strokeWidth={1.8} />
              Não sei
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={skip} disabled={!chord} title="Pular, conta como erro (Espaço)">
            <SkipForward size={13} strokeWidth={1.8} />
            Pular
          </button>
        </div>
      </div>

      <div className="screen-fill">
        <section className="viewport card piano-viewport" aria-label="teclado">
          <div className="viewport-bar">
            <span className="piano-hint">
              {latched.length > 0 ? 'toque de novo para soltar a tecla' : 'na tela, cada toque liga uma tecla · no computador, Z…M e Q…P'}
            </span>
            <button
              type="button"
              className={`btn btn-ghost btn-sm${input.status === 'connected' ? ' btn-on' : ''}`}
              onClick={() => void input.connectMidi()}
              disabled={input.status === 'unsupported' || input.status === 'connecting'}
              title={input.devices.join(', ') || 'usar um controlador MIDI (Chrome, Edge)'}
            >
              <KeyboardIcon size={13} strokeWidth={1.8} />
              {MIDI_TEXT[input.status]}
            </button>
          </div>
          <div className="kb-wrap">
            <Keyboard marks={marks} lit={lit} tones={tones} onDown={onTap} onUp={() => {}} label={settings.pgLabels ? (m) => (key ? names(m) : sharpNames(m)) : undefined} />
          </div>
        </section>
      </div>
    </main>
  )
}

/* ── Filtros (os do ChordLab) ─────────────────────────────────────────── */

const GROUP_LABEL = { triads: 'Tríades e suspensos', sevenths: 'Tétrades e cores' } as const

function Filters({
  settings,
  set,
  onToggleQuality,
  onToggleInversion,
}: {
  settings: Settings
  set: Props['set']
  onToggleQuality: (q: QualityId) => void
  onToggleInversion: (i: number) => void
}) {
  const { pgQualities: qualities, pgInversions: inversions, pgKey, pgReveal, pgBass, pgLabels, pgSound } = settings
  const reset = () => {
    set('pgQualities')(DEFAULTS.pgQualities)
    set('pgInversions')(DEFAULTS.pgInversions)
    set('pgKey')(DEFAULTS.pgKey)
    set('pgReveal')(DEFAULTS.pgReveal)
    set('pgBass')(DEFAULTS.pgBass)
    set('pgLabels')(DEFAULTS.pgLabels)
  }
  return (
    <section className="pg-panel card" aria-label="filtros do jogo">
      <div className="pg-panel-head">
        <h2>Filtros</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
          <RotateCcw size={12} strokeWidth={1.8} />
          Reset
        </button>
      </div>
      {(['triads', 'sevenths'] as const).map((g) => (
        <div className="pg-fgroup" key={g}>
          <span className="pg-flabel">{GROUP_LABEL[g]}</span>
          <div className="chips">
            {QUALITY_IDS.filter((q) => groupOf(q) === g).map((q) => (
              <Chip key={q} label={QUALITIES[q].symbol || 'maj'} fixed on={qualities.includes(q)} onPress={() => onToggleQuality(q)} />
            ))}
          </div>
        </div>
      ))}
      <div className="pg-fgroup">
        <span className="pg-flabel">Inversões</span>
        <div className="chips">
          {INVERSION_SHORT.map((label, i) => (
            <Chip key={label} label={label} fixed on={inversions.includes(i)} onPress={() => onToggleInversion(i)} />
          ))}
        </div>
      </div>
      <div className="pg-selects">
        <div className="pg-fgroup">
          <span className="pg-flabel">Tonalidade</span>
          <label className="select">
            <span className="sr-only">tonalidade</span>
            <select value={pgKey} onChange={(e) => set('pgKey')(e.target.value)}>
              {KEY_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="pg-fgroup">
          <span className="pg-flabel">Revelar o acorde</span>
          <label className="select">
            <span className="sr-only">revelar o acorde</span>
            <select value={pgReveal} onChange={(e) => set('pgReveal')(Number(e.target.value))}>
              <option value={1}>depois de 1 erro</option>
              <option value={2}>depois de 2 erros</option>
              <option value={3}>depois de 3 erros</option>
              <option value={5}>depois de 5 erros</option>
              <option value={0}>nunca (só no botão)</option>
            </select>
          </label>
        </div>
      </div>
      <div className="pg-switches">
        <span title="A inversão só conta com o baixo certo">
          <Switch label="Baixo obrigatório" on={pgBass} onChange={() => set('pgBass')(!pgBass)} />
        </span>
        <span title="Rótulo em cada tecla">
          <Switch label="Nome das notas" on={pgLabels} onChange={() => set('pgLabels')(!pgLabels)} />
        </span>
        <Switch label="Som" on={pgSound} onChange={() => set('pgSound')(!pgSound)} />
      </div>
    </section>
  )
}
