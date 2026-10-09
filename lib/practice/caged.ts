/* A teoria do treino: progressões, as cinco posições CAGED de um tom e as linhas
 * que os exercícios tocam dentro delas.
 *
 * Veio do CAGED Lab, que calculava tudo no navegador a partir de duas tabelas —
 * as formas abertas dos acordes maiores e menores — e de algumas buscas pequenas.
 * Nada aqui é casa escrita à mão: posição, arpejo, linha na pentatônica e
 * inversão saem das contas.
 *
 * As notas andam como { s, f, midi }: corda (0 = 6ª), casa e altura.
 */
import { FRET_COUNT, STANDARD_TUNING } from '../fretboard'
import type { Names } from '../spelling'

export const OPEN = STANDARD_TUNING
export const mod12 = (x: number) => ((x % 12) + 12) % 12

export type ChordQ = 'maj' | 'min'
export type Tonality = 'min' | 'maj'
export type ProgId = 'pop' | 'menor' | 'desafio' | 'rock'

export interface PNote {
  s: number
  f: number
  midi: number
}

/* Progressões, em graus do tom maior: a menor é a mesma conta lida a partir do vi. */
const PROGS: Record<ProgId, [string, number, ChordQ][]> = {
  pop: [['I', 0, 'maj'], ['V', 7, 'maj'], ['vi', 9, 'min'], ['IV', 5, 'maj']],
  menor: [['vi', 9, 'min'], ['IV', 5, 'maj'], ['I', 0, 'maj'], ['V', 7, 'maj']],
  desafio: [['I', 0, 'maj'], ['V', 7, 'maj'], ['VI', 9, 'maj'], ['IV', 5, 'maj']],
  rock: [['vi', 9, 'min'], ['V', 7, 'maj'], ['IV', 5, 'maj'], ['V', 7, 'maj']],
}

export const PROG_BY: Record<Tonality, { id: ProgId; label: string }[]> = {
  min: [
    { id: 'menor', label: 'i VI III VII' },
    { id: 'rock', label: 'i VII VI VII' },
  ],
  maj: [
    { id: 'pop', label: 'I V vi IV' },
    { id: 'desafio', label: 'I V VI IV' },
  ],
}

const PENT = [0, 2, 4, 7, 9]

/** As formas abertas: nome, casa da fundamental na forma aberta e as casas. */
export const TPL: Record<ChordQ, [string, number, number[]][]> = {
  maj: [
    ['E', 4, [0, 2, 2, 1, 0, 0]],
    ['D', 2, [-1, -1, 0, 2, 3, 2]],
    ['C', 0, [-1, 3, 2, 0, 1, 0]],
    ['A', 9, [-1, 0, 2, 2, 2, 0]],
    ['G', 7, [3, 2, 0, 0, 0, 3]],
  ],
  min: [
    ['Em', 4, [0, 2, 2, 0, 0, 0]],
    ['Dm', 2, [-1, -1, 0, 2, 3, 1]],
    ['Cm', 0, [-1, 3, 1, 0, 1, 3]],
    ['Am', 9, [-1, 0, 2, 2, 1, 0]],
    ['Gm', 7, [3, 1, 0, 0, 3, 3]],
  ],
}

export interface Chord {
  i: number
  roman: string
  q: ChordQ
  root: number
  name: string
  pcs: number[]
}

export function chordPcs(r: number, q: ChordQ): number[] {
  return q === 'maj' ? [r, mod12(r + 4), mod12(r + 7)] : [r, mod12(r + 3), mod12(r + 7)]
}

export function buildChords(keyPc: number, prog: ProgId, names: Names): Chord[] {
  return PROGS[prog].map(([roman, iv, q], i) => {
    const root = mod12(keyPc + iv)
    return { i, roman, q, root, name: names(root) + (q === 'min' ? 'm' : ''), pcs: chordPcs(root, q) }
  })
}

export const outside = (f: number, lo: number, hi: number) => Math.max(0, lo - f, f - hi)

/** Todas as tríades fechadas num grupo de três cordas, dentro de um vão de casas. */
export function triadVoicings(pcs: number[], set: number[], fmin: number, fmax: number, maxSpan = 3): number[][] {
  const out: number[][] = []
  for (let a = fmin; a <= fmax; a++)
    for (let b = fmin; b <= fmax; b++)
      for (let c = fmin; c <= fmax; c++) {
        const fr = [a, b, c]
        const p = fr.map((f, k) => mod12(OPEN[set[k]] + f))
        if (!p.every((x) => pcs.includes(x))) continue
        if (new Set(p).size < 3) continue
        if (Math.max(a, b, c) - Math.min(a, b, c) > maxSpan) continue
        out.push(fr)
      }
  return out
}

export interface LadderShape {
  nm: string
  fr: number[]
  pos: number
}

/** As cinco formas de um acorde subindo o braço, e a primeira de novo uma oitava acima se couber. */
export function ladderFor(rootPc: number, q: ChordQ, keepAll = false): LadderShape[] {
  const out = TPL[q]
    .map(([nm, tr, t]) => {
      let sh = mod12(rootPc - tr)
      let fr = t.map((x) => (x < 0 ? -1 : x + sh))
      if (Math.min(...fr.filter((x) => x >= 0)) < 1) {
        sh += 12
        fr = t.map((x) => (x < 0 ? -1 : x + sh))
      }
      return { nm, fr, pos: Math.min(...fr.filter((x) => x >= 0)) }
    })
    .filter((x) => keepAll || Math.max(...x.fr) <= FRET_COUNT)
    .sort((a, b) => a.pos - b.pos)
  const again = out[0].fr.map((x) => (x < 0 ? -1 : x + 12))
  if (Math.max(...again) <= FRET_COUNT) out.push({ nm: out[0].nm, fr: again, pos: out[0].pos + 12 })
  return out
}

export interface Inversion {
  fr: number[]
  inv: 0 | 1 | 2
  notes: PNote[]
}

export function inversionLadder(ch: { root: number; pcs: number[] }, set: number[]): Inversion[] {
  const v = triadVoicings(ch.pcs, set, 1, FRET_COUNT).sort((a, b) => Math.min(...a) - Math.min(...b) || a[0] - b[0])
  return v.map((fr) => {
    const bass = mod12(OPEN[set[0]] + fr[0])
    const inv = bass === ch.root ? 0 : bass === ch.pcs[1] ? 1 : 2
    return { fr, inv, notes: fr.map((f, k) => ({ s: set[k], f, midi: OPEN[set[k]] + f })) }
  })
}

/** Aranha cromática: um dedo por casa, a permutação em cada corda, da 6ª à 1ª. */
export function spider(perm: string, start: number): (PNote & { finger: number })[] {
  const notes: (PNote & { finger: number })[] = []
  for (let s = 0; s < 6; s++)
    for (const ch of perm) {
      const d = +ch
      const f = start - 1 + d
      notes.push({ s, f, midi: OPEN[s] + f, finger: d })
    }
  return notes
}

export const pentPcs = (keyPc: number) => PENT.map((x) => mod12(keyPc + x))

export interface PentBox {
  forma: number
  start: number
  notes: PNote[]
}

/** As cinco caixas da pentatônica (duas notas por corda), começando pela da relativa menor. */
export function pentBoxes(keyPc: number): PentBox[] {
  const pcs = pentPcs(keyPc)
  const starts: number[] = []
  for (let f = 1; f <= 12; f++) if (pcs.includes(mod12(OPEN[0] + f))) starts.push(f)
  const rel = mod12(keyPc + 9)
  let firstIdx = starts.findIndex((f) => mod12(OPEN[0] + f) === rel)
  if (firstIdx < 0) firstIdx = 0
  const ordered = starts.slice(firstIdx).concat(starts.slice(0, firstIdx))
  return ordered.map((start, k) => {
    const seq: number[] = []
    let m = OPEN[0] + start
    while (seq.length < 12) {
      if (pcs.includes(mod12(m))) seq.push(m)
      m++
    }
    const notes = seq.map((midi, i) => {
      const s = Math.floor(i / 2)
      return { s, f: midi - OPEN[s], midi }
    })
    return { forma: k + 1, start, notes }
  })
}

/* Penta diagonal (o método de Daniel Seriff): sai sempre da tônica e sobe a escala em grupos
   de 3 e 2 notas por corda, alternando — duas casas acima a cada corda, três ao entrar na Si.
   - maior, 3-2: 1 2 3 na corda de saída, 5 6 na seguinte, e assim por diante
     (Mi maior da 6ª: 0 2 4 | 2 4 | 2 4 6 | 4 6 | 5 7 9 | 7 9 12);
   - menor, 1 + 3-2: só a tônica na corda de saída, depois ♭3 4 5 e ♭7 1 alternando
     (Mi menor da 6ª: 12 | 10 12 14 | 12 14 | 12 14 16 | 15 17 | 15 17).
   A 1ª corda fecha com número fixo de notas: 3 no maior (5 6 1, voltando à tônica, quando
   cairia o par) e 2 no menor (♭3 4, quando cairia o trio). */
const PENT_UP = [0, 2, 4, 7, 9]

export interface Diagonal {
  /** Quantas notas na corda de saída: 1 no menor (só a tônica), 3 no maior. */
  first: 3 | 1
  /** A corda de onde a diagonal sai (0 = 6ª): a raiz pode estar em qualquer uma. */
  start: number
  notes: PNote[]
}

/** O nome da célula: 3-2 no maior, e a tônica sozinha antes dela no menor. */
export const diagCell = (minor: boolean) => (minor ? '1 + 3-2' : '3-2')

/** As cordas de onde a diagonal pode sair: da 6ª à 2ª. */
export const DIAG_STARTS = [0, 1, 2, 3, 4]

/** Quantas notas a diagonal toca em cada corda, da de saída até a 1ª. */
function diagCounts(start: number, minor: boolean): number[] {
  const counts: number[] = minor ? [1] : []
  let trio = true
  while (start + counts.length < 5) {
    counts.push(trio ? 3 : 2)
    trio = !trio
  }
  counts.push(minor ? 2 : 3)
  return counts
}

/** As diagonais do tom, inteiras, saindo de cada corda e em cada oitava que cabe no braço.
 * A escala sobe nota a nota na pentatônica; a corda Si soma uma casa sozinha,
 * porque a conta é feita em altura, não em desenho. */
export function diagonals(keyPc: number, minor: boolean, maxFret = FRET_COUNT): Diagonal[] {
  const out: Diagonal[] = []
  const tonicPc = mod12(keyPc + (minor ? 9 : 0))
  for (const start of DIAG_STARTS)
    for (let oct = 0; oct <= 1; oct++) {
      const f0 = mod12(tonicPc - OPEN[start]) + 12 * oct
      const notes: PNote[] = []
      let m = OPEN[start] + f0
      diagCounts(start, minor).forEach((n, i) => {
        const s = start + i
        for (let k = 0; k < n; k++) {
          while (!PENT_UP.includes(mod12(m - keyPc))) m++
          notes.push({ s, f: m - OPEN[s], midi: m })
          m++
        }
      })
      if (notes.every((n) => n.f >= 0 && n.f <= maxFret)) out.push({ first: minor ? 1 : 3, start, notes })
    }
  return out.sort((a, b) => a.start - b.start || a.notes[0].f - b.notes[0].f)
}

/** Grupos de n notas seguidas: em 3s, 1 2 3, 2 3 4, 3 4 5… */
export function groups<T>(notes: T[], n: number): T[] {
  const out: T[] = []
  for (let i = 0; i + n <= notes.length; i++) out.push(...notes.slice(i, i + n))
  return out
}

export const threes = <T,>(notes: T[]) => groups(notes, 3)

export function rootPositions(pc: number): PNote[] {
  const out: PNote[] = []
  for (let s = 0; s < 6; s++) for (let f = 1; f <= 15; f++) if (mod12(OPEN[s] + f) === pc) out.push({ s, f, midi: OPEN[s] + f })
  return out
}

/* ── Posições ─────────────────────────────────────────────────────────── */

export interface Position {
  id: number
  /** Forma do acorde maior do tom. */
  shape: string
  /** O nome que aparece: a forma da tônica — maior, ou a menor relativa. */
  label: string
  lo: number
  hi: number
}

/** As 5 posições CAGED do tom: a região de cada forma do acorde I, com 1 casa de folga. */
export function positions(keyPc: number): Omit<Position, 'label'>[] {
  return ladderFor(keyPc, 'maj', true)
    .slice(0, 5)
    .map((sh, i) => {
      const fs = sh.fr.filter((f) => f >= 0)
      return { id: i + 1, shape: sh.nm, lo: Math.max(1, Math.min(...fs) - 1), hi: Math.min(FRET_COUNT, Math.max(...fs) + 1) }
    })
}

/** Cada forma maior divide a região com a forma menor relativa: E/Dm, D/Cm, C/Am, A/Gm, G/Em. */
export const MINOR_LABEL: Record<string, string> = { E: 'Dm', D: 'Cm', C: 'Am', A: 'Gm', G: 'Em' }

/** O grau de uma nota do acorde, na mesma escrita da consulta: 1, 3 ou ♭3, 5. */
export function degree(pc: number, ch: { root: number; pcs: number[]; q: ChordQ }): string {
  if (pc === ch.root) return '1'
  if (pc === ch.pcs[1]) return ch.q === 'min' ? '♭3' : '3'
  return '5'
}

export interface Tone extends PNote {
  deg: string
}

export function tonesIn(ch: Chord, lo: number, hi: number): Tone[] {
  const out: Tone[] = []
  for (let s = 0; s < 6; s++)
    for (let f = Math.max(0, lo); f <= hi; f++) {
      const m = OPEN[s] + f
      const pc = mod12(m)
      if (ch.pcs.includes(pc)) out.push({ s, f, midi: m, deg: degree(pc, ch) })
    }
  return out
}

export interface FullVoicing {
  nm: string
  fr: number[]
  notes: Tone[]
}

/** A forma CAGED completa (5 ou 6 cordas) do acorde que mais cabe na posição. */
export function fullVoicing(ch: Chord, lo: number, hi: number): FullVoicing {
  let best: FullVoicing | null = null
  let bc = 1e9
  for (const [nm, tr, t] of TPL[ch.q]) {
    const base = mod12(ch.root - tr)
    for (const sh of [base - 12, base, base + 12]) {
      const fr = t.map((x) => (x < 0 ? -1 : x + sh))
      const pl = fr.filter((f) => f >= 0)
      if (pl.length !== t.filter((x) => x >= 0).length || Math.min(...pl) < 0 || Math.max(...pl) > FRET_COUNT) continue
      if (fr.some((f, s) => t[s] >= 0 && f < 0)) continue
      const out = pl.reduce((a, f) => a + Math.max(0, lo - f, f - hi), 0)
      const opens = pl.filter((f) => f === 0).length
      const c = out * 3 + (lo > 2 ? opens * 3 : 0) + (Math.max(...pl) - Math.min(...pl)) * 0.2
      if (c < bc) {
        bc = c
        best = {
          nm,
          fr,
          notes: fr
            .map((f, s) => (f < 0 ? null : { s, f, midi: OPEN[s] + f, deg: degree(mod12(OPEN[s] + f), ch) }))
            .filter((n): n is Tone => n !== null),
        }
      }
    }
  }
  return best as FullVoicing
}

/** A casa para uma altura: perto da anterior, dentro da posição. */
export function placeIn(midi: number, prev: PNote | null, lo: number, hi: number): PNote {
  let best: PNote | null = null
  let bc = 1e9
  for (let s = 0; s < 6; s++) {
    const f = midi - OPEN[s]
    if (f < 0 || f > FRET_COUNT) continue
    const out = Math.max(0, lo - f, f - hi)
    const c = (prev ? Math.abs(f - prev.f) + 1.5 * Math.abs(s - prev.s) : s * 0.5) + 5 * out
    if (c < bc) {
      bc = c
      best = { s, f, midi }
    }
  }
  return best as PNote
}

export interface PosChord extends Chord {
  voicing: FullVoicing
  tones: Tone[]
  third: number
}

export function pitchesIn(pcs: number[], lo: number, hi: number): number[] {
  const out: number[] = []
  for (let s = 0; s < 6; s++)
    for (let f = Math.max(0, lo - 1); f <= hi + 1; f++) {
      const m = OPEN[s] + f
      if (pcs.includes(mod12(m)) && !out.includes(m)) out.push(m)
    }
  return out.sort((a, b) => a - b)
}

/** 7 colcheias pela pentatônica, de um alvo até a vizinhança do próximo. */
export function walk(start: number, next: number, SC: number[]): number[] {
  for (const endMax of [3, 4, 6]) {
    let best: number[] | null = null
    let bc = 1e9
    const seq = [start]
    const rec = (k: number, cost: number) => {
      if (cost >= bc) return
      const last = seq[seq.length - 1]
      if (k === 7) {
        const d = Math.abs(next - last)
        if (d < 1 || d > endMax) return
        bc = cost
        best = seq.slice(1)
        return
      }
      for (const p of SC) {
        const d = p - last
        const ad = Math.abs(d)
        if (ad < 1 || ad > 5 || p === next) continue
        let c = cost + (ad > 3 ? 1.5 : 0)
        if (seq.length >= 2) {
          const pd = Math.sign(last - seq[seq.length - 2])
          if (Math.sign(d) !== pd) c += 1.2
          if (p === seq[seq.length - 2]) c += 2
        }
        seq.push(p)
        rec(k + 1, c)
        seq.pop()
      }
    }
    rec(0, 0)
    if (best) return best
  }
  return []
}
