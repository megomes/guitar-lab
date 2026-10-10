/* Acordes V3: as formas que estou decorando agora.
 *
 * Quatro acordes — maior, menor, maior com 7ª (dominante) e menor com 7ª —, cada um
 * em duas cordas-raiz (6ª e 5ª) e em dois tamanhos: a pestana inteira (forma E na 6ª,
 * forma A na 5ª) e a tríade/shell de três notas. Sem inversões.
 *
 * Tudo é escrito a partir da casa da fundamental `r`, em casas relativas por corda
 * (da 6ª para a 1ª; `null` é corda que não soa). Em Sol, com a raiz na 6ª corda na
 * casa 3, sai exatamente o que o professor passou:
 *   pestana: 3 5 5 4 3 3 · 3 5 5 3 3 3 · 3 5 3 4 3 3 · 3 5 3 3 3 3
 *   tríade:  3 2 0 · 3 1 0 · 3 2 3 ou 3 x 3 4 · 3 1 3 ou 3 x 3 3
 * Na 5ª corda é o mesmo desenho uma corda acima, e a corda Si soma uma casa.
 */
import { STANDARD_TUNING } from './fretboard'

const mod12 = (x: number) => ((x % 12) + 12) % 12

export type V3Quality = 'maj' | 'min' | 'dom7' | 'min7'
export type V3Root = 6 | 5
export type V3Kind = 'barre' | 'triad'

export interface V3Row {
  q: V3Quality
  name: string
  /** A cifra comum e a do jazz, depois da nota. */
  sym: string
  jazz: string
  /** O que muda em relação ao maior, em uma linha. */
  how: string
}

export const V3_ROWS: V3Row[] = [
  { q: 'maj', name: 'Maior', sym: '', jazz: '', how: 'a base: 1, 3 e 5' },
  { q: 'min', name: 'Menor', sym: 'm', jazz: '−', how: 'a terça desce 1 casa e vira ♭3' },
  { q: 'dom7', name: 'Maior com 7ª', sym: '7', jazz: '7', how: 'entra a ♭7, na casa da fundamental' },
  { q: 'min7', name: 'Menor com 7ª', sym: 'm7', jazz: '−7', how: 'as duas mudanças juntas: ♭3 e ♭7' },
]

const N = null
type Off = (number | null)[]

/** As pestanas, em casas a partir da fundamental. */
const BARRE: Record<V3Root, Record<V3Quality, Off>> = {
  6: {
    maj: [0, 2, 2, 1, 0, 0],
    min: [0, 2, 2, 0, 0, 0],
    dom7: [0, 2, 0, 1, 0, 0],
    min7: [0, 2, 0, 0, 0, 0],
  },
  5: {
    maj: [N, 0, 2, 2, 2, 0],
    min: [N, 0, 2, 2, 1, 0],
    dom7: [N, 0, 2, 0, 2, 0],
    min7: [N, 0, 2, 0, 1, 0],
  },
}

/** As tríades e os shells. As de 7ª têm duas: colada (três cordas vizinhas, a tríade com a
 * ♭7 no lugar da 5ª) e pulando uma corda (a pestana sem as notas repetidas). */
const TRIAD: Record<V3Root, Record<V3Quality, Off[]>> = {
  6: {
    maj: [[0, -1, -3, N, N, N]],
    min: [[0, -2, -3, N, N, N]],
    dom7: [[0, -1, 0, N, N, N], [0, N, 0, 1, N, N]],
    min7: [[0, -2, 0, N, N, N], [0, N, 0, 0, N, N]],
  },
  5: {
    maj: [[N, 0, -1, -3, N, N]],
    min: [[N, 0, -2, -3, N, N]],
    dom7: [[N, 0, -1, 0, N, N], [N, 0, N, 0, 2, N]],
    min7: [[N, 0, -2, 0, N, N], [N, 0, N, 0, 1, N]],
  },
}

/** O nome de cada variante de três notas. */
export const TRIAD_VARIANT = ['colada', 'pulando corda'] as const

const DEGREE: Record<number, string> = { 0: '1', 3: '♭3', 4: '3', 7: '5', 10: '♭7' }

export interface V3Note {
  /** Corda (0 = 6ª) e casa. */
  s: number
  f: number
  pc: number
  deg: string
}

export interface V3Shape {
  frets: (number | null)[]
  notes: V3Note[]
  /** Como se escreve: "3 5 5 4 3 3", "3 x 3 4 x x". */
  tab: string
}

/** A corda da fundamental (0 = 6ª, 1 = 5ª). */
export const rootString = (root: V3Root) => (root === 6 ? 0 : 1)

/** A casa da fundamental: da 3 em diante, para a tríade (que desce três casas) caber
 * sem casa negativa e ficar na mesma região da pestana. */
export function rootFret(pc: number, root: V3Root): number {
  const base = mod12(pc - STANDARD_TUNING[rootString(root)])
  return base >= 3 ? base : base + 12
}

function build(pc: number, r: number, off: Off): V3Shape {
  const frets = off.map((o) => (o === null ? null : r + o))
  const notes: V3Note[] = []
  frets.forEach((f, s) => {
    if (f === null) return
    const npc = mod12(STANDARD_TUNING[s] + f)
    notes.push({ s, f, pc: npc, deg: DEGREE[mod12(npc - pc)] ?? '?' })
  })
  return { frets, notes, tab: frets.map((f) => (f === null ? 'x' : String(f))).join(' ') }
}

export interface V3Set {
  root: V3Root
  /** A casa da fundamental. */
  r: number
  /** A mesma moldura para todos os diagramas da corda: da casa r−3 à r+2. */
  frame: { first: number; rows: number }
  barre: Record<V3Quality, V3Shape>
  triad: Record<V3Quality, V3Shape[]>
}

export const V3_FRAME_ROWS = 6

export function v3Set(pc: number, root: V3Root): V3Set {
  const r = rootFret(pc, root)
  const barre = {} as Record<V3Quality, V3Shape>
  const triad = {} as Record<V3Quality, V3Shape[]>
  for (const row of V3_ROWS) {
    barre[row.q] = build(pc, r, BARRE[root][row.q])
    triad[row.q] = TRIAD[root][row.q].map((off) => build(pc, r, off))
  }
  return { root, r, frame: { first: r - 3 <= 0 ? 1 : r - 3, rows: V3_FRAME_ROWS }, barre, triad }
}

export interface V3Move {
  s: number
  from: number
  to: number
  degFrom: string
  degTo: string
}

/** O que mudou de uma forma para outra, corda a corda (só as cordas que soam nas duas). */
export function moves(a: V3Shape, b: V3Shape): V3Move[] {
  const out: V3Move[] = []
  for (const nb of b.notes) {
    const na = a.notes.find((n) => n.s === nb.s)
    if (na && na.f !== nb.f) out.push({ s: nb.s, from: na.f, to: nb.f, degFrom: na.deg, degTo: nb.deg })
  }
  return out
}
