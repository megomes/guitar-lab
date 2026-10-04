'use client'

/* Jogo — decorar o braço.
 *
 * A pergunta em cima, grande; as escolhas (que pergunta, que cordas, que notas,
 * que casas) numa faixa; e o braço limpo, sem nome nenhum, esperando o dedo.
 * Acertou, a esfera acende verde e vem a próxima. Errou, acende vermelha com o
 * nome do que você tocou — o erro também ensina — e a pergunta fica.
 *
 * Por baixo, cada par corda × nota guarda como você vai nele, e o sorteio puxa
 * mais o que você erra ou demora. "Meu mapa" mostra isso no braço.
 */
import { Eye, Flame, Map as MapIcon, Play, RotateCcw, SlidersHorizontal, Timer, Trophy } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { FRET_COUNT, STANDARD_TUNING, STRING_LABELS } from '@/lib/fretboard'
import type { LegendItem, Mark, NeckWindow, Pin } from '@/lib/marks'
import { ALL_PCS, NATURALS, togglePc } from '@/lib/notes'
import { Player } from '@/lib/practice/audio'
import {
  EMPTY_STATS,
  GRADE_COLOR,
  GRADE_NAME,
  QUIZ_KINDS,
  SPRINT_SECONDS,
  cellKey,
  fretsOf,
  gradeOf,
  loadStats,
  nextPrompt,
  pcAt,
  record,
  saveStats,
  spellFor,
  type Grade,
  type Prompt,
  type QuizKind,
  type QuizRound,
  type QuizSpell,
  type QuizStats,
} from '@/lib/quiz'
import type { Settings } from '@/lib/settings'
import { flatNames, sharpNames } from '@/lib/spelling'

import { CGroup } from '../consult/Controls'
import { Fretboard } from '../Fretboard'
import { Chip, Legend, Segmented, Switch } from '../ui'

type Setter = <K extends keyof Settings>(key: K) => (value: Settings[K]) => void

interface Props {
  settings: Settings
  set: Setter
  patch: (p: Partial<Settings>) => void
}

const GOOD = GRADE_COLOR.good
const BAD = GRADE_COLOR.bad
const QUESTION = '#ECE7E0'

/** Uma casa tocada nesta pergunta. `near`: nota certa fora do que valia (outra corda, fora do vão). */
interface Tap {
  string: number
  fret: number
  ok: boolean | 'near'
}

type Phase = 'ask' | 'right' | 'reveal'
type Sprint = 'idle' | 'run' | 'done'

interface Session {
  right: number
  wrong: number
  streak: number
  best: number
  /** Tempos das respostas certas, em ms. */
  times: number[]
}

const NEW_SESSION: Session = { right: 0, wrong: 0, streak: 0, best: 0, times: [] }

/** Relógio das respostas, em ms. */
const since = (t: number) => performance.now() - t

const ordinal = (s: number) => `${6 - s}ª`
const secs = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`

/** "6ª, 5ª e 4ª", ou "todas as cordas". */
function stringsText(strings: number[]) {
  if (strings.length === 6) return 'em qualquer corda'
  const xs = [...strings].sort((a, b) => a - b).map(ordinal)
  return xs.length === 1 ? `na ${xs[0]} corda` : `nas cordas ${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`
}

export function QuizView({ settings, set, patch }: Props) {
  const { quizKind: kind, quizStrings: strings, quizPcs: pcs, quizLo: lo, quizHi: hi, quizRound: round, quizSpell: spell, quizSound: sound } = settings

  const [stats, setStats] = useState<QuizStats>(EMPTY_STATS)
  const statsRef = useRef(stats)
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [taps, setTaps] = useState<Tap[]>([])
  const [wrongPcs, setWrongPcs] = useState<number[]>([])
  const [phase, setPhase] = useState<Phase>('ask')
  const [missed, setMissed] = useState(false)
  const [msg, setMsg] = useState<{ text: string; tone: 'good' | 'bad' | 'info' } | null>(null)
  const [session, setSession] = useState<Session>(NEW_SESSION)
  const [last, setLast] = useState<number | null>(null)
  const [showMap, setShowMap] = useState(false)
  const [sprint, setSprint] = useState<Sprint>('idle')
  const [endAt, setEndAt] = useState(0)
  const [now, setNow] = useState(0)
  const t0 = useRef(0)
  const lastId = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const player = useRef<Player | null>(null)

  const range = useMemo(() => ({ lo, hi }), [lo, hi])

  /* O menu de ajustes: fecha ao tocar fora dele. */
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menu) return
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [menu])
  const frets = FRET_COUNT

  /* As estatísticas moram no navegador, à parte das escolhas. */
  useEffect(() => {
    const s = loadStats()
    statsRef.current = s
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStats(s)
  }, [])

  const commit = useCallback((next: QuizStats) => {
    statsRef.current = next
    setStats(next)
    saveStats(next)
  }, [])

  const sfx = useCallback(
    (what: 'note' | 'buzz', midi = 0) => {
      if (!sound) return
      player.current ??= new Player()
      if (what === 'note') player.current.pluckNow(midi)
      else player.current.buzz()
    },
    [sound],
  )

  const ask = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    const p = nextPrompt(kind, { strings, pcs, range }, statsRef.current, lastId.current)
    lastId.current = p?.id ?? null
    setPrompt(p)
    setTaps([])
    setWrongPcs([])
    setMissed(false)
    setPhase('ask')
    setMsg(null)
    t0.current = since(0)
  }, [kind, strings, pcs, range])

  /* Mudou a escolha: pergunta nova. No contra o relógio, volta para a largada. */
  useEffect(() => {
    ask()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSprint('idle')
  }, [ask, round])

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  /* O relógio da rodada de 60 s. */
  useEffect(() => {
    if (sprint !== 'run') return
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= endAt) {
        setSprint('done')
        if (timer.current) clearTimeout(timer.current)
      }
    }, 200)
    return () => clearInterval(id)
  }, [sprint, endAt])

  /* Fim da rodada: guarda o recorde. */
  const scored = useRef(false)
  useEffect(() => {
    if (sprint === 'run') scored.current = false
    if (sprint !== 'done' || scored.current) return
    scored.current = true
    const s = statsRef.current
    if (session.right > (s.best[kind] ?? 0)) commit({ ...s, best: { ...s.best, [kind]: session.right } })
  }, [sprint, session.right, kind, commit])

  const startSprint = () => {
    setSession(NEW_SESSION)
    setLast(null)
    const t = Date.now()
    setNow(t)
    setEndAt(t + SPRINT_SECONDS * 1000)
    setSprint('run')
    setShowMap(false)
    ask()
  }

  const playing = !showMap && prompt !== null && phase === 'ask' && (round === 'free' || sprint === 'run')

  const name = useCallback((pc: number) => spellFor(spell, pc, prompt?.flip ?? false), [spell, prompt])

  /* ── Respostas ──────────────────────────────────────────────────────── */

  const miss = (string: number) => {
    if (!prompt) return
    if (!missed) {
      setMissed(true)
      commit(record(statsRef.current, string, prompt.pc, false, null))
      setSession((s) => ({ ...s, wrong: s.wrong + 1, streak: 0 }))
    }
    sfx('buzz')
  }

  const win = (cells: { string: number }[]) => {
    if (!prompt) return
    const ms = since(t0.current)
    if (!missed) {
      let s = statsRef.current
      for (const c of cells) s = record(s, c.string, prompt.pc, true, ms / cells.length)
      commit(s)
      setSession((x) => {
        const streak = x.streak + 1
        return { ...x, right: x.right + 1, streak, best: Math.max(x.best, streak), times: [...x.times, ms] }
      })
      setLast(ms)
    }
    setPhase('right')
    timer.current = setTimeout(ask, missed ? 1100 : 650)
  }

  const onTap = (fret: number, string: number) => {
    const pc = pcAt(string, fret)
    sfx('note', STANDARD_TUNING[string] + fret)
    if (!playing || !prompt || prompt.kind === 'name') return

    const add = (t: Tap) => setTaps((ts) => [...ts.filter((x) => x.string !== t.string || x.fret !== t.fret), t])

    if (pc !== prompt.pc) {
      add({ string, fret, ok: false })
      setMsg({ text: `Essa é ${name(pc)}`, tone: 'bad' })
      miss(prompt.string ?? string)
      return
    }

    if (prompt.kind === 'string' && string !== prompt.string) {
      add({ string, fret, ok: 'near' })
      setMsg({ text: `${name(pc)} sim, mas na ${ordinal(string)} corda`, tone: 'info' })
      miss(prompt.string!)
      return
    }

    if (prompt.kind === 'all') {
      const target = prompt.targets.some((t) => t.string === string && t.fret === fret)
      if (!target) {
        add({ string, fret, ok: 'near' })
        setMsg({ text: 'Essa vale, mas está fora do que você escolheu', tone: 'info' })
        return
      }
      const found = taps.filter((t) => t.ok === true).length + (taps.some((t) => t.string === string && t.fret === fret && t.ok === true) ? 0 : 1)
      add({ string, fret, ok: true })
      if (found >= prompt.targets.length) {
        setMsg({ text: missed ? 'Achou todas' : 'Todas!', tone: 'good' })
        win(prompt.targets)
      } else setMsg({ text: `${found} de ${prompt.targets.length}`, tone: 'good' })
      return
    }

    add({ string, fret, ok: true })
    setMsg({ text: missed ? `Isso, ${name(pc)}` : `Isso! ${name(pc)}`, tone: 'good' })
    win([{ string }])
  }

  const onName = (pc: number) => {
    if (!playing || !prompt || prompt.kind !== 'name') return
    if (pc !== prompt.pc) {
      if (wrongPcs.includes(pc)) return
      setWrongPcs((w) => [...w, pc])
      setMsg({ text: `Não é ${name(pc)}`, tone: 'bad' })
      miss(prompt.string!)
      return
    }
    sfx('note', STANDARD_TUNING[prompt.string!] + prompt.fret!)
    setMsg({ text: `Isso! ${name(pc)}`, tone: 'good' })
    win([{ string: prompt.string! }])
  }

  const reveal = () => {
    if (!prompt || phase !== 'ask') return
    miss(prompt.string ?? strings[0])
    setPhase('reveal')
    setMsg({ text: prompt.kind === 'name' ? `Era ${name(prompt.pc)}` : 'Aqui', tone: 'info' })
    if (prompt.kind === 'name') sfx('note', STANDARD_TUNING[prompt.string!] + prompt.fret!)
    timer.current = setTimeout(ask, 2000)
  }

  /* Teclado no Nomear: a letra é a nota natural; Espaço mostra a resposta. */
  const keys = useRef({ onName, reveal })
  useEffect(() => {
    keys.current = { onName, reveal }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement)?.closest('input, select, textarea')) return
      const i = 'cdefgab'.indexOf(e.key.toLowerCase())
      if (kind === 'name' && i >= 0) {
        keys.current.onName(NATURALS[i])
        e.preventDefault()
      } else if (e.key === ' ') {
        keys.current.reveal()
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [kind])

  /* ── O braço ────────────────────────────────────────────────────────── */

  /* Onde a resposta está: o que "Mostrar" acende. */
  const answers = useMemo<Pin[]>(() => {
    if (!prompt) return []
    if (prompt.kind === 'name') return [{ string: prompt.string!, fret: prompt.fret! }]
    if (prompt.kind === 'all') return prompt.targets
    const ss = prompt.kind === 'string' ? [prompt.string!] : strings
    return ss.flatMap((s) => fretsOf(s, prompt.pc, range).map((fret) => ({ string: s, fret })))
  }, [prompt, strings, range])

  const marks = useMemo<Mark[]>(() => {
    if (showMap) {
      const out: Mark[] = []
      for (let s = 0; s < 6; s++)
        for (let f = 0; f <= frets; f++) {
          const pc = pcAt(s, f)
          const g = gradeOf(stats.cells[cellKey(s, pc)])
          out.push({ string: s, fret: f, pc, degree: '', level: g === 'new' ? 'ghost' : 'on', color: GRADE_COLOR[g], label: sharpNames(pc) })
        }
      return out
    }
    if (!prompt) return []
    const out: Mark[] = taps.map((t) => {
      const pc = pcAt(t.string, t.fret)
      return { string: t.string, fret: t.fret, pc, degree: '', level: t.ok === 'near' ? 'outline' : 'on', color: t.ok === false ? BAD : t.ok === true ? GOOD : QUESTION, label: name(pc) }
    })
    if (prompt.kind === 'name') {
      const done = phase !== 'ask'
      out.push({ string: prompt.string!, fret: prompt.fret!, pc: prompt.pc, degree: '', level: 'on', color: phase === 'right' ? GOOD : QUESTION, label: done ? name(prompt.pc) : '?' })
    }
    if (phase === 'reveal' && prompt.kind !== 'name')
      for (const a of answers)
        if (!taps.some((t) => t.string === a.string && t.fret === a.fret && t.ok === true))
          out.push({ string: a.string, fret: a.fret, pc: prompt.pc, degree: '', level: 'outline', color: GOOD, label: name(prompt.pc) })
    return out
  }, [showMap, prompt, taps, phase, answers, name, frets, stats])

  const rings = useMemo<Pin[]>(() => {
    if (showMap || !prompt) return []
    if (prompt.kind === 'name' && phase === 'ask') return answers
    return []
  }, [showMap, prompt, phase, answers])

  const windows = useMemo<NeckWindow[]>(() => {
    if (showMap) return []
    if (prompt?.kind === 'string') return [{ from: lo, to: hi, strings: [prompt.string!, prompt.string!] }]
    /* O destaque só aparece quando o sorteio não pega o braço inteiro. */
    return lo > 0 || hi < frets ? [{ from: lo, to: hi }] : []
  }, [showMap, prompt, lo, hi, frets])

  const legend = useMemo<LegendItem[]>(() => {
    if (showMap)
      return [
        ...(['good', 'mid', 'bad'] as Grade[]).map((g) => ({ kind: 'dot' as const, color: GRADE_COLOR[g], text: GRADE_NAME[g] })),
        { kind: 'ghost', text: GRADE_NAME.new },
      ]
    return [
      { kind: 'dot', color: GOOD, text: 'acertou' },
      { kind: 'dot', color: BAD, text: 'errou' },
      ...(kind === 'string' ? [{ kind: 'windows' as const, text: 'a corda pedida' }] : []),
      ...(kind === 'string' || kind === 'all' ? [{ kind: 'outline' as const, text: 'certa, mas não vale' }] : []),
    ]
  }, [showMap, kind])

  /* ── O que mostrar em cima ──────────────────────────────────────────── */

  /* No mapa: quantos pares corda × nota da escolha você já sabe. */
  const known = useMemo(() => {
    const pairs = strings.flatMap((s) => pcs.filter((pc) => fretsOf(s, pc, range).length > 0).map((pc) => gradeOf(stats.cells[cellKey(s, pc)])))
    return { good: pairs.filter((g) => g === 'good').length, total: pairs.length }
  }, [strings, pcs, range, stats])

  const avg = session.times.length ? session.times.reduce((a, b) => a + b, 0) / session.times.length : null
  const left = Math.max(0, Math.ceil((endAt - now) / 1000))
  const best = stats.best[kind] ?? 0
  const sprintGate = round === 'sprint' && sprint !== 'run' && !showMap

  /* O palco: a pergunta em letra grande, no meio. */
  const stage = (() => {
    if (showMap) return { over: 'Meu mapa', big: `${known.good}/${known.total}`, under: 'pares corda × nota que você já sabe' }
    if (sprintGate)
      return sprint === 'done'
        ? { over: 'Acabou o tempo', big: String(session.right), under: session.right >= best && session.right > 0 ? 'recorde novo!' : `acertos · recorde ${best}` }
        : { over: 'Contra o relógio', big: '60 s', under: QUIZ_KINDS.find((k) => k.id === kind)?.hint ?? '' }
    if (!prompt) return { over: 'Nada para perguntar', big: '–', under: 'escolha cordas e notas que caibam nas casas' }
    const n = name(prompt.pc)
    if (prompt.kind === 'find') return { over: 'Ache o', big: n, under: stringsText(strings) }
    if (prompt.kind === 'string') return { over: 'Ache o', big: n, under: `na ${ordinal(prompt.string!)} corda (${STRING_LABELS[prompt.string!]})` }
    if (prompt.kind === 'all') return { over: 'Todos os', big: n, under: `${taps.filter((t) => t.ok === true).length} de ${prompt.targets.length}` }
    return {
      over: 'Que nota é essa?',
      big: phase === 'ask' ? '?' : n,
      under: `${ordinal(prompt.string!)} corda, ${prompt.fret === 0 ? 'solta' : `casa ${prompt.fret}`}`,
    }
  })()

  const setStrings = (s: number) => {
    const next = strings.includes(s) ? strings.filter((x) => x !== s) : [...strings, s]
    if (next.length) set('quizStrings')(next)
  }
  const setPcs = (next: number[]) => next.length && set('quizPcs')(next)
  const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x))
  const resetStats = () => {
    if (window.confirm('Apagar o histórico de acertos e os recordes?')) commit(EMPTY_STATS)
  }

  const tone = phase === 'right' ? ' quiz-big-good' : phase === 'reveal' ? ' quiz-big-info' : ''

  return (
    <main className="wrap screen quiz">
      <div className="quiz-stage" aria-live="polite">
        {round === 'sprint' && sprint === 'run' && (
          <span className={`quiz-clock${left <= 10 ? ' quiz-clock-end' : ''}`}>
            <Timer size={14} strokeWidth={1.8} />
            {left} s
          </span>
        )}
        <span className="quiz-over">{stage.over}</span>
        <span key={`${prompt?.id}-${showMap}-${sprint}`} className={`quiz-big${tone}${showMap || sprintGate ? ' quiz-big-plain' : ''}`}>
          {stage.big}
        </span>
        <span className="quiz-under">{stage.under}</span>
        <span className="quiz-msg-slot">
          {sprintGate ? (
            <button type="button" className="btn btn-primary btn-lg" onClick={startSprint}>
              <Play size={14} strokeWidth={2} />
              {sprint === 'done' ? 'De novo' : 'Começar'}
            </button>
          ) : (
            msg &&
            !showMap && (
              <span key={msg.text + taps.length + wrongPcs.length} className={`quiz-msg quiz-msg-${msg.tone}`}>
                {msg.text}
              </span>
            )
          )}
        </span>
      </div>

      {/* Nomear: as doze notas como teclas, acima do braço — o braço não sai do lugar. */}
      {kind === 'name' && !showMap && (
        <div className="quiz-pad" role="group" aria-label="Que nota é?">
          {ALL_PCS.map((pc) => {
            const natural = NATURALS.includes(pc)
            const label = natural ? sharpNames(pc) : spell === 'sharp' ? sharpNames(pc) : spell === 'flat' ? flatNames(pc) : `${sharpNames(pc)} ${flatNames(pc)}`
            const right = phase !== 'ask' && prompt?.pc === pc
            return (
              <button
                key={pc}
                type="button"
                className={`quiz-key${natural ? '' : ' quiz-key-acc'}${wrongPcs.includes(pc) ? ' quiz-key-wrong' : ''}${right ? ' quiz-key-right' : ''}`}
                disabled={!playing || wrongPcs.includes(pc)}
                onClick={() => onName(pc)}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      <div className="quiz-bar">
        <div className="quiz-stats">
          <span className="quiz-stat" title="acertos de primeira · erros">
            <b>{session.right}</b>
            <small>/ {session.wrong} erros</small>
          </span>
          <span className={`quiz-stat${session.streak >= 5 ? ' quiz-hot' : ''}`} title="sequência sem errar (melhor da sessão)">
            <Flame size={14} strokeWidth={1.8} />
            <b>{session.streak}</b>
            <small>máx {session.best}</small>
          </span>
          <span className="quiz-stat" title="tempo da última resposta · média">
            <Timer size={14} strokeWidth={1.8} />
            <b>{last != null ? secs(last) : '–'}</b>
            {avg != null && <small>média {secs(avg)}</small>}
          </span>
          {round === 'sprint' && (
            <span className="quiz-stat" title="recorde de 60 s nesta pergunta">
              <Trophy size={14} strokeWidth={1.8} />
              <b>{best}</b>
            </span>
          )}
        </div>
        <span className="spacer" />
        <div className="quiz-menu">
          <Segmented<QuizKind> options={QUIZ_KINDS.map((k) => ({ value: k.id, label: k.label }))} value={kind} onChange={set('quizKind')} />
          <div className="quiz-pop-anchor" ref={menuRef}>
            <button type="button" className={`btn btn-ghost btn-sm${menu ? ' btn-on' : ''}`} aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
              <SlidersHorizontal size={13} strokeWidth={1.8} />
              Ajustes
              <small className="quiz-sum">
                {strings.length} corda{strings.length > 1 ? 's' : ''} · {pcs.length} nota{pcs.length > 1 ? 's' : ''} · casas {lo}–{hi}
              </small>
            </button>
            {menu && (
              <div className="quiz-pop card" role="dialog" aria-label="Ajustes do jogo">
                <CGroup label="Cordas">
                  {[0, 1, 2, 3, 4, 5].map((s) => (
                    <Chip
                      key={s}
                      fixed
                      on={strings.includes(s)}
                      onPress={() => setStrings(s)}
                      label={
                        <>
                          {ordinal(s)}
                          <small>{STRING_LABELS[s]}</small>
                        </>
                      }
                    />
                  ))}
                </CGroup>
                <CGroup label="Notas">
                  {ALL_PCS.map((pc) => (
                    <Chip key={pc} label={sharpNames(pc)} fixed on={pcs.includes(pc)} onPress={() => setPcs(togglePc(pcs, pc))} />
                  ))}
                </CGroup>
                <div className="chips quiz-shortcuts">
                  {!sameSet(pcs, NATURALS) && <Chip label="só naturais" onPress={() => setPcs(NATURALS)} />}
                  {pcs.length < 12 && <Chip label="todas as notas" onPress={() => setPcs(ALL_PCS)} />}
                </div>
                <div className="cgroup">
                  <span className="cgroup-label">Casas</span>
                  <label className="select">
                    <span className="sr-only">da casa</span>
                    <select value={lo} onChange={(e) => patch({ quizLo: Number(e.target.value), quizHi: Math.max(hi, Number(e.target.value)) })}>
                      {Array.from({ length: FRET_COUNT + 1 }, (_, f) => (
                        <option key={f} value={f}>
                          {f === 0 ? 'solta' : f}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="quiz-to">a</span>
                  <label className="select">
                    <span className="sr-only">até a casa</span>
                    <select value={hi} onChange={(e) => patch({ quizHi: Number(e.target.value), quizLo: Math.min(lo, Number(e.target.value)) })}>
                      {Array.from({ length: FRET_COUNT + 1 }, (_, f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="cgroup">
                  <span className="cgroup-label">Rodada</span>
                  <Segmented<QuizRound>
                    options={[
                      { value: 'free', label: 'livre' },
                      { value: 'sprint', label: '60 s' },
                    ]}
                    value={round}
                    onChange={set('quizRound')}
                  />
                </div>
                {pcs.some((pc) => !NATURALS.includes(pc)) && (
                  <div className="cgroup">
                    <span className="cgroup-label">Grafia</span>
                    <Segmented<QuizSpell>
                      options={[
                        { value: 'sharp', label: '♯' },
                        { value: 'flat', label: '♭' },
                        { value: 'mix', label: '♯ e ♭' },
                      ]}
                      value={spell}
                      onChange={set('quizSpell')}
                    />
                  </div>
                )}
                <div className="quiz-pop-foot">
                  <Switch label="som" on={sound} onChange={() => set('quizSound')(!sound)} />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={resetStats}>
                    <RotateCcw size={13} strokeWidth={1.8} />
                    zerar histórico
                  </button>
                </div>
              </div>
            )}
          </div>
          <button type="button" className={`btn btn-ghost btn-sm${showMap ? ' btn-on' : ''}`} aria-pressed={showMap} onClick={() => setShowMap((m) => !m)} title="Onde você acerta e onde erra">
            <MapIcon size={13} strokeWidth={1.8} />
            mapa
          </button>
          {!showMap && !sprintGate && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={reveal} disabled={!playing} title="Mostrar a resposta (Espaço)">
              <Eye size={13} strokeWidth={1.8} />
              Mostrar
            </button>
          )}
        </div>
      </div>

      <div className="screen-fill">
        <section className="viewport card quiz-neck" aria-label="braço da guitarra">
          <div className="viewport-bar">
            <Legend items={legend} />
          </div>
          <div className={`neck${playing ? ' quiz-live' : ''}`}>
            <Fretboard marks={marks} windows={windows} rings={rings} labelMode="note" showOutside onTap={onTap} noTip={!showMap} />
          </div>
        </section>
      </div>
    </main>
  )
}
