/* Modo reunião: drills de mão esquerda, desplugado e sem som.
 *
 * Dois blocos. Agilidade — aranha, aranha em diagonal, caminhada e trilos —, que não
 * dependem do tom: um dedo por casa, independência e troca de corda. E o braço — penta
 * em 3s, formas em 3s, diagonal e raízes —, na tônica e no maior/menor escolhidos no
 * topo da Reunião (os mesmos da Prática).
 */
import { STRING_LABELS } from '../fretboard'
import type { LegendItem, Mark, NeckWindow } from '../marks'
import { ROLE_COLOR, degreeColor } from '../roles'
import { OPEN, diagCell, diagonals, groups, mod12, pentBoxes, rootPositions, spider, type PNote } from './caged'
import { diagLegend, diagNeck, modeName, pentDeg, positionOf, tonicName, type Bar, type Practice, type TabEvent } from './session'

export type DrillId = 'aranha' | 'aranhaDiag' | 'caminhada' | 'trilos' | 'maj7' | 'pent3' | 'formas3' | 'diag' | 'raizes'
export type DrillIcon = 'spider' | 'diagUp' | 'walk' | 'trill' | 'arp' | 'wave' | 'route' | 'diag' | 'eye'

export interface Drill {
  id: DrillId
  name: string
  min: number
  icon: DrillIcon
  /** Os drills que usam a tônica e o maior/menor; os de agilidade não. */
  key: boolean
  why: string
  steps: string[]
}

export const DRILLS: Drill[] = [
  {
    id: 'aranha',
    name: 'Aranha cromática',
    min: 4,
    icon: 'spider',
    key: false,
    why: 'Um dedo por casa, em legato. Quase sem barulho.',
    steps: ['Indicador na casa 5, um dedo por casa.', 'Martele cada nota para soar sem palheta.', 'Dedos baixos. Troque a ordem a cada minuto.'],
  },
  {
    id: 'aranhaDiag',
    name: 'Aranha em diagonal',
    min: 3,
    icon: 'diagUp',
    key: false,
    why: 'A aranha subindo uma casa a cada corda: a mão anda pelo braço enquanto troca de corda.',
    steps: [
      'Comece com o indicador na casa 5 da 6ª corda.',
      'Cada corda nova começa uma casa acima: a mão vai deslizando sem perder o um-dedo-por-casa.',
      'Na volta, desça corda a corda, com os dedos na ordem contrária.',
    ],
  },
  {
    id: 'caminhada',
    name: 'Caminhada da aranha',
    min: 3,
    icon: 'walk',
    key: false,
    why: 'Dois dedos de cada vez, alternando entre duas cordas vizinhas: troca de corda e independência juntas.',
    steps: [
      'Dedos 1 e 2 (ou 1 e 3) num par de cordas, depois os outros dois, uma casa adiante.',
      'Cada dedo só sai da casa quando o próximo já apertou.',
      'Suba um par de cordas por vez e volte.',
    ],
  },
  {
    id: 'trilos',
    name: 'Trilos',
    min: 3,
    icon: 'trill',
    key: false,
    why: 'Um par de dedos em hammer-on e pull-off, rápido e sem palheta: a independência de cada dedo.',
    steps: [
      'Escolha o par do dia: o 3-4 e o 2-4 são os que mais pedem.',
      'Hammer-on e pull-off sem parar, oito notas por corda.',
      'Os outros dedos ficam perto das cordas, sem levantar.',
    ],
  },
  {
    id: 'maj7',
    name: 'Arpejo maj7 em semitons',
    min: 5,
    icon: 'arp',
    key: false,
    why: 'O arpejo de sétima maior com duas notas por corda, saindo da 7ª: 7 1 | 3 5 em cada corda. Sobe num tom, sobe um semitom e desce no tom seguinte; desce, sobe um semitom e sobe de novo — até passar pelas 12 tonalidades.',
    steps: [
      'Sempre o mesmo: começa na 6ª corda, casa 1 ([6]1 [6]2 [5]1 [5]4 …), em F♯maj7.',
      'Em cada corda, duas notas: na 6ª, 4ª e 2ª a 7ª e o 1 (meio tom de distância); na 5ª, 3ª e 1ª a 3ª e a 5ª.',
      'Uma nota de cada vez, todas com o mesmo tempo. No fim de cada passada, um semitom acima e volta pelo outro lado.',
      'As opções mostram cada ida e volta da rota, até terminar na 6ª corda, casa 12.',
    ],
  },
  {
    id: 'pent3',
    name: 'Penta em 3s',
    min: 4,
    icon: 'wave',
    key: true,
    why: 'Grupos de 3 notas em legato numa das 5 formas da pentatônica, sempre saindo do 1 e voltando para o 1.',
    steps: [
      'Escolha a forma do dia.',
      'Do 1 para cima: 1 2 3, 2 3 4… até o topo; desça em 3s até a nota mais grave e suba de novo até o 1.',
      'Só hammer-on e pull-off.',
    ],
  },
  {
    id: 'formas3',
    name: 'Formas em 3s',
    min: 4,
    icon: 'route',
    key: true,
    why: 'A penta em 3s trocando de forma a cada par de cordas: 6ª e 5ª numa forma, 4ª e 3ª na seguinte, 2ª e 1ª na outra. É o treino da passagem de uma forma para a outra.',
    steps: [
      'Escolha por qual forma entrar.',
      'Em 3s, do 1 para cima: a troca de forma acontece na passagem da 5ª para a 4ª corda e da 3ª para a 2ª.',
      'Na troca, a mão desliza para a forma de cima; na volta, desliza de volta.',
    ],
  },
  {
    id: 'diag',
    name: 'Diagonal em 4s',
    min: 4,
    icon: 'diag',
    key: true,
    why: 'A penta do tom na diagonal — 1 + 3-2 no menor, 3-2 no maior —, em grupos de 4 notas, atravessando o braço.',
    steps: [
      'Sai sempre da tônica: no menor só o 1 na primeira corda, depois ♭3 4 5 e ♭7 1; no maior 1 2 3 e 5 6.',
      'Grupos de 4 subindo: 1 2 3 4, 2 3 4 5...',
      'Só indicador e anelar. Na corda de 3 notas, deslize um tom em vez de abrir a mão.',
    ],
  },
  {
    id: 'raizes',
    name: 'Raízes às cegas',
    min: 3,
    icon: 'eye',
    key: true,
    why: 'Achar a nota em cada corda sem procurar.',
    steps: ['Comece pela tônica.', 'Ache em cada corda, região baixa e alta.', 'Feche os olhos e confira tateando.'],
  },
]

export const PERMS = ['1234', '1324', '1243', '2413', '4321']

/** Os pares da caminhada: 1-2 e 3-4, ou 1-3 e 2-4. */
export const WALKS = ['12-34', '13-24']

/** Os pares dos trilos. */
export const TRILLS: [number, number][] = [
  [1, 2],
  [1, 3],
  [1, 4],
  [2, 3],
  [2, 4],
  [3, 4],
]

export interface DrillChoices {
  perm: string
  maj7Pair: number
  walk: string
  trill: number
  box: number
  shift: number
  diag: number
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

const span = (fs: number[]): NeckWindow => ({ from: Math.min(...fs), to: Math.max(...fs) })

type Fingered = PNote & { finger: number }

/** Em compassos de `per` notas, com o número do dedo na tab. */
function fingerBars(notes: Fingered[], per: number, head?: (i: number) => string): Bar[] {
  const bars: Bar[] = []
  for (let i = 0; i < notes.length; i += per)
    bars.push({
      ci: null,
      head: head ? { text: head(i) } : undefined,
      events: notes.slice(i, i + per).map((n, k) => ({
        col: k,
        notes: [{ s: n.s, f: n.f, midi: n.midi, role: 'deg' as const, color: ROLE_COLOR.other, label: String(n.finger) }],
      })),
    })
  return bars
}

/** As casas que o drill usa, cada uma com o dedo que aperta. */
function fingerMarks(notes: Fingered[]): Mark[] {
  const seen = new Map<string, Fingered>()
  for (const n of notes) seen.set(`${n.s}-${n.f}`, n)
  return [...seen.values()].map((n) => ({ string: n.s, fret: n.f, pc: mod12(n.midi), degree: '', level: 'on', label: String(n.finger) }))
}

const fn = (s: number, f: number, finger: number): Fingered => ({ s, f, midi: OPEN[s] + f, finger })

/* O arpejo maj7 do professor, em casas a partir da 7ª na 6ª corda: 7 1 | 3 5 | 7 1 | 3 5 | 7 1 | 3 5,
   duas notas por corda. Cada par de cordas anda duas casas; entrando na corda Si, três. */
const MAJ7_OFF: [number, number][] = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 3],
  [2, 2],
  [2, 3],
  [3, 2],
  [3, 5],
  [4, 5],
  [4, 6],
  [5, 5],
  [5, 8],
]
const MAJ7_DEG: Record<number, string> = { 0: '1', 4: '3', 7: '5', 11: '7' }

/** Uma passada do arpejo maj7: a 7ª na 6ª corda na casa `f7`, subindo ou descendo. */
export function maj7Pass(f7: number, up: boolean): PNote[] {
  const notes = MAJ7_OFF.map(([s, d]) => ({ s, f: f7 + d, midi: OPEN[s] + f7 + d }))
  return up ? notes : notes.reverse()
}

/** As 12 passadas da rota, um semitom de cada vez: a primeira sobe, a segunda desce… */
export const MAJ7_PASSES = 12

/**
 * Grupos de n notas que saem do 1 e voltam para o 1: do primeiro 1 da forma para cima até o
 * topo, de lá para baixo até a nota mais grave, e de novo para cima até o 1.
 */
export function fromRootGroups(notes: PNote[], tonicPc: number, n = 3): PNote[] {
  const up = notes.slice().sort((a, b) => a.midi - b.midi)
  const top = up.length - 1
  const r0 = Math.max(0, up.findIndex((x) => mod12(x.midi) === tonicPc))
  const seq: PNote[] = []
  for (let i = r0; i + n - 1 <= top; i++) seq.push(...up.slice(i, i + n))
  for (let i = top; i - n + 1 >= 0; i--) seq.push(...up.slice(i - n + 1, i + 1).reverse())
  for (let i = 0; i + n - 1 <= r0; i++) seq.push(...up.slice(i, i + n))
  if (r0 > 0 && r0 < n - 1) seq.push(up[r0])
  return seq
}

/** As cinco caixas da penta do tom, subindo o braço, sem casa abaixo da 1. */
function boxesUp(keyPc: number): PNote[][] {
  return pentBoxes(keyPc)
    .map((b) => (Math.min(...b.notes.map((n) => n.f)) < 1 ? b.notes.map((n) => ({ s: n.s, f: n.f + 12, midi: n.midi + 12 })) : b.notes))
    .sort((a, b) => Math.min(...a.map((n) => n.f)) - Math.min(...b.map((n) => n.f)))
}

/** O nome da forma de uma caixa, como no resto do app: "E", ou "D (E)" no menor. */
const formName = (P: Practice, notes: PNote[]) => positionOf(P, notes).label

export function drillData(id: DrillId, P: Practice, S: DrillChoices): DrillData {
  const T = P.tonicPc
  const nn = P.names
  const on = (n: PNote, deg: string): Mark => ({ string: n.s, fret: n.f, pc: mod12(n.midi), degree: deg, level: 'on' })
  const deg = (n: PNote) => pentDeg(mod12(n.midi), T, P.minor)
  const degBars = (seq: PNote[], per: number, head?: string): Bar[] => {
    const bars: Bar[] = []
    for (let i = 0; i < seq.length; i += per)
      bars.push({
        ci: null,
        head: i === 0 && head ? { text: head } : undefined,
        events: seq.slice(i, i + per).map((n, k) => ({ col: k, notes: [{ ...n, role: 'deg' as const, deg: deg(n), color: degreeColor(deg(n)) }] })),
      })
    return bars
  }
  const fingerLegend: LegendItem[] = [{ kind: 'text', text: 'Número = dedo' }]

  if (id === 'aranha') {
    const p = PERMS.includes(S.perm) ? S.perm : '1234'
    const notes = spider(p, 5)
    return {
      bars: fingerBars(notes, 8, (i) => `Cordas ${STRING_LABELS[notes[i].s]} e ${STRING_LABELS[notes[Math.min(i + 4, notes.length - 1)].s]}`),
      cols: 8,
      marks: fingerMarks(notes),
      windows: [{ from: 5, to: 8 }],
      focus: { from: 5, to: 8 },
      opts: { key: 'perm', value: p, items: PERMS.map((x) => ({ v: x, label: `Dedos ${x}` })) },
      legend: fingerLegend,
    }
  }

  if (id === 'aranhaDiag') {
    const p = PERMS.includes(S.perm) ? S.perm : '1234'
    const up: Fingered[] = []
    for (let s = 0; s < 6; s++) for (const ch of p) up.push(fn(s, 4 + s + +ch, +ch))
    const back = [...p].reverse()
    const down: Fingered[] = []
    for (let s = 5; s >= 0; s--) for (const ch of back) down.push(fn(s, 4 + s + +ch, +ch))
    const notes = [...up, ...down]
    return {
      bars: fingerBars(notes, 8, (i) => (i < up.length ? 'Sobe' : 'Desce')),
      cols: 8,
      marks: fingerMarks(notes),
      windows: [{ from: 5, to: 13 }],
      focus: { from: 5, to: 13 },
      opts: { key: 'perm', value: p, items: PERMS.map((x) => ({ v: x, label: `Dedos ${x}` })) },
      legend: fingerLegend,
    }
  }

  if (id === 'caminhada') {
    const w = WALKS.includes(S.walk) ? S.walk : WALKS[0]
    /* Em cada par de cordas: dois dedos, um em cada corda, depois os outros dois. */
    const order = w === '12-34' ? [[1, 0], [2, 1], [3, 0], [4, 1]] : [[1, 0], [3, 1], [2, 0], [4, 1]]
    const notes: Fingered[] = []
    for (let s = 0; s < 5; s++) for (const [finger, k] of order) notes.push(fn(s + k, 4 + finger, finger))
    for (let s = 4; s >= 0; s--) for (const [finger, k] of [...order].reverse()) notes.push(fn(s + k, 4 + finger, finger))
    return {
      bars: fingerBars(notes, 8, (i) => {
        const a = notes[i]
        const b = notes[i + 1] ?? a
        return `Cordas ${STRING_LABELS[Math.min(a.s, b.s)]} e ${STRING_LABELS[Math.max(a.s, b.s)]}`
      }),
      cols: 8,
      marks: fingerMarks(notes),
      windows: [{ from: 5, to: 8 }],
      focus: { from: 5, to: 8 },
      opts: { key: 'walk', value: w, items: WALKS.map((x) => ({ v: x, label: `Dedos ${x.replace('-', ' e ')}` })) },
      legend: fingerLegend,
    }
  }

  if (id === 'trilos') {
    const ti = Math.min(Math.max(S.trill, 0), TRILLS.length - 1)
    const [a, b] = TRILLS[ti]
    const notes: Fingered[] = []
    for (let s = 0; s < 6; s++) for (let k = 0; k < 8; k++) notes.push(fn(s, 4 + (k % 2 ? b : a), k % 2 ? b : a))
    return {
      bars: fingerBars(notes, 8, (i) => `Corda ${STRING_LABELS[notes[i].s]}`),
      cols: 8,
      marks: fingerMarks(notes),
      windows: [{ from: 5, to: 8 }],
      focus: { from: 5, to: 8 },
      opts: { key: 'trill', value: ti, items: TRILLS.map(([x, y], i) => ({ v: i, label: `Dedos ${x}-${y}` })) },
      legend: fingerLegend,
    }
  }

  if (id === 'maj7') {
    /* Sempre o exercício do professor, fora da tônica do topo: começa na 6ª corda, casa 1 (o Fá,
       que é o Mi♯ do F♯maj7), e a rota cabe inteira no braço até terminar na casa 12. */
    const f0 = 1
    const R = mod12(OPEN[0] + f0 + 1)
    const pair = Math.min(Math.max(S.maj7Pair, 0), MAJ7_PASSES / 2 - 1)
    /* A ida e a volta desse par de passadas: sobe no tom k e desce no tom seguinte. */
    const k = 2 * pair
    const upNotes = maj7Pass(f0 + k, true)
    const downNotes = maj7Pass(f0 + k + 1, false)
    const rootOf = (shift: number) => mod12(R + shift)
    const degOf = (n: PNote, shift: number) => MAJ7_DEG[mod12(n.midi - rootOf(shift))] ?? ''
    const name = (shift: number) => `${nn(rootOf(shift))}maj7`
    const bar = (notes: PNote[], shift: number, text: string): Bar => ({
      ci: null,
      head: { text, sub: '7 1 · 3 5' },
      events: notes.map((n, i) => {
        const d = degOf(n, shift)
        return { col: i, notes: [{ ...n, role: 'deg' as const, deg: d, color: degreeColor(d) }] }
      }),
    })
    const marks: Mark[] = [
      ...upNotes.map((n) => on(n, degOf(n, k))),
      /* A volta, um semitom acima, em contorno: dá para ver o desenho inteiro andar uma casa. */
      ...downNotes
        /* Onde as duas passadas usam a mesma casa (o 1 de uma é a 7ª da outra), fica a acesa. */
        .filter((n) => !upNotes.some((u) => u.s === n.s && u.f === n.f))
        .map((n): Mark => ({ string: n.s, fret: n.f, pc: mod12(n.midi), degree: degOf(n, k + 1), level: 'outline' })),
    ]
    const all = [...upNotes, ...downNotes].map((n) => n.f)
    const w = span(all)
    return {
      bars: [bar(upNotes, k, `↑ ${name(k)}`), bar(downNotes, k + 1, `↓ ${name(k + 1)}, um semitom acima`)],
      cols: 12,
      marks,
      windows: [w],
      focus: w,
      opts: {
        key: 'maj7Pair',
        value: pair,
        items: Array.from({ length: MAJ7_PASSES / 2 }, (_, i) => ({ v: i, label: `↑ ${name(2 * i)} ↓ ${name(2 * i + 1)}` })),
      },
      legend: [
        { kind: 'text', text: `aceso: sobe em ${name(k)}` },
        { kind: 'outline', text: `desce em ${name(k + 1)}` },
      ],
    }
  }

  if (id === 'pent3') {
    const boxes = boxesUp(P.keyPc)
    const bi = Math.min(Math.max(S.box, 0), boxes.length - 1)
    const notes = boxes[bi]
    const w = span(notes.map((n) => n.f))
    return {
      bars: degBars(fromRootGroups(notes, T), 12, 'Do 1 ao 1'),
      cols: 12,
      marks: notes.map((n) => on(n, deg(n))),
      windows: [{ ...w, label: formName(P, notes) }],
      focus: w,
      opts: { key: 'box', value: bi, items: boxes.map((x, i) => ({ v: i, label: `Forma ${formName(P, x)}` })) },
      legend: [{ kind: 'text', text: `Penta ${tonicName(P)} ${modeName(P)}` }],
    }
  }

  if (id === 'formas3') {
    const boxes = boxesUp(P.keyPc)
    const k = Math.min(Math.max(S.shift, 0), boxes.length - 1)
    /* A caixa k nas cordas 6 e 5, a seguinte nas 4 e 3, a outra nas 2 e 1 — subindo o braço. */
    const pick = (j: number): PNote[] => {
      const idx = k + j
      const b = boxes[idx % boxes.length]
      return idx >= boxes.length ? b.map((n) => ({ s: n.s, f: n.f + 12, midi: n.midi + 12 })) : b
    }
    /* Na primeira corda de cada par novo entram as duas notas da forma de cima e a última da de
       baixo: três notas, com um deslize. É ali que a mão troca de forma, e a escala segue
       contínua (sem pular a nota da passagem, que às vezes é a fundamental). */
    const parts = [0, 1, 2].map((j) => {
      const own = pick(j).filter((n) => n.s === 2 * j || n.s === 2 * j + 1)
      if (j === 0) return own
      const carry = pick(j - 1).filter((n) => n.s === 2 * j && !own.some((o) => o.midi === n.midi))
      return [...carry, ...own]
    })
    const notes = parts.flat().sort((a, b) => a.midi - b.midi)
    const names = [0, 1, 2].map((j) => formName(P, pick(j)))
    const w = span(notes.map((n) => n.f))
    const windows = parts.map((p, j) => ({ ...span(p.map((n) => n.f)), label: names[j], strings: [2 * j, 2 * j + 1] as [number, number] }))
    return {
      bars: degBars(fromRootGroups(notes, T), 12, names.join(' → ')),
      cols: 12,
      marks: notes.map((n) => on(n, deg(n))),
      windows,
      focus: w,
      opts: {
        key: 'shift',
        value: k,
        items: boxes.map((_, i) => ({ v: i, label: [0, 1, 2].map((j) => formName(P, boxes[(i + j) % boxes.length])).join(' → ') })),
      },
      legend: [{ kind: 'text', text: `Penta ${tonicName(P)} ${modeName(P)} · uma forma a cada 2 cordas` }],
    }
  }

  if (id === 'diag') {
    const D = diagonals(P.keyPc, P.minor)
    const di = Math.min(Math.max(S.diag, 0), D.length - 1)
    const notes = D[di].notes
    const seq = groups(notes, 4)
    const bars: Bar[] = []
    for (let i = 0; i < seq.length; i += 8)
      bars.push({
        ci: null,
        head: i === 0 ? { text: 'Sobe em 4s', sub: diagCell(P.minor) } : undefined,
        events: seq.slice(i, i + 8).map((n, k) => ({ col: k, notes: [{ ...n, role: 'deg' as const, deg: deg(n), color: degreeColor(deg(n)) }] })),
      })
    const neck = diagNeck(P, notes, P.box.notes, P.pos.label)
    return {
      bars,
      cols: 8,
      ...neck,
      opts: {
        key: 'diag',
        value: di,
        items: D.map((d, i) => ({ v: i, label: `${6 - d.start}ª corda · casa ${d.notes[0].f}` })),
      },
      legend: diagLegend(P, `forma ${P.pos.label}`),
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
