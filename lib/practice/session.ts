/* A posição da noite e os seis exercícios dela.
 *
 * Do CAGED Lab: a tônica, a progressão e uma das cinco posições escolhem tudo.
 * Cada exercício devolve a mesma coisa — compassos para a tab e para o som, as
 * casas para o braço e o texto do "Como funciona" — e as telas só desenham.
 */
import type { ShapeId } from '../fretboard'
import type { LegendItem, Mark, NeckWindow, Pin } from '../marks'
import { CHORD_COLOR, OUTSIDE_COLOR, ROLE_COLOR, degreeColor } from '../roles'
import { keyOf, namesForKey, type Names } from '../spelling'
import {
  MINOR_LABEL,
  OPEN,
  buildChords,
  chordPcs,
  degree,
  diagonals,
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
  /** A penta diagonal (3-2) que sai da posição — ou chega nela, se sair não cabe no braço. */
  diag: PNote[]
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

  /* A diagonal que começa na posição (6ª corda dentro dela). Nas posições do alto
     a que começa ali passa da casa 17: vale então a que termina nela (1ª corda). */
  const away = (ns: PNote[]) => ns.reduce((a, n) => a + Math.max(0, pos.lo - n.f, n.f - pos.hi), 0)
  let diag: PNote[] = []
  let dc = 1e9
  for (const d of diagonals(keyPc)) {
    const c = Math.min(away(d.filter((n) => n.s === 0)), 0.5 + away(d.filter((n) => n.s === 5)))
    if (c < dc) {
      dc = c
      diag = d
    }
  }

  return { tonicPc, minor, keyPc, names, positions: ps, pos, chords, pent, tonicChord, box: box!, diag }
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
  const d = P.diag
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

/* ── Os exercícios ────────────────────────────────────────────────────── */

export type ExerciseId = 'box' | 'diag' | 'arp' | 'penta' | 'base' | 'neck'

export const EXERCISES: { id: ExerciseId; name: string; cols: number }[] = [
  { id: 'box', name: 'Forma da penta', cols: 8 },
  { id: 'diag', name: 'Penta diagonal', cols: 8 },
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
  if (id === 'diag') {
    const d = P.diag
    const from = d[0]
    const to = d[d.length - 1]
    return {
      how:
        `A pentatônica de <b>${key}</b> na diagonal: <b>3 notas numa corda, 2 na próxima</b>, da 6ª à 1ª. ` +
        `Cada par de cordas fecha uma oitava, então a forma sobe o braço — da casa ${from.f} à ${to.f} — e atravessa as posições sem sair do tom.`,
      more: [
        'Nas cordas de 3 notas, palheta na primeira e hammer-on nas outras. Na descida, pull-off.',
        'A mudança de posição acontece na troca de corda: deslize o dedo 1 ou o 4 em vez de pular.',
        'Ache o root (laranja) em cada oitava. É ele que diz em que posição você chegou.',
        'Troque a posição e repare que a diagonal sai de outro lugar, mas as notas são sempre as mesmas: o tom não muda.',
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

  if (id === 'box' || id === 'diag') {
    const shape = id === 'box' ? P.box.notes : P.diag
    const inShape = (s: number, f: number) => shape.some((n) => n.s === s && n.f === f)
    each((s, f, pc) => {
      if (!P.pent.includes(pc)) return
      marks.push({ string: s, fret: f, pc, degree: pentDeg(pc, P.tonicPc, P.minor), level: inShape(s, f) ? 'on' : 'ghost' })
    })
    const fs = shape.map((n) => n.f)
    return { marks, rings, windows: posWindow, focus: id === 'box' ? focus : { from: Math.min(...fs), to: Math.max(...fs) } }
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

export function exerciseLegend(id: ExerciseId, P: Practice, sel: number): LegendItem[] {
  const c = P.chords[Math.min(sel, P.chords.length - 1)]
  const who: LegendItem[] = followsChord(id) ? [{ kind: 'chord', color: chordColor(c), text: c.name }] : []
  const dot = (color: string, text: string): LegendItem => ({ kind: 'dot', color, text })
  if (id === 'box' || id === 'diag' || id === 'penta') {
    const minor = P.minor
    return [
      ...who,
      { kind: 'text', text: `Penta ${tonicName(P)} ${modeName(P)}${id === 'diag' ? ' · 3-2' : ''}` },
      dot(ROLE_COLOR.root, '1'),
      dot(ROLE_COLOR.third, minor ? '♭3' : '3'),
      dot(ROLE_COLOR.fifth, '5'),
      dot(ROLE_COLOR.other, minor ? '4 e ♭7' : '2 e 6'),
      ...(id === 'penta' ? [{ kind: 'ring', text: 'terça' } as LegendItem] : []),
      { kind: 'ghost', text: id === 'box' ? 'fora da forma' : id === 'diag' ? 'fora da diagonal' : 'fora da posição' },
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
