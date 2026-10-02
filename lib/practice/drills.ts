/* Modo reunião: seis drills de mão esquerda, desplugado e sem som.
 *
 * Cada drill usa a tônica e a posição da Prática — a escada CAGED é a da tônica,
 * os acordes são os da posição, as raízes são as da progressão.
 */
import { STRING_LABELS } from '../fretboard'
import type { LegendItem, Mark, NeckWindow } from '../marks'
import { CHORD_COLOR, ROLE_COLOR, degreeColor } from '../roles'
import { OPEN, degree, inversionLadder, ladderFor, mod12, pentBoxes, rootPositions, spider, threes, type PNote } from './caged'
import { chordColor, modeName, pentDeg, tonicName, type Bar, type BarHead, type FollowKey, type Practice, type TabEvent } from './session'

export type DrillId = 'caged' | 'acordes' | 'inversoes' | 'aranha' | 'pent3' | 'raizes'
export type DrillIcon = 'ladder' | 'layers' | 'move' | 'spider' | 'wave' | 'eye'

export interface Drill {
  id: DrillId
  name: string
  min: number
  icon: DrillIcon
  why: string
  steps: string[]
}

export const DRILLS: Drill[] = [
  {
    id: 'caged',
    name: 'Escada CAGED',
    min: 3,
    icon: 'ladder',
    why: 'As 5 formas do acorde da tônica, dedilhadas da corda grave à aguda e de volta, subindo o braço.',
    steps: [
      'Dedilhe a forma da corda mais grave até a mais aguda e volte.',
      'Suba para a próxima forma na ordem do braço sem parar o pulso.',
      'Pense onde está a raiz em cada forma. Na volta, desça pelas formas.',
    ],
  },
  {
    id: 'acordes',
    name: 'Acordes da posição',
    min: 3,
    icon: 'layers',
    why: 'Os acordes cheios da posição escolhida, dedilhados, um compasso cada.',
    steps: [
      'Usa a posição, a tônica e a progressão escolhidas na Prática.',
      'Dedilhe cada acorde de ida e volta.',
      'Na troca, mexa só os dedos que precisam mudar.',
    ],
  },
  {
    id: 'inversoes',
    name: 'Tríades nas 6 cordas',
    min: 3,
    icon: 'move',
    why: 'A tríade da tônica em todas as inversões, dedilhada, em cada grupo de 3 cordas.',
    steps: ['Escolha o grupo de cordas.', 'Suba uma inversão por vez, do grave ao agudo do braço.', 'Troque de grupo até passar pelos 4.'],
  },
  {
    id: 'aranha',
    name: 'Aranha cromática',
    min: 4,
    icon: 'spider',
    why: 'Um dedo por casa, em legato. Quase sem barulho.',
    steps: ['Indicador na casa 5, um dedo por casa.', 'Martele cada nota para soar sem palheta.', 'Dedos baixos. Troque a ordem a cada minuto.'],
  },
  {
    id: 'pent3',
    name: 'Penta em 3s',
    min: 4,
    icon: 'wave',
    why: 'Grupos de 3 notas em legato numa das 5 formas da pentatônica.',
    steps: ['Escolha a forma do dia.', 'Grupos de 3 subindo: 1 2 3, 2 3 4, 3 4 5...', 'Só hammer-on e pull-off. Volte no espelho.'],
  },
  {
    id: 'raizes',
    name: 'Raízes às cegas',
    min: 3,
    icon: 'eye',
    why: 'Achar a nota em cada corda sem procurar.',
    steps: ['Comece pela tônica.', 'Ache em cada corda, região baixa e alta.', 'Feche os olhos e confira tateando.'],
  },
]

export const SETS = [
  [0, 1, 2],
  [1, 2, 3],
  [2, 3, 4],
  [3, 4, 5],
]

export const PERMS = ['1234', '1324', '1243', '2413', '4321']

const INV_NAME = ['Fund.', '1ª inv.', '2ª inv.']
const INV_COLOR = [CHORD_COLOR.I, CHORD_COLOR.V, CHORD_COLOR.vi]

export interface DrillChoices {
  cagedSel: number
  accSel: number
  invSet: number
  perm: string
  box: number
  rootSel: number
}

export type OptKey = keyof DrillChoices

export interface DrillData {
  bars: Bar[]
  cols: number
  marks: Mark[]
  windows: NeckWindow[]
  focus: NeckWindow | null
  /** As opções do drill: uma fileira de pílulas, uma ativa. */
  opts: { key: OptKey; value: number | string; items: { v: number | string; label: string }[] }
  legend: LegendItem[]
}

const frNotes = (fr: number[]): PNote[] =>
  fr.map((f, s) => (f < 0 ? null : { s, f, midi: OPEN[s] + f })).filter((n): n is PNote => n !== null)

/** Dedilhado: da corda mais grave à mais aguda e de volta, uma nota por colcheia. */
function arpEv(
  notes: PNote[],
  start: number,
  len: number,
  follow: { k: FollowKey; v: number } | undefined,
  colorFn: (n: PNote) => string,
  degFn: (n: PNote) => string,
): TabEvent[] {
  const up = notes.slice().sort((a, b) => a.s - b.s)
  const cyc = up.concat(up.slice(1, -1).reverse())
  const ev: TabEvent[] = []
  for (let k = 0; k < len; k++) {
    const n = cyc[k % cyc.length]
    ev.push({ col: start + k, follow, notes: [{ ...n, role: 'deg', deg: degFn(n), color: colorFn(n) }] })
  }
  return ev
}

const span = (fs: number[]): NeckWindow => ({ from: Math.min(...fs), to: Math.max(...fs) })

export function drillData(id: DrillId, P: Practice, S: DrillChoices): DrillData {
  const T = P.tonicPc
  const I = P.tonicChord
  const nn = P.names
  const pos = { from: P.pos.lo, to: P.pos.hi }
  const on = (n: PNote, deg: string, extra: Partial<Mark> = {}): Mark => ({
    string: n.s,
    fret: n.f,
    pc: mod12(n.midi),
    degree: deg,
    level: 'on',
    ...extra,
  })
  const tonicDeg = (n: PNote) => degree(mod12(n.midi), I)
  const byDeg = (n: PNote) => degreeColor(tonicDeg(n))

  if (id === 'caged') {
    const L = ladderFor(T, P.minor ? 'min' : 'maj')
    const sel = Math.min(S.cagedSel, L.length - 1)
    const bars: Bar[] = L.map((sh, i) => ({
      ci: null,
      head: { text: `Forma ${sh.nm}` },
      events: arpEv(frNotes(sh.fr), 0, 8, { k: 'cagedSel', v: i }, byDeg, tonicDeg),
    }))
    const notes = frNotes(L[sel].fr)
    return {
      bars,
      cols: 8,
      marks: notes.map((n) => on(n, tonicDeg(n))),
      windows: [],
      focus: span(notes.map((n) => n.f)),
      opts: { key: 'cagedSel', value: sel, items: L.map((x, i) => ({ v: i, label: `Forma ${x.nm}` })) },
      legend: [],
    }
  }

  if (id === 'acordes') {
    const C = P.chords
    const sel = Math.min(S.accSel, C.length - 1)
    const bars: Bar[] = C.map((c, i) => ({
      ci: null,
      head: { dot: chordColor(c), text: c.name } as BarHead,
      events: arpEv(
        c.voicing.notes,
        0,
        8,
        { k: 'accSel', v: i },
        (n) => degreeColor(degree(mod12(n.midi), c)),
        (n) => degree(mod12(n.midi), c),
      ),
    }))
    const c = C[sel]
    return {
      bars,
      cols: 8,
      marks: c.voicing.notes.map((n) => on(n, n.deg)),
      windows: [pos],
      focus: pos,
      opts: { key: 'accSel', value: sel, items: C.map((x, i) => ({ v: i, label: `${x.name} (forma ${x.voicing.nm})` })) },
      legend: [],
    }
  }

  if (id === 'inversoes') {
    const si = Math.min(Math.max(+S.invSet || 0, 0), 3)
    const L = inversionLadder(I, SETS[si])
    const bars: Bar[] = []
    for (let i = 0; i < L.length; i += 2) {
      const pair = [L[i], L[i + 1]].filter(Boolean)
      bars.push({
        ci: null,
        head: { text: pair.map((x) => INV_NAME[x.inv]).join(' e ') },
        events: pair.flatMap((v, k) => arpEv(v.notes, k * 4, 4, undefined, () => INV_COLOR[v.inv], tonicDeg)),
      })
    }
    const marks: Mark[] = []
    L.forEach((v) => v.notes.forEach((n) => marks.push(on(n, tonicDeg(n), { color: INV_COLOR[v.inv] }))))
    return {
      bars,
      cols: 8,
      marks,
      windows: [],
      focus: null,
      opts: {
        key: 'invSet',
        value: si,
        items: SETS.map((st, i) => ({ v: i, label: `Cordas ${st.map((s) => STRING_LABELS[s]).join(' ')}` })),
      },
      legend: INV_NAME.map((text, i) => ({ kind: 'dot', color: INV_COLOR[i], text })),
    }
  }

  if (id === 'aranha') {
    const p = PERMS.includes(S.perm) ? S.perm : '1234'
    const notes = spider(p, 5)
    const bars: Bar[] = []
    for (let i = 0; i < notes.length; i += 8) {
      const a = STRING_LABELS[notes[i].s]
      const b = STRING_LABELS[notes[Math.min(i + 4, notes.length - 1)].s]
      bars.push({
        ci: null,
        head: { text: `Cordas ${a} e ${b}` },
        events: notes.slice(i, i + 8).map((n, k) => ({
          col: k,
          notes: [{ s: n.s, f: n.f, midi: n.midi, role: 'deg' as const, color: ROLE_COLOR.other, label: String(n.finger) }],
        })),
      })
    }
    const marks: Mark[] = []
    for (let s = 0; s < 6; s++)
      for (let d = 1; d <= 4; d++) {
        const f = 4 + d
        marks.push({ string: s, fret: f, pc: mod12(OPEN[s] + f), degree: '', level: 'on', label: String(d) })
      }
    return {
      bars,
      cols: 8,
      marks,
      windows: [{ from: 5, to: 8 }],
      focus: { from: 5, to: 8 },
      opts: { key: 'perm', value: p, items: PERMS.map((x) => ({ v: x, label: `Dedos ${x}` })) },
      legend: [{ kind: 'text', text: 'Número = dedo' }],
    }
  }

  if (id === 'pent3') {
    const boxes = pentBoxes(P.keyPc)
    const bi = Math.min(S.box, 4)
    let notes = boxes[bi].notes
    if (Math.min(...notes.map((n) => n.f)) < 1) notes = notes.map((n) => ({ s: n.s, f: n.f + 12, midi: n.midi + 12 }))
    const seq = threes(notes)
    const deg = (n: PNote) => pentDeg(mod12(n.midi), T, P.minor)
    const bars: Bar[] = []
    for (let i = 0; i < seq.length; i += 12)
      bars.push({
        ci: null,
        events: seq.slice(i, i + 12).map((n, k) => ({ col: k, notes: [{ ...n, role: 'deg' as const, deg: deg(n), color: degreeColor(deg(n)) }] })),
      })
    const w = span(notes.map((n) => n.f))
    return {
      bars,
      cols: 12,
      marks: notes.map((n) => on(n, deg(n))),
      windows: [w],
      focus: w,
      opts: { key: 'box', value: bi, items: boxes.map((x, i) => ({ v: i, label: `Forma ${x.forma}` })) },
      legend: [{ kind: 'text', text: `Penta ${tonicName(P)} ${modeName(P)}` }],
    }
  }

  const C = P.chords
  const sel = Math.min(S.rootSel, C.length - 1)
  const pc = C[sel].root
  const ps = rootPositions(pc)
  const low: PNote[] = []
  const high: PNote[] = []
  for (let s = 0; s < 6; s++) {
    const on_s = ps.filter((p) => p.s === s)
    if (on_s[0]) low.push(on_s[0])
    if (on_s[1]) high.push(on_s[1])
  }
  const ev = (list: PNote[]): TabEvent[] =>
    list.map((n, k) => ({ col: k, notes: [{ ...n, role: 'deg' as const, deg: '1', color: ROLE_COLOR.root }] }))
  return {
    bars: [
      { ci: null, head: { text: 'Região baixa' }, events: ev(low) },
      { ci: null, head: { text: 'Região alta' }, events: ev(high) },
    ],
    cols: 8,
    marks: ps.map((n) => on(n, '1')),
    windows: [],
    focus: null,
    opts: { key: 'rootSel', value: sel, items: C.map((x, i) => ({ v: i, label: nn(x.root) })) },
    legend: [],
  }
}
