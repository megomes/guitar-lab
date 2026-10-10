/* Modo reunião: drills de mão esquerda, desplugado e sem som.
 *
 * Dois blocos. Técnica — laços de legato, escala legato em 3 por corda e dedos plantados —,
 * o que se faz de hammer-on, pull-off e independência de dedo sem precisar de palheta. E o
 * braço — penta em 3s, formas em 3s, diagonal e raízes —, na tônica e no maior/menor
 * escolhidos no topo da Reunião (os mesmos da Prática).
 */
import { STRING_LABELS } from '../fretboard'
import { sharpNames } from '../spelling'
import type { LegendItem, Mark, NeckWindow } from '../marks'
import { ROLE_COLOR, degreeColor } from '../roles'
import { OPEN, diagCell, diagonals, groups, mod12, pentBoxes, rootPositions, type PNote } from './caged'
import { diagLegend, diagNeck, modeName, pentDeg, positionOf, tonicName, type Bar, type Practice, type TabEvent, type Tech } from './session'

export type DrillId = 'lacos' | 'escala3' | 'plantados' | 'maj7' | 'pent3' | 'formas3' | 'diag' | 'raizes'
export type DrillIcon = 'loop' | 'stairs' | 'anchor' | 'arp' | 'wave' | 'route' | 'diag' | 'eye'

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
    id: 'lacos',
    name: 'Laços de legato',
    min: 4,
    icon: 'loop',
    key: false,
    why: 'Um laço de dedos numa corda só, em hammer-on e pull-off, com a mão parada na posição: a palheta só na primeira nota, o resto sai da mão esquerda. É o motor do legato de Satriani e Vai.',
    steps: [
      'Indicador fixo na casa 5. Palheta só na primeira nota de cada corda.',
      'Subindo, hammer-on; voltando, pull-off — puxe a corda um pouco para baixo ao soltar, para a nota soar.',
      'Todas as notas com o mesmo volume: o dedo fraco bate mais forte, o forte mais leve.',
      'Dois laços por corda, da 6ª à 1ª e de volta. Metrônomo: 30 segundos, sobe 5 bpm.',
    ],
  },
  {
    id: 'escala3',
    name: 'Escala legato em 3 por corda',
    min: 5,
    icon: 'stairs',
    key: true,
    why: 'A escala do tom com três notas por corda, inteira em legato: subindo em hammer-on — até a primeira nota de cada corda, um hammer-on "do nada" —, descendo em pull-off. Treina força, igualdade e troca de corda sem palheta.',
    steps: [
      'Sai da fundamental na 6ª corda, três notas por corda até a 1ª, e volta.',
      'Subindo: a primeira nota de cada corda nova é um hammer-on do nada, sem palheta.',
      'Descendo: pull-off em tudo; a primeira nota de cada corda nova sai com o dedo já posicionado.',
      'O número é o dedo: onde a corda pede abertura (1 2 4 com tom e tom), abra a mão em vez de deslizar.',
    ],
  },
  {
    id: 'plantados',
    name: 'Dedos plantados',
    min: 3,
    icon: 'anchor',
    key: false,
    why: 'Os quatro dedos apertados numa corda; um de cada vez vai para a corda vizinha e volta, enquanto os outros três ficam parados. É o exercício de independência dos dedos de verdade.',
    steps: [
      'Dedos 1 2 3 4 nas casas 5 6 7 8 da corda de baixo do par, todos apertando.',
      'Só um dedo sai: vai para a mesma casa na corda de cima e volta. Os outros três não se mexem.',
      'Faça os quatro dedos, depois troque o par de cordas. O 3 e o 4 são os que mais brigam.',
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

/** Os laços: os dedos de uma volta, e se a mão abre (tom entre os dedos) ou fica um dedo por casa. */
export const LOOPS: { id: string; fingers: number[]; stretch: boolean; label: string }[] = [
  { id: '1242', fingers: [1, 2, 4, 2], stretch: false, label: '1 2 4 2' },
  { id: '1343', fingers: [1, 3, 4, 3], stretch: false, label: '1 3 4 3' },
  { id: '123432', fingers: [1, 2, 3, 4, 3, 2], stretch: false, label: '1 2 3 4 3 2' },
  { id: '1242x', fingers: [1, 2, 4, 2], stretch: true, label: '1 2 4 2 aberto' },
]

/** Os pares de cordas dos dedos plantados: a de baixo segura, a de cima recebe. */
export const ANCHOR_PAIRS = [0, 1, 2, 3, 4]

export interface DrillChoices {
  loop: string
  anchor: number
  maj7Pair: number
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

type Fingered = PNote & { finger: number; tech?: Tech }

/** Em compassos de `per` notas, com o número do dedo na tab. */
function fingerBars(notes: Fingered[], per: number, head?: (i: number) => string): Bar[] {
  const bars: Bar[] = []
  for (let i = 0; i < notes.length; i += per)
    bars.push({
      ci: null,
      head: head ? { text: head(i) } : undefined,
      events: notes.slice(i, i + per).map((n, k) => ({
        col: k,
        notes: [{ s: n.s, f: n.f, midi: n.midi, role: 'deg' as const, color: ROLE_COLOR.other, label: String(n.finger), tech: n.tech }],
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

/**
 * As ligaduras de uma sequência em legato: na mesma corda, subir é hammer-on e descer é pull-off;
 * a primeira nota de uma corda nova é palhetada, ou — com `fromNowhere` — um hammer-on do nada.
 * `slide` diz quando a passagem na mesma corda é um deslize em vez de ligadura.
 */
function legato<T extends PNote>(seq: T[], opts: { fromNowhere?: boolean; slide?: (a: T, b: T) => boolean } = {}): (T & { tech?: Tech })[] {
  return seq.map((n, i) => {
    const prev = seq[i - 1]
    if (!prev) return { ...n }
    if (prev.s !== n.s) return opts.fromNowhere ? { ...n, tech: 'h' as Tech } : { ...n }
    if (prev.f === n.f) return { ...n }
    const up = n.f > prev.f
    if (opts.slide?.(prev, n)) return { ...n, tech: (up ? '/' : '\\') as Tech }
    return { ...n, tech: (up ? 'h' : 'p') as Tech }
  })
}

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

  if (id === 'lacos') {
    const L = LOOPS.find((x) => x.id === S.loop) ?? LOOPS[0]
    /* Um dedo por casa a partir da 5; aberto, um tom entre os dedos (1 2 4 → 5 7 9). */
    const fretOf = (finger: number) => (L.stretch ? 5 + [0, 0, 2, 3, 4][finger] : 4 + finger)
    const lap = (s: number) => [...L.fingers, ...L.fingers].map((finger) => fn(s, fretOf(finger), finger))
    const order = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0]
    const notes = legato(order.flatMap(lap))
    const per = L.fingers.length * 2
    return {
      bars: fingerBars(notes, per, (i) => `Corda ${STRING_LABELS[notes[i].s]} · palheta só na 1ª`),
      cols: per,
      marks: fingerMarks(notes),
      windows: [{ from: 5, to: fretOf(4) }],
      focus: { from: 5, to: fretOf(4) },
      opts: { key: 'loop', value: L.id, items: LOOPS.map((x) => ({ v: x.id, label: `Dedos ${x.label}` })) },
      legend: [{ kind: 'text', text: 'Número = dedo · sobe em hammer-on, volta em pull-off' }],
    }
  }

  if (id === 'escala3') {
    /* A escala maior ou a menor natural do tom, da fundamental na 6ª corda, três notas por corda. */
    const steps = P.minor ? [2, 1, 2, 2, 1, 2, 2] : [2, 2, 1, 2, 2, 2, 1]
    let r = mod12(T - OPEN[0])
    if (r < 1) r += 12
    const up: Fingered[] = []
    let midi = OPEN[0] + r
    let k = 0
    for (let s = 0; s < 6; s++) {
      const frets: number[] = []
      for (let j = 0; j < 3; j++) {
        frets.push(midi - OPEN[s])
        midi += steps[k % 7]
        k++
      }
      /* O dedo pela distância: meio tom é dedo vizinho, tom pula um (1 2 4, 1 3 4, 1 2 4 aberto). */
      const d1 = frets[1] - frets[0]
      const d2 = frets[2] - frets[1]
      const fingers = d1 === 1 ? [1, 2, 4] : d2 === 1 ? [1, 3, 4] : [1, 2, 4]
      frets.forEach((f, j) => up.push(fn(s, f, fingers[j])))
    }
    const notes = legato([...up, ...up.slice().reverse()], { fromNowhere: true })
    const fs = notes.map((n) => n.f)
    const w = span(fs)
    const degOfScale = (n: PNote) => {
      const iv = mod12(n.midi - T)
      const deg: Record<number, string> = P.minor ? { 0: '1', 2: '2', 3: '♭3', 5: '4', 7: '5', 8: '♭6', 10: '♭7' } : { 0: '1', 2: '2', 4: '3', 5: '4', 7: '5', 9: '6', 11: '7' }
      return deg[iv] ?? ''
    }
    return {
      bars: fingerBars(notes, 6, (i) => (i < up.length ? `Sobe · hammer-on (do nada na corda nova)` : 'Desce · pull-off')),
      cols: 6,
      marks: up.map((n) => ({ string: n.s, fret: n.f, pc: mod12(n.midi), degree: degOfScale(n), level: 'on' as const })),
      windows: [w],
      focus: w,
      /* Sem opções: a escala vem da tônica e do maior/menor do topo. */
      opts: { key: 'loop', value: '', items: [] },
      legend: [{ kind: 'text', text: `Escala ${tonicName(P)} ${modeName(P)} · na tab, o número é o dedo` }],
    }
  }

  if (id === 'plantados') {
    const lo = ANCHOR_PAIRS.includes(S.anchor) ? S.anchor : 0
    const hi = lo + 1
    /* Cada dedo vai para a corda de cima e volta, duas vezes; os outros três seguem plantados. */
    const notes: Fingered[] = []
    for (let finger = 1; finger <= 4; finger++)
      for (let k = 0; k < 2; k++) notes.push(fn(hi, 4 + finger, finger), fn(lo, 4 + finger, finger))
    const marks: Mark[] = [
      ...[1, 2, 3, 4].map((finger): Mark => ({ string: lo, fret: 4 + finger, pc: mod12(OPEN[lo] + 4 + finger), degree: '', level: 'on', label: String(finger) })),
      ...[1, 2, 3, 4].map((finger): Mark => ({ string: hi, fret: 4 + finger, pc: mod12(OPEN[hi] + 4 + finger), degree: '', level: 'outline', label: String(finger) })),
    ]
    return {
      bars: fingerBars(notes, 8, (i) => `Dedos ${notes[i].finger} e ${notes[Math.min(i + 4, notes.length - 1)].finger} · os outros plantados`),
      cols: 8,
      marks,
      windows: [{ from: 5, to: 8, strings: [lo, hi] }],
      focus: { from: 5, to: 8 },
      opts: { key: 'anchor', value: lo, items: ANCHOR_PAIRS.map((x) => ({ v: x, label: `Cordas ${STRING_LABELS[x]} e ${STRING_LABELS[x + 1]}` })) },
      legend: [
        { kind: 'text', text: 'aceso: os dedos plantados' },
        { kind: 'outline', text: 'para onde cada um vai, sozinho' },
      ],
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
    /* Os nomes também fixos (F♯, G, G♯…), para ser sempre o mesmo exercício, em qualquer tônica do topo. */
    const name = (shift: number) => `${sharpNames(rootOf(shift))}maj7`
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
      bars: degBars(legato(fromRootGroups(notes, T)), 12, 'Do 1 ao 1'),
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
      bars: degBars(
        legato(fromRootGroups(notes, T), {
          /* O deslize é a nota de baixo da corda de troca para a de cima (ou o contrário). */
          slide: (x, y) => Math.abs(y.f - x.f) >= 3 && parts.some((p, j) => j > 0 && p[0].s === x.s && p[0].midi === Math.min(x.midi, y.midi)),
        }),
        12,
        names.join(' → '),
      ),
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
