/* Braço, escalas e as cinco posições do CAGED.
 *
 * O ChordLab tinha `lib/keyboard.ts` com a geometria das 61 teclas. No violão a
 * geometria é outra e traz um problema que o piano não tem: a mesma nota mora em
 * vários lugares. É disso que o CAGED trata, e é por isso que ele é o eixo da
 * tela em vez de um detalhe de exibição.
 */

export const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const

/** Afinação padrão, da 6ª para a 1ª corda: E2 A2 D3 G3 B3 E4. */
export const STANDARD_TUNING = [40, 45, 50, 55, 59, 64]
export const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e']
/** O braço inteiro de uma guitarra, em todas as telas. */
export const FRET_COUNT = 21

/** Marcações de posição do braço. 12 leva dois pontos. */
export const INLAYS = [3, 5, 7, 9, 12, 15, 17, 19, 21]
export const DOUBLE_INLAYS = [12]

export function noteName(pc: number): string {
  return SHARP_NAMES[((pc % 12) + 12) % 12]
}

/* ── Escalas ──────────────────────────────────────────────────────────── */

export interface Scale {
  id: string
  name: string
  /** Semitons acima da tônica. */
  intervals: number[]
  /** Nome de cada grau, na mesma ordem. Explícito porque o mesmo semitom muda
   *  de nome conforme a escala: 6 é ♯4 no lídio e ♭5 no lócrio. */
  degrees: string[]
}

/* As quatro primeiras são as do dia a dia; o resto fica para quando fizer falta. */
export const SCALES: Scale[] = [
  { id: 'major',      name: 'Maior (jônio)',   intervals: [0, 2, 4, 5, 7, 9, 11], degrees: ['1', '2', '3', '4', '5', '6', '7'] },
  { id: 'minor',      name: 'Menor natural',   intervals: [0, 2, 3, 5, 7, 8, 10], degrees: ['1', '2', '♭3', '4', '5', '♭6', '♭7'] },
  { id: 'pentaMajor', name: 'Pentatônica maior', intervals: [0, 2, 4, 7, 9],      degrees: ['1', '2', '3', '5', '6'] },
  { id: 'pentaMinor', name: 'Pentatônica menor', intervals: [0, 3, 5, 7, 10],     degrees: ['1', '♭3', '4', '5', '♭7'] },
  { id: 'dorian',     name: 'Dórico',          intervals: [0, 2, 3, 5, 7, 9, 10], degrees: ['1', '2', '♭3', '4', '5', '6', '♭7'] },
  { id: 'phrygian',   name: 'Frígio',          intervals: [0, 1, 3, 5, 7, 8, 10], degrees: ['1', '♭2', '♭3', '4', '5', '♭6', '♭7'] },
  { id: 'lydian',     name: 'Lídio',           intervals: [0, 2, 4, 6, 7, 9, 11], degrees: ['1', '2', '3', '♯4', '5', '6', '7'] },
  { id: 'mixolydian', name: 'Mixolídio',       intervals: [0, 2, 4, 5, 7, 9, 10], degrees: ['1', '2', '3', '4', '5', '6', '♭7'] },
  { id: 'locrian',    name: 'Lócrio',          intervals: [0, 1, 3, 5, 6, 8, 10], degrees: ['1', '♭2', '♭3', '4', '♭5', '♭6', '♭7'] },
  { id: 'harmonic',   name: 'Menor harmônica', intervals: [0, 2, 3, 5, 7, 8, 11], degrees: ['1', '2', '♭3', '4', '5', '♭6', '7'] },
  { id: 'melodic',    name: 'Menor melódica',  intervals: [0, 2, 3, 5, 7, 9, 11], degrees: ['1', '2', '♭3', '4', '5', '6', '7'] },
  { id: 'blues',      name: 'Blues',           intervals: [0, 3, 5, 6, 7, 10],    degrees: ['1', '♭3', '4', '♭5', '5', '♭7'] },
]

export const SCALE_BY_ID = new Map(SCALES.map((s) => [s.id, s]))

/* ── CAGED ────────────────────────────────────────────────────────────── */

export type ShapeId = 'C' | 'A' | 'G' | 'E' | 'D'

/**
 * As cinco formas, na ordem do grau da pentatônica que cai na nota mais grave
 * da 6ª corda: a forma E começa na tônica, a D no grau seguinte, e assim por
 * diante. Subindo o braço a partir da E a sequência é E-D-C-A-G, que é o ciclo
 * CAGED lido ao contrário — como tem que ser.
 */
const SHAPE_ORDER: ShapeId[] = ['E', 'D', 'C', 'A', 'G']
export const SHAPE_IDS: ShapeId[] = ['C', 'A', 'G', 'E', 'D']

const PENTA_MAJOR = [0, 2, 4, 7, 9]
const PENTA_MINOR = [0, 3, 5, 7, 10]

function nearest(intervals: number[], target: number): number {
  return intervals.reduce(
    (best, i) => (Math.abs(i - target) < Math.abs(best - target) ? i : best),
    intervals[0],
  )
}

/**
 * A pentatônica que serve de esqueleto para a escala.
 *
 * Toda posição CAGED é uma caixa pentatônica com notas de passagem em volta —
 * é assim que se ensina e é o que faz as posições se encaixarem umas nas
 * outras. Escala com terça maior herda a pentatônica maior; o resto herda a
 * menor. Grau que a escala não tem é trocado pelo vizinho mais próximo, que é o
 * que resolve lócrio (sem 5ª justa) e menor harmônica (sem ♭7).
 */
function pentatonicOf(scale: Scale): number[] {
  const template = scale.intervals.includes(4) ? PENTA_MAJOR : PENTA_MINOR
  const mapped = template.map((t) => (scale.intervals.includes(t) ? t : nearest(scale.intervals, t)))
  return [...new Set(mapped)].sort((a, b) => a - b)
}

export interface Window {
  from: number
  to: number
}

export interface Position {
  shape: ShapeId
  /** Vão de casas ocupado pela posição. */
  window: Window
  /** As casas da posição, por corda (índice 0 = 6ª). */
  frets: number[][]
}

/**
 * A caixa de uma forma, montada por índice de grau em vez de janela de casas.
 *
 * Cada corda leva duas notas consecutivas da pentatônica, avançando dois graus
 * por corda. É o que garante a propriedade que define uma caixa pentatônica —
 * exatamente duas notas por corda — e que uma janela de casas fixa não garante:
 * onde o espaçamento aperta, a janela pega uma terceira nota que não pertence à
 * forma.
 */
export function boxFor(
  rootPc: number,
  shape: ShapeId,
  scale: Scale,
  tuning = STANDARD_TUNING,
  fretCount = FRET_COUNT,
): Position | null {
  const penta = pentatonicOf(scale)
  const size = penta.length
  const degree = SHAPE_ORDER.indexOf(shape)
  const midiFor = (i: number) =>
    rootPc + 12 * Math.floor(i / size) + penta[((i % size) + size) % size]

  const fretsFor = (base: number) =>
    tuning.map((open, s) => [0, 1].map((j) => midiFor(base + 2 * s + j) - open))

  // Sobe de oitava em oitava até a caixa inteira caber no braço desenhado.
  let base = degree
  while (midiFor(base) < tuning[0]) base += size
  for (let tries = 0; tries < 12; tries++) {
    const frets = fretsFor(base)
    const flat = frets.flat()
    if (flat.every((f) => f >= 0 && f <= fretCount)) {
      return { shape, window: { from: Math.min(...flat), to: Math.max(...flat) }, frets }
    }
    base += size
  }
  return null
}

/** A mesma forma uma oitava acima — o CAGED recomeça depois do D. Null se não cabe. */
export function shiftPosition(p: Position, by: number, fretCount = FRET_COUNT): Position | null {
  if (p.window.to + by > fretCount || p.window.from + by < 0) return null
  return { ...p, window: { from: p.window.from + by, to: p.window.to + by }, frets: p.frets.map((fs) => fs.map((f) => f + by)) }
}

/* ── Posições no braço ────────────────────────────────────────────────── */

export interface Spot {
  string: number
  fret: number
  midi: number
  pc: number
  degree: string
  isRoot: boolean
  /** Pertence à forma escolhida. */
  inShape: boolean
}

/**
 * Toda ocorrência da escala no braço, marcando as que pertencem à forma.
 *
 * Numa pentatônica a forma é a caixa e nada mais. Numa escala de sete notas a
 * forma é a caixa mais as notas de passagem que caem no mesmo vão — é o que dá,
 * por exemplo, a posição de C maior na forma E entre as casas 7 e 10, com três
 * notas na 6ª corda e duas na 2ª.
 */
export function scaleSpots(
  rootPc: number,
  scale: Scale,
  position: Position | null,
  tuning = STANDARD_TUNING,
  fretCount = FRET_COUNT,
): Spot[] {
  const degreeByPc = new Map<number, string>()
  scale.intervals.forEach((interval, i) => {
    degreeByPc.set((rootPc + interval) % 12, scale.degrees[i])
  })

  const pentatonic = scale.intervals.length <= 5

  const spots: Spot[] = []
  for (let string = 0; string < tuning.length; string++) {
    for (let fret = 0; fret <= fretCount; fret++) {
      const midi = tuning[string] + fret
      const pc = midi % 12
      const degree = degreeByPc.get(pc)
      if (degree === undefined) continue

      let inShape = false
      if (position) {
        inShape = pentatonic
          ? position.frets[string].includes(fret)
          : fret >= position.window.from && fret <= position.window.to
      }

      spots.push({ string, fret, midi, pc, degree, isRoot: pc === rootPc % 12, inShape })
    }
  }
  return spots
}

/** Onde aquela nota exata pode ser tocada. Serve para acender o que soou. */
export function positionsForMidi(
  midi: number,
  tuning = STANDARD_TUNING,
  fretCount = FRET_COUNT,
): { string: number; fret: number }[] {
  const out: { string: number; fret: number }[] = []
  for (let string = 0; string < tuning.length; string++) {
    const fret = midi - tuning[string]
    if (fret >= 0 && fret <= fretCount) out.push({ string, fret })
  }
  return out
}

/* ── Alvo: uma casa por nota ──────────────────────────────────────────── */

/**
 * O que aconteceu com a nota que soou, do ponto de vista da forma escolhida.
 *
 * - `inShape`: é a nota da forma, na casa da forma.
 * - `wrong`: caiu dentro da caixa mas não pertence à escala — é o ✗.
 * - `elsewhere`: a altura existe no braço, só que fora da caixa. Pode ser a nota
 *   certa tocada na posição errada, que é um erro diferente e merece aviso
 *   diferente.
 */
export type HitKind = 'inShape' | 'wrong' | 'elsewhere'

export interface Hit {
  string: number
  fret: number
  kind: HitKind
}

/**
 * A casa que aquela nota ocupa — uma só.
 *
 * O detector entrega altura, não corda: um D4 cabe em três cordas e até agora
 * todas acendiam. Acender todas ensina a coisa errada, porque o exercício é
 * justamente tocar aquela nota naquela casa. E quando o alvo virar acorde, um
 * mesmo conjunto de alturas terá várias digitações possíveis e só uma pedida.
 *
 * Então escolhe-se uma: a que pertence à forma; na falta dela, a que cai dentro
 * do vão da forma; na falta das duas, a mais próxima do vão, marcada como
 * `elsewhere` para a tela poder mostrá-la de canto de olho em vez de sumir e
 * parecer que o app não ouviu.
 *
 * Empate entre duas casas igualmente boas — acontece em vão de cinco casas,
 * onde o intervalo de quatro semitons entre a 3ª e a 2ª corda repete a altura —
 * fica com a corda mais aguda, que é a digitação que a mão já está fazendo.
 */
export function hitFor(
  midi: number,
  spots: Spot[],
  position: Position | null,
  tuning = STANDARD_TUNING,
  fretCount = FRET_COUNT,
): Hit | null {
  const places = positionsForMidi(midi, tuning, fretCount)
  if (places.length === 0) return null

  const window = position?.window ?? { from: 0, to: fretCount }
  const center = (window.from + window.to) / 2
  // Distância ao vão: zero dentro dele, e cresce para fora.
  const away = (fret: number) => Math.max(0, window.from - fret, fret - window.to)
  const best = <T extends { string: number; fret: number }>(list: T[]) =>
    list.reduce((a, b) => {
      const da = away(a.fret) * 100 + Math.abs(a.fret - center)
      const db = away(b.fret) * 100 + Math.abs(b.fret - center)
      return db < da || (db === da && b.string > a.string) ? b : a
    })

  const inShape = places.filter((p) =>
    spots.some((s) => s.inShape && s.string === p.string && s.fret === p.fret),
  )
  if (inShape.length > 0) return { ...best(inShape), kind: 'inShape' }

  // Altura sem nenhuma ocorrência na escala: erro de nota, e a casa mostrada é a
  // que fica dentro do vão — é lá que a mão estava.
  const onScale = places.filter((p) =>
    spots.some((s) => s.string === p.string && s.fret === p.fret),
  )
  if (onScale.length === 0) return { ...best(places), kind: 'wrong' }

  // Nota da escala, altura fora da caixa: erro de posição, não de nota.
  return { ...best(onScale), kind: 'elsewhere' }
}
