/* A posição da noite e os seis exercícios dela.
 *
 * Do CAGED Lab: a tônica, a progressão e uma das cinco posições escolhem tudo.
 * Cada exercício devolve a mesma coisa — compassos para a tab e para o som, as
 * casas para o braço e o texto do "Como funciona" — e as telas só desenham.
 */
import { LONG_FRET_COUNT, type ShapeId } from '../fretboard'
import type { LegendItem, Mark, NeckWindow, Pin, Shift } from '../marks'
import { CHORD_COLOR, OUTSIDE_COLOR, ROLE_COLOR, degreeColor } from '../roles'
import { keyOf, namesForKey, type Names } from '../spelling'
import {
  MINOR_LABEL,
  OPEN,
  buildChords,
  chordPcs,
  degree,
  diagStair,
  diagonals,
  diagRoot,
  fullVoicing,
  mod12,
  pentBoxes,
  pentPcs,
  pitchesIn,
  placeIn,
  positions,
  tonesIn,
  walk,
  type Chord,
  type Diagonal,
  type PNote,
  type PosChord,
  type Position,
  type ProgId,
  type Tonality,
} from './caged'

/* ── Compassos ────────────────────────────────────────────────────────── */

export type NoteRole = 'deg' | 'target' | 'pass'

export interface TabNote extends PNote {
  role: NoteRole
  deg?: string
  color?: string
  /** No braço, no lugar do nome da nota. */
  label?: string
}

export type FollowKey = 'cagedSel' | 'accSel'

export interface TabEvent {
  col: number
  notes: TabNote[]
  /** Ao soar, a tela passa a mostrar esta opção (a forma da escada, o acorde). */
  follow?: { k: FollowKey; v: number }
}

export interface BarHead {
  dot?: string
  text: string
  sub?: string
}

export interface Bar {
  /** O acorde da progressão que soa no compasso. Ao tocar, a tela acompanha. */
  ci: number | null
  head?: BarHead
  events: TabEvent[]
}

/* ── A posição ────────────────────────────────────────────────────────── */

export interface Practice {
  tonicPc: number
  minor: boolean
  keyPc: number
  names: Names
  positions: Position[]
  pos: Position
  chords: PosChord[]
  pent: number[]
  tonicChord: Chord
  /** A caixa da pentatônica (2 notas por corda) que mora na posição. */
  box: { forma: number; notes: PNote[] }
  /** A penta diagonal (3-2) que mais passa pela posição. */
  diag: Diagonal
}

/** A letra da forma de uma posição: "Em" → E. É o elo com a forma da consulta. */
export const shapeOf = (p: Position) => p.label[0] as ShapeId

export function computePractice(tonicPc: number, tonality: Tonality, prog: ProgId, shape: ShapeId): Practice {
  const minor = tonality === 'min'
  const keyPc = keyOf(tonicPc, minor)
  const names = namesForKey(keyPc)
  const ps: Position[] = positions(keyPc).map((p) => ({ ...p, label: minor ? MINOR_LABEL[p.shape] : p.shape }))
  const pos = ps.find((p) => shapeOf(p) === shape) ?? ps[0]
  const chords: PosChord[] = buildChords(keyPc, prog, names).map((c) => ({
    ...c,
    voicing: fullVoicing(c, pos.lo, pos.hi),
    tones: tonesIn(c, pos.lo, pos.hi),
    third: c.pcs[1],
  }))
  const q = minor ? 'min' : 'maj'
  const tonicChord: Chord = {
    i: -1,
    roman: minor ? 'vi' : 'I',
    q,
    root: tonicPc,
    pcs: chordPcs(tonicPc, q),
    name: names(tonicPc) + (minor ? 'm' : ''),
  }
  const pent = pentPcs(keyPc)

  let box: Practice['box'] | null = null
  let bc = 1e9
  for (const b of pentBoxes(keyPc))
    for (const sh of [0, 12, -12]) {
      const notes = b.notes.map((n) => ({ s: n.s, f: n.f + sh, midi: n.midi + sh }))
      if (notes.some((n) => n.f < 0 || n.f > 17)) continue
      const c = notes.reduce((a, n) => a + Math.max(0, pos.lo - n.f, n.f - pos.hi), 0)
      if (c < bc) {
        bc = c
        box = { forma: b.forma, notes }
      }
    }

  /* A diagonal com mais notas dentro da posição; no empate, a que sai dela (corda mais grave). */
  const away = (n: PNote) => Math.max(0, pos.lo - n.f, n.f - pos.hi)
  let diag: Diagonal | null = null
  let dc = 1e9
  for (const d of diagonals(keyPc)) {
    const notes = d.notes
    const low = notes.filter((n) => n.s === notes[0].s)
    const c = -notes.filter((n) => away(n) === 0).length + 0.01 * low.reduce((a, n) => a + away(n), 0)
    if (c < dc) {
      dc = c
      diag = d
    }
  }

  return { tonicPc, minor, keyPc, names, positions: ps, pos, chords, pent, tonicChord, box: box!, diag: diag! }
}

export const modeName = (P: Practice) => (P.minor ? 'menor' : 'maior')
export const tonicName = (P: Practice) => P.names(P.tonicPc)
export const otherName = (P: Practice) =>
  P.minor ? `${P.names(P.keyPc)} maior` : `${P.names(mod12(P.keyPc + 9))} menor`

/** O grau romano lido a partir da tônica menor, quando ela é a menor. */
export function romanOf(P: Practice, c: Chord): string {
  if (!P.minor) return c.roman
  return ({ vi: 'i', IV: 'VI', I: 'III', V: 'VII', VI: 'I' } as Record<string, string>)[c.roman] ?? c.roman
}

export const chordColor = (c: Chord) =>
  ({ I: CHORD_COLOR.I, V: CHORD_COLOR.V, vi: CHORD_COLOR.vi, VI: CHORD_COLOR.vi, IV: CHORD_COLOR.IV })[c.roman] ??
  CHORD_COLOR.V

/** Grau na pentatônica: no menor 1 ♭3 4 5 ♭7, no maior 1 2 3 5 6. */
export function pentDeg(pc: number, root: number, minor: boolean): string {
  const i = mod12(pc - root)
  const map: Record<number, string> = minor ? { 0: '1', 3: '♭3', 5: '4', 7: '5', 10: '♭7' } : { 0: '1', 2: '2', 4: '3', 7: '5', 9: '6' }
  return map[i] ?? ''
}

const chordHead = (c: Chord): BarHead => ({ dot: chordColor(c), text: c.name })

/** A cor de cada nota da tab: passagem fica neutra, o resto pela cor do grau. */
function colorNotes(events: TabEvent[]): TabEvent[] {
  return events.map((e) => ({
    ...e,
    notes: e.notes.map((n) =>
      n.role === 'pass' ? n : { ...n, color: n.role === 'target' && !n.deg ? ROLE_COLOR.third : degreeColor(n.deg ?? '') },
    ),
  }))
}

/* ── As linhas ────────────────────────────────────────────────────────── */

/** Arpejos: colcheias sem parar pelas notas do acorde; na troca, a nota mais próxima do próximo. */
function arpLine(P: Practice, loops = 2): Bar[] {
  const { lo, hi } = P.pos
  const C = P.chords
  const n = C.length
  const lists = C.map((c) => [...new Set(c.tones.map((t) => t.midi))].sort((a, b) => a - b))
  const bars: Bar[] = []
  let cur: number | null = null
  let dir = 1
  let prev: PNote | null = null
  for (let b = 0; b < n * loops; b++) {
    const ci = b % n
    const L = lists[ci]
    const ev: TabEvent[] = []
    for (let k = 0; k < 8; k++) {
      let p: number
      if (cur === null) p = L.find((m) => mod12(m) === C[ci].root) as number
      else if (k === 0) {
        const c0: number = cur
        const up = L.find((m) => m > c0)
        const dn = [...L].reverse().find((m) => m < c0)
        if (dir > 0) {
          if (up != null) p = up
          else {
            dir = -1
            p = dn as number
          }
        } else if (dn != null) p = dn
        else {
          dir = 1
          p = up as number
        }
      } else {
        let i = L.indexOf(cur) + dir
        if (i < 0 || i >= L.length) {
          dir = -dir
          i = L.indexOf(cur) + dir
        }
        p = L[i]
      }
      cur = p
      const ps = placeIn(p, prev, lo, hi)
      prev = ps
      ev.push({ col: k, notes: [{ ...ps, role: 'deg', deg: degree(mod12(p), C[ci]) }] })
    }
    bars.push({ ci, events: ev })
  }
  return bars
}

/** Pentatônica do tom o tempo todo; no tempo 1, a terça de cada acorde. */
function pentLine(P: Practice): Bar[] {
  const { lo, hi } = P.pos
  const C = P.chords
  const n = C.length
  const mid = (OPEN[2] + OPEN[4] + lo + hi) / 2
  const T: number[] = []
  let ref = mid
  for (let i = 0; i < n; i++) {
    const wanted = [...new Set(C[i].tones.filter((t) => mod12(t.midi) === C[i].third).map((t) => t.midi))]
    // Numa posição apertada a única terça pode ser a própria nota de partida:
    // aí ela mesma serve, em vez de ficar sem alvo.
    const pool = wanted.filter((m) => m !== ref).length ? wanted.filter((m) => m !== ref) : wanted.length ? wanted : C[i].tones.map((t) => t.midi)
    const t = pool.reduce((a, b) => (Math.abs(b - ref) < Math.abs(a - ref) ? b : a))
    T.push(t)
    ref = t
  }
  const SC = pitchesIn(P.pent, lo, hi)
  let prev: PNote | null = null
  return C.map((c, i) => {
    const path = [T[i]].concat(walk(T[i], T[(i + 1) % n], SC))
    return {
      ci: i,
      events: path.map((m, k) => {
        const ps = placeIn(m, prev, lo, hi)
        prev = ps
        const pc = mod12(m)
        const isT = c.pcs.includes(pc)
        const note: TabNote =
          k === 0
            ? { ...ps, role: 'target', deg: degree(pc, c) }
            : isT
              ? { ...ps, role: 'deg', deg: degree(pc, c) }
              : { ...ps, role: 'pass' }
        return { col: k, notes: [note] }
      }),
    }
  })
}

/** Acordes cheios: a progressão com as formas CAGED completas da posição. */
function fullBase(P: Practice): Bar[] {
  return P.chords.map((c, i) => ({
    ci: i,
    events: [0, 2, 4, 6].map((col) => ({ col, notes: c.voicing.notes.map((n) => ({ ...n, role: 'deg' as const })) })),
  }))
}

/** Um acorde no braço todo: o arpejo do acorde da tônica nas 5 formas, subindo o braço. */
function neckArp(P: Practice): Bar[] {
  const I = P.tonicChord
  return P.positions.map((ps) => {
    const L = [...new Set(tonesIn(I as PosChord, ps.lo, ps.hi).map((t) => t.midi))].sort((a, b) => a - b)
    const st = Math.max(0, L.findIndex((m) => mod12(m) === I.root))
    const seq = L.slice(st, st + 12)
    let prev: PNote | null = null
    return {
      ci: null,
      head: { dot: CHORD_COLOR.I, text: `${I.name} forma ${ps.label}` },
      events: seq.map((m, k) => {
        const p = placeIn(m, prev, ps.lo, ps.hi)
        prev = p
        return { col: k, notes: [{ ...p, role: 'deg' as const, deg: degree(mod12(m), I) }] }
      }),
    }
  })
}

/** Forma da penta: do root sobe até o topo, desce até a nota mais grave e volta ao root. */
function boxLine(P: Practice): Bar[] {
  const notes = P.box.notes.slice().sort((a, b) => a.midi - b.midi)
  let r = notes.findIndex((n) => mod12(n.midi) === P.tonicPc)
  if (r < 0) r = 0
  const idx: number[] = []
  for (let i = r; i < notes.length; i++) idx.push(i)
  for (let i = notes.length - 2; i >= 0; i--) idx.push(i)
  for (let i = 1; i <= r; i++) idx.push(i)
  const seq = idx.map((i) => notes[i])
  const bars: Bar[] = []
  for (let i = 0; i < seq.length; i += 8) {
    bars.push({
      ci: null,
      head: i === 0 ? { dot: CHORD_COLOR.I, text: `${tonicName(P)} ${modeName(P)}` } : undefined,
      events: seq.slice(i, i + 8).map((n, k) => {
        const d = pentDeg(mod12(n.midi), P.tonicPc, P.minor)
        return { col: k, notes: [{ ...n, role: 'deg' as const, deg: d, color: degreeColor(d) }] }
      }),
    })
  }
  return bars
}

/** Penta diagonal: sobe as 15 notas da 6ª à 1ª corda, 3-2-3-2-3-2, e desce de volta. */
function diagLine(P: Practice): Bar[] {
  const d = P.diag.notes
  const seq = d.concat(d.slice(0, -1).reverse())
  const bars: Bar[] = []
  for (let i = 0; i < seq.length; i += 8) {
    bars.push({
      ci: null,
      head: i === 0 ? { dot: CHORD_COLOR.I, text: `${tonicName(P)} ${modeName(P)}`, sub: '3-2' } : undefined,
      events: seq.slice(i, i + 8).map((n, k) => {
        const g = pentDeg(mod12(n.midi), P.tonicPc, P.minor)
        return { col: k, notes: [{ ...n, role: 'deg' as const, deg: g, color: degreeColor(g) }] }
      }),
    })
  }
  return bars
}

/** A posição CAGED de uma forma da penta: a que mais divide casas com ela, oitava à parte. */
export function positionOf(P: Practice, notes: PNote[]): Position {
  const fit = (p: Position) => notes.filter((n) => mod12(n.f - p.lo) <= p.hi - p.lo).length
  return P.positions.reduce((a, p) => (fit(p) > fit(a) ? p : a))
}

/** O braço da penta diagonal com a escada: a diagonal acesa, o resto da penta fantasma, um
 * recorte tracejado por par de cordas com o nome da forma CAGED e um arco na troca de forma. */
export function diagNeck(P: Practice, diag: PNote[], labelOf: (p: Position) => string = (p) => `forma ${p.label}`) {
  const marks: Mark[] = []
  for (let s = 0; s < 6; s++)
    for (let f = 0; f <= LONG_FRET_COUNT; f++) {
      const pc = mod12(OPEN[s] + f)
      if (!P.pent.includes(pc)) continue
      const on = diag.some((n) => n.s === s && n.f === f)
      marks.push({ string: s, fret: f, pc, degree: pentDeg(pc, P.tonicPc, P.minor), level: on ? 'on' : 'ghost' })
    }
  const steps = diagStair(P.keyPc, diag)
  const windows: NeckWindow[] = steps.map((st) => {
    const fs = st.inBox.map((n) => n.f)
    const from = Math.min(...fs)
    const to = Math.max(...fs)
    return { from, to, strings: st.strings, label: labelOf(positionOf(P, st.box)), labelSide: st.borrowed.f > to ? 'left' : 'right' }
  })
  /* A seta sobe o braço: da nota de baixo para a de cima, entre a emprestada e a vizinha dela na forma. */
  const shifts: Shift[] = steps.map((st) => {
    const b = st.borrowed
    const near = st.inBox.filter((n) => n.s === b.s).reduce((a, n) => (Math.abs(n.f - b.f) < Math.abs(a.f - b.f) ? n : a))
    return { string: b.s, from: Math.min(b.f, near.f), to: Math.max(b.f, near.f) }
  })
  const fs = diag.map((n) => n.f)
  return { marks, windows, shifts, focus: { from: Math.min(...fs), to: Math.max(...fs) }, frets: LONG_FRET_COUNT }
}

/** As 5 formas da penta em ordem no braço, da mais grave, com o nome da posição CAGED de cada uma. */
export function neckBoxes(P: Practice): { label: string; notes: PNote[] }[] {
  const all: PNote[][] = []
  for (const b of pentBoxes(P.keyPc))
    for (const sh of [-12, 0, 12]) {
      const notes = b.notes.map((n) => ({ s: n.s, f: n.f + sh, midi: n.midi + sh }))
      if (notes.every((n) => n.f >= 0 && n.f <= 17)) all.push(notes)
    }
  all.sort((a, b) => a[0].f - b[0].f)
  return all.slice(0, 5).map((notes) => ({ label: positionOf(P, notes).label, notes }))
}

/** Zigue-zague: sobe a forma 1, desce a 2, sobe a 3… até a última, e volta pelo mesmo caminho.
 * A troca de forma é um passo na corda da ponta (1ª em cima, 6ª embaixo), como na diagonal. */
function zigLine(P: Practice): Bar[] {
  const B = neckBoxes(P)
  const order = B.map((_, i) => i).concat(B.map((_, i) => B.length - 1 - i))
  return order.map((bi, k) => {
    const up = k % 2 === 0
    const notes = B[bi].notes.slice().sort((a, b) => (up ? a.midi - b.midi : b.midi - a.midi))
    return {
      ci: null,
      head: { dot: CHORD_COLOR.I, text: `Forma ${B[bi].label}`, sub: up ? 'sobe' : 'desce' },
      events: notes.map((n, c) => {
        const g = pentDeg(mod12(n.midi), P.tonicPc, P.minor)
        return { col: c, notes: [{ ...n, role: 'deg' as const, deg: g, color: degreeColor(g) }] }
      }),
    }
  })
}

/* ── Os exercícios ────────────────────────────────────────────────────── */

export type ExerciseId = 'box' | 'diag' | 'zig' | 'arp' | 'penta' | 'base' | 'neck'

export const EXERCISES: { id: ExerciseId; name: string; cols: number }[] = [
  { id: 'box', name: 'Forma da penta', cols: 8 },
  { id: 'diag', name: 'Penta diagonal', cols: 8 },
  { id: 'zig', name: 'Zigue-zague das formas', cols: 12 },
  { id: 'arp', name: 'Arpejos encadeados', cols: 8 },
  { id: 'penta', name: 'Penta até a terça', cols: 8 },
  { id: 'base', name: 'Acordes cheios', cols: 8 },
  { id: 'neck', name: 'Um acorde no braço todo', cols: 12 },
]

/** Os exercícios que olham para um acorde da progressão de cada vez. */
export const followsChord = (id: ExerciseId) => id === 'arp' || id === 'penta' || id === 'base'

export function exerciseBars(id: ExerciseId, P: Practice): Bar[] {
  if (id === 'box') return boxLine(P)
  if (id === 'diag') return diagLine(P)
  if (id === 'zig') return zigLine(P)
  if (id === 'neck') return neckArp(P).map((b) => ({ ...b, events: colorNotes(b.events) }))
  const raw = id === 'arp' ? arpLine(P, 2) : id === 'penta' ? pentLine(P) : fullBase(P)
  return raw.map((b) => {
    const c = P.chords[b.ci as number]
    return {
      ci: b.ci,
      head: chordHead(c),
      events: colorNotes(b.events),
    }
  })
}

const SRC = {
  zig: '<a href="https://blog.truefire.com/guitar-lessons/metal-pentatonic-workout/" target="_blank" rel="noopener">TrueFire</a> e <a href="https://www.guitarhabits.com/pentatonic-scale-shape-exercises-around-the-fretboard/" target="_blank" rel="noopener">Guitar Habits</a>',
  arp: '<a href="https://www.jazzguitar.be/forum/improvisation/64528-arpeggio-practice.html" target="_blank" rel="noopener">jazzguitar.be</a>',
  penta: '<a href="https://jgmusiclessons.com/how-to-use-chord-tones-to-get-better-at-improvising/" target="_blank" rel="noopener">JG Music Lessons</a>',
  neck: '<a href="https://appliedguitartheory.com/lessons/navigating-with-caged-is-hard-until-you-do-this/" target="_blank" rel="noopener">Applied Guitar Theory</a> e <a href="https://www.musicradar.com/how-to/guitar-lesson-learn-chords-across-the-fretboard-quickly-and-easily" target="_blank" rel="noopener">MusicRadar</a>',
}

export interface HowText {
  /** HTML curto, com <b> e <span class="warn">. Todo o texto é do próprio app. */
  how: string
  more: string[]
  src?: string
}

export function exerciseText(id: ExerciseId, P: Practice): HowText {
  const C = P.chords
  const I = P.tonicChord
  const nn = P.names
  const outs = C.filter((c) => !P.pent.includes(c.third)).map((c) => `${nn(c.third)} do ${c.name}`)
  const key = `${tonicName(P)} ${modeName(P)}`
  if (id === 'box')
    return {
      how: `A forma da pentatônica de <b>${key}</b> nesta posição, nas 6 cordas. Começa no root, sobe até o topo, desce até a nota mais grave e volta ao root.`,
      more: [
        'Ache o root (laranja) na corda mais grave da forma.',
        'Suba nota a nota até a corda e, desça até a corda E e volte ao root.',
        'Diga o grau de cada nota: no menor 1 ♭3 4 5 ♭7, no maior 1 2 3 5 6.',
        'Faça nas 5 posições e repare que cada forma da penta encaixa na forma de acorde CAGED dela.',
      ],
    }
  if (id === 'arp')
    return {
      how: 'Colcheias sem parar, só com notas do acorde, subindo e descendo pelas 6 cordas da posição. Na troca, siga para a <b>nota mais próxima</b> do novo acorde, sem voltar para a fundamental.',
      more: [
        'Toque o arpejo de cada acorde parado na posição (1, 3 e 5 em todas as cordas), subindo e descendo.',
        'Faça a progressão com uma nota por tempo, sempre indo para a nota mais próxima do próximo acorde.',
        'Passe para colcheias contínuas, começando a 60 BPM.',
        'Varie o ponto de partida: comece na terça ou na quinta, ou descendo.',
      ],
      src: SRC.arp,
    }
  if (id === 'penta')
    return {
      how:
        `Colcheias na pentatônica de ${key} (as mesmas notas de ${otherName(P)}). No tempo 1, a <b>terça</b> do acorde.` +
        (outs.length ? ` <span class="warn">${outs.join(', ')} não está na penta: é a nota que mostra a troca.</span>` : ''),
      more: [
        'Toque só as terças, uma por compasso. Essa linha já é a melodia-guia da progressão.',
        'Coloque uma nota da penta logo antes de cada terça.',
        'Preencha o compasso inteiro com a penta, sempre chegando na terça no tempo 1.',
        'Depois troque o alvo para a quinta e para a fundamental.',
        'Troque menor e maior na tônica: as notas são as mesmas, só muda qual é o centro.',
      ],
      src: SRC.penta,
    }
  if (id === 'zig') {
    const B = neckBoxes(P)
    return {
      how:
        `As 5 formas da penta de <b>${key}</b> em fila, subindo o braço: <b>sobe uma, desce a próxima</b>, até a forma ${B[B.length - 1].label}, e volta pelo mesmo caminho. ` +
        'A troca de forma acontece na corda da ponta — na 1ª em cima, na 6ª embaixo — com um deslize de dedo, que é a mesma troca da penta diagonal.',
      more: [
        `Suba a forma ${B[0].label} inteira, da nota mais grave à mais aguda.`,
        'Na 1ª corda, deslize para a nota de cima da forma seguinte e desça por ela.',
        'Embaixo, na 6ª corda, passe para a forma seguinte e suba de novo. Sem parar o pulso na troca.',
        'Chegou na última forma: faça o caminho de volta, descendo o braço.',
        'Quando ficar fácil, troque de forma em outra corda (a 2ª, a 3ª…), e não só nas pontas.',
      ],
      src: SRC.zig,
    }
  }
  if (id === 'diag') {
    const d = P.diag.notes
    const from = d[0]
    const to = d[d.length - 1]
    return {
      how:
        `A pentatônica de <b>${key}</b> na diagonal, <b>raiz na ${diagRoot(P.diag, P.minor)}ª corda</b>: 3 notas numa corda, 2 na próxima. ` +
        `As de 3 levam sempre ${P.minor ? '♭3 4 5' : '1 2 3'}, as de 2 levam ${P.minor ? '♭7 1' : '5 6'}. Cada par de cordas fecha uma oitava, ` +
        `então o mesmo desenho se repete duas casas acima (três na corda B) e a forma sobe o braço — da casa ${from.f} à ${to.f} — sem sair do tom. ` +
        'No braço, cada recorte tracejado é a <b>forma CAGED</b> onde aquele par de cordas mora: 4 das 5 notas são dela. A 5ª, marcada com a seta, já é da forma seguinte — é ali que você <b>troca de forma</b>.',
      more: [
        'Decore o desenho de um par de cordas. Nos outros dois pares é o mesmo, só mais acima.',
        'Nas cordas de 3 notas, palheta na primeira e hammer-on nas outras. Na descida, pull-off.',
        'A troca de forma é a nota da seta: deslize o dedo até ela em vez de abrir a mão.',
        'Toque a forma CAGED de um recorte inteira, volte para a diagonal e saia pela seta. É assim que se entra e sai da diagonal no meio de um solo.',
        'Ache o root (laranja) em cada oitava. É ele que diz em que posição você chegou.',
        'Troque a posição: só existem dois desenhos (raiz na 6ª e raiz na 5ª), e a diagonal que passa por ela muda entre eles. O tom não muda.',
        'Depois improvise com backing track no tom, usando a diagonal para atravessar o braço.',
      ],
    }
  }
  if (id === 'base')
    return {
      how: `A progressão com as formas CAGED completas, sem sair da posição: ${C.map((c) => `${c.name} na forma ${c.voicing.nm}`).join(', ')}.`,
      more: [
        'Ache cada forma dentro da posição antes de tocar em sequência.',
        'Troque devagar, mantendo os dedos comuns encostados nas cordas.',
        'Toque só as 3 cordas graves, depois só as 3 agudas, depois dedilhado.',
      ],
    }
  return {
    how: `O arpejo de ${I.name} nas 5 formas, subindo o braço. É o mapa que liga as 5 posições.`,
    more: [
      'Em cada forma, suba a partir da fundamental mais grave.',
      'Passe para a próxima forma por uma nota que as duas têm em comum.',
      'Desça de volta pelas 5 formas, sem parar.',
    ],
    src: SRC.neck,
  }
}

export interface NeckData {
  marks: Mark[]
  rings: Pin[]
  windows: NeckWindow[]
  /** Para onde o braço rola no celular. Null mostra do começo. */
  focus: NeckWindow | null
  shifts?: Shift[]
  /** Casas do braço, quando não são as 17 de sempre. */
  frets?: number
}

export function exerciseNeck(id: ExerciseId, P: Practice, sel: number): NeckData {
  const c = P.chords[Math.min(sel, P.chords.length - 1)]
  const { lo, hi } = P.pos
  const inW = (f: number) => f >= lo && f <= hi
  const marks: Mark[] = []
  const rings: Pin[] = []
  const posWindow = [{ from: lo, to: hi }]
  const focus = { from: lo, to: hi }
  const each = (fn: (s: number, f: number, pc: number) => void) => {
    for (let s = 0; s < 6; s++) for (let f = 0; f <= 17; f++) fn(s, f, mod12(OPEN[s] + f))
  }

  if (id === 'diag') return { rings, ...diagNeck(P, P.diag.notes) }
  if (id === 'box') {
    const inBox = (s: number, f: number) => P.box.notes.some((n) => n.s === s && n.f === f)
    each((s, f, pc) => {
      if (!P.pent.includes(pc)) return
      marks.push({ string: s, fret: f, pc, degree: pentDeg(pc, P.tonicPc, P.minor), level: inBox(s, f) ? 'on' : 'ghost' })
    })
    return { marks, rings, windows: posWindow, focus }
  }
  if (id === 'zig') {
    const B = neckBoxes(P)
    const inAny = (s: number, f: number) => B.some((b) => b.notes.some((n) => n.s === s && n.f === f))
    each((s, f, pc) => {
      if (!P.pent.includes(pc)) return
      marks.push({ string: s, fret: f, pc, degree: pentDeg(pc, P.tonicPc, P.minor), level: inAny(s, f) ? 'on' : 'ghost' })
    })
    const windows = B.map((b) => {
      const fs = b.notes.map((n) => n.f)
      return { from: Math.min(...fs), to: Math.max(...fs), label: b.label }
    })
    return { marks, rings, windows, focus: null }
  }
  if (id === 'neck') {
    const I = P.tonicChord
    each((s, f, pc) => {
      if (I.pcs.includes(pc)) marks.push({ string: s, fret: f, pc, degree: degree(pc, I), level: 'on' })
    })
    return { marks, rings, windows: P.positions.map((p) => ({ from: p.lo, to: p.hi, label: p.label })), focus: null }
  }
  if (id === 'arp' || id === 'base') {
    const v = c.voicing.notes
    each((s, f, pc) => {
      if (!c.pcs.includes(pc)) return
      const inV = v.some((n) => n.s === s && n.f === f)
      const level = id === 'base' ? (inV ? 'on' : inW(f) ? 'soft' : 'ghost') : inW(f) ? 'on' : 'ghost'
      marks.push({ string: s, fret: f, pc, degree: degree(pc, c), level })
    })
    return { marks, rings, windows: posWindow, focus }
  }
  each((s, f, pc) => {
    if (!P.pent.includes(pc)) return
    marks.push({ string: s, fret: f, pc, degree: pentDeg(pc, P.tonicPc, P.minor), level: inW(f) ? (c.pcs.includes(pc) ? 'on' : 'soft') : 'ghost' })
  })
  for (let s = 0; s < 6; s++)
    for (let f = lo; f <= hi; f++) {
      if (mod12(OPEN[s] + f) !== c.third) continue
      rings.push({ string: s, fret: f })
      if (!P.pent.includes(c.third)) marks.push({ string: s, fret: f, pc: c.third, degree: degree(c.third, c), level: 'on', color: OUTSIDE_COLOR })
    }
  return { marks, rings, windows: posWindow, focus }
}

function diagLegendTail(id: ExerciseId): LegendItem[] {
  if (id === 'zig') return [{ kind: 'windows', text: '5 formas' }]
  if (id === 'diag')
    return [
      { kind: 'windows', text: 'forma CAGED de cada par' },
      { kind: 'shift', text: 'troca de forma' },
      { kind: 'ghost', text: 'fora da diagonal' },
    ]
  return [{ kind: 'ghost', text: id === 'box' ? 'fora da forma' : 'fora da posição' }]
}

/** A legenda do braço da diagonal, para quem desenha a escada fora da Prática. */
export const diagLegend = (P: Practice): LegendItem[] => exerciseLegend('diag', P, 0)

export function exerciseLegend(id: ExerciseId, P: Practice, sel: number): LegendItem[] {
  const c = P.chords[Math.min(sel, P.chords.length - 1)]
  const who: LegendItem[] = followsChord(id) ? [{ kind: 'chord', color: chordColor(c), text: c.name }] : []
  const dot = (color: string, text: string): LegendItem => ({ kind: 'dot', color, text })
  if (id === 'box' || id === 'diag' || id === 'zig' || id === 'penta') {
    const minor = P.minor
    return [
      ...who,
      { kind: 'text', text: `Penta ${tonicName(P)} ${modeName(P)}${id === 'diag' ? ' · 3-2' : ''}` },
      dot(ROLE_COLOR.root, '1'),
      dot(ROLE_COLOR.third, minor ? '♭3' : '3'),
      dot(ROLE_COLOR.fifth, '5'),
      dot(ROLE_COLOR.other, minor ? '4 e ♭7' : '2 e 6'),
      ...(id === 'penta' ? [{ kind: 'ring', text: 'terça' } as LegendItem] : []),
      ...diagLegendTail(id),
    ]
  }
  return [
    ...who,
    dot(ROLE_COLOR.root, '1'),
    dot(ROLE_COLOR.third, '3'),
    dot(ROLE_COLOR.fifth, '5'),
    id === 'neck' ? { kind: 'windows', text: '5 posições' } : { kind: 'ghost', text: 'fora da posição' },
  ]
}
