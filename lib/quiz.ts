/* Jogo — decorar o braço.
 *
 * Quatro perguntas sobre a mesma coisa, de quatro lados: achar a nota em
 * qualquer corda, achar na corda pedida, achar todas as casas dela, e o
 * contrário — a casa acesa, e o nome dela.
 *
 * O sorteio não é cego: cada par corda × nota guarda acertos, erros e tempo, e
 * o que você erra ou demora volta mais vezes. É o que faz decorar de verdade,
 * em vez de acertar sempre as mesmas cinco notas que já sabe.
 */
import { FRET_COUNT, STANDARD_TUNING } from './fretboard'
import { flatNames, sharpNames, type Names } from './spelling'

export type QuizKind = 'find' | 'string' | 'all' | 'name'
export type QuizRound = 'free' | 'sprint'
export type QuizSpell = 'sharp' | 'flat' | 'mix'

export const QUIZ_KINDS: { id: QuizKind; label: string; hint: string }[] = [
  { id: 'find', label: 'Achar', hint: 'a nota em qualquer corda escolhida' },
  { id: 'string', label: 'Na corda', hint: 'a nota naquela corda' },
  { id: 'all', label: 'Todas', hint: 'todas as casas da nota' },
  { id: 'name', label: 'Nomear', hint: 'a casa acesa: que nota é?' },
]

export const SPRINT_SECONDS = 60

const mod12 = (x: number) => ((x % 12) + 12) % 12

export const pcAt = (string: number, fret: number) => mod12(STANDARD_TUNING[string] + fret)

/** O nome que a pergunta mostra. No misto, cada acidente sai ora ♯, ora ♭ — como na partitura. */
export function spellFor(spell: QuizSpell, pc: number, flip: boolean): string {
  const names: Names = spell === 'flat' || (spell === 'mix' && flip) ? flatNames : sharpNames
  return names(pc)
}

export interface Range {
  lo: number
  hi: number
}

/** As casas da nota naquela corda, dentro do vão. */
export function fretsOf(string: number, pc: number, range: Range): number[] {
  const out: number[] = []
  for (let f = mod12(pc - STANDARD_TUNING[string]); f <= Math.min(range.hi, FRET_COUNT); f += 12) if (f >= range.lo) out.push(f)
  return out
}

/* ── Estatística ──────────────────────────────────────────────────────── */

export interface Stat {
  /** Perguntas respondidas. */
  n: number
  /** Quantas delas tiveram erro. */
  miss: number
  /** Tempo somado das respostas certas, em ms. */
  ms: number
  /** Quantas entraram no tempo (as certas). */
  hits: number
}

export interface QuizStats {
  /** Por `corda:nota`. */
  cells: Record<string, Stat>
  /** Melhor rodada de 60 s, por tipo de pergunta. */
  best: Partial<Record<QuizKind, number>>
}

export const QUIZ_STATS_KEY = 'guitarlab:quiz'
export const EMPTY_STATS: QuizStats = { cells: {}, best: {} }

export const cellKey = (string: number, pc: number) => `${string}:${pc}`

export function loadStats(): QuizStats {
  try {
    const raw = localStorage.getItem(QUIZ_STATS_KEY)
    if (!raw) return EMPTY_STATS
    const p = JSON.parse(raw)
    return { cells: p && typeof p.cells === 'object' ? p.cells : {}, best: p && typeof p.best === 'object' ? p.best : {} }
  } catch {
    return EMPTY_STATS
  }
}

export function saveStats(s: QuizStats) {
  try {
    localStorage.setItem(QUIZ_STATS_KEY, JSON.stringify(s))
  } catch {
    // Sem armazenamento: o jogo funciona, só não lembra.
  }
}

export function record(stats: QuizStats, string: number, pc: number, ok: boolean, ms: number | null): QuizStats {
  const k = cellKey(string, pc)
  const c = stats.cells[k] ?? { n: 0, miss: 0, ms: 0, hits: 0 }
  const next: Stat = {
    n: c.n + 1,
    miss: c.miss + (ok ? 0 : 1),
    ms: c.ms + (ok && ms != null ? Math.min(ms, 15000) : 0),
    hits: c.hits + (ok && ms != null ? 1 : 0),
  }
  return { ...stats, cells: { ...stats.cells, [k]: next } }
}

/**
 * Quanto aquele par precisa de treino, de 0 (sabe) a 1 (não sabe).
 * Erro pesa mais que demora; nunca visto conta como meio caminho.
 */
export function need(stat: Stat | undefined): number {
  if (!stat || stat.n === 0) return 0.5
  /* Os erros antigos vão perdendo peso: quem errou 3 de 4 no começo e depois acertou
     20 seguidas já sabe. */
  const missRate = stat.miss / (stat.n + 2)
  const avg = stat.hits ? stat.ms / stat.hits / 1000 : 4
  const slow = Math.max(0, Math.min(1, (avg - 1.5) / 4))
  return Math.min(1, missRate * 1.6 + slow * 0.45)
}

/** Sabe? Para o mapa: verde, âmbar, vermelho ou sem dados. */
export type Grade = 'good' | 'mid' | 'bad' | 'new'

export function gradeOf(stat: Stat | undefined): Grade {
  if (!stat || stat.n === 0) return 'new'
  const x = need(stat)
  return x < 0.2 ? 'good' : x < 0.45 ? 'mid' : 'bad'
}

export const GRADE_COLOR: Record<Grade, string> = {
  good: '#6EDBC5',
  mid: '#FFC56B',
  bad: '#FF4D6D',
  new: '#ECE7E0',
}

export const GRADE_NAME: Record<Grade, string> = {
  good: 'sabe',
  mid: 'quase',
  bad: 'errando',
  new: 'sem dados',
}

/* ── Sorteio ──────────────────────────────────────────────────────────── */

export interface Prompt {
  kind: QuizKind
  pc: number
  /** "Na corda": a corda pedida. "Nomear": a corda da casa acesa. */
  string: number | null
  /** "Nomear": a casa acesa. */
  fret: number | null
  /** "Todas": as casas a achar. */
  targets: { string: number; fret: number }[]
  /** Grafia sorteada para o misto. */
  flip: boolean
  /** Para não repetir a mesma pergunta em seguida. */
  id: string
}

interface Pool {
  strings: number[]
  pcs: number[]
  range: Range
}

function weighted<T>(items: T[], weightOf: (t: T) => number): T | null {
  if (items.length === 0) return null
  const ws = items.map((t) => 0.15 + weightOf(t) ** 1.5)
  let r = Math.random() * ws.reduce((a, b) => a + b, 0)
  for (let i = 0; i < items.length; i++) {
    r -= ws[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

/** A próxima pergunta, ou null se a escolha não deixa nada para perguntar. */
export function nextPrompt(kind: QuizKind, pool: Pool, stats: QuizStats, lastId: string | null): Prompt | null {
  const { strings, pcs, range } = pool
  const cell = (s: number, pc: number) => need(stats.cells[cellKey(s, pc)])
  const flip = Math.random() < 0.5

  /* Pares corda × nota que existem no vão. */
  const pairs = strings.flatMap((s) => pcs.filter((pc) => fretsOf(s, pc, range).length > 0).map((pc) => ({ s, pc })))
  if (pairs.length === 0) return null

  const avoid = <T>(list: T[], idOf: (t: T) => string) => {
    const rest = list.filter((t) => idOf(t) !== lastId)
    return rest.length ? rest : list
  }

  if (kind === 'string') {
    const p = weighted(avoid(pairs, (x) => `string:${x.s}:${x.pc}`), (x) => cell(x.s, x.pc))!
    return { kind, pc: p.pc, string: p.s, fret: null, targets: [], flip, id: `string:${p.s}:${p.pc}` }
  }

  if (kind === 'name') {
    const spots = pairs.flatMap((x) => fretsOf(x.s, x.pc, range).map((f) => ({ ...x, f })))
    const p = weighted(avoid(spots, (x) => `name:${x.s}:${x.f}`), (x) => cell(x.s, x.pc))!
    return { kind, pc: p.pc, string: p.s, fret: p.f, targets: [], flip, id: `name:${p.s}:${p.f}` }
  }

  /* Achar e Todas perguntam só a nota: o peso dela é a média das cordas onde ela aparece. */
  const notes = [...new Set(pairs.map((x) => x.pc))]
  const noteNeed = (pc: number) => {
    const on = pairs.filter((x) => x.pc === pc)
    return on.reduce((a, x) => a + cell(x.s, pc), 0) / on.length
  }
  const pc = weighted(avoid(notes, (n) => `${kind}:${n}`), noteNeed)!
  const targets = kind === 'all' ? strings.flatMap((s) => fretsOf(s, pc, range).map((fret) => ({ string: s, fret }))) : []
  return { kind, pc, string: null, fret: null, targets, flip, id: `${kind}:${pc}` }
}
