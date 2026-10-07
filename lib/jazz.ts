/* A cifra do jazz, para as oito formas do Acordes V2.
 *
 * O professor pede quatro acordes em duas cordas-raiz: maior, menor, maior com 7ª
 * e menor com 7ª, com a fundamental na 6ª ou na 5ª corda. A "7ª" tem mais de uma
 * cara, e é aí que a cifra confunde: o que decide é a terça (maior ou menor) e a
 * sétima (maior, menor ou diminuta). Por isso as duas colunas de 7ª ganham um
 * seletor cada uma, com a cifra do jazz na frente e a cifra de cifra-club ao lado.
 */
import { QUALITIES, type QualityId, type Role, type Voice, type Voicing } from './chords'
import { STANDARD_TUNING, type ShapeId } from './fretboard'

/** As duas formas com pestana: a E (fundamental na 6ª corda) e a A (na 5ª). */
export const V2_SHAPES: { id: ShapeId; string: number; name: string }[] = [
  { id: 'E', string: 6, name: 'fundamental na 6ª corda' },
  { id: 'A', string: 5, name: 'fundamental na 5ª corda' },
]

/** As 7ªs de terça maior e as de terça menor: uma coluna para cada. */
export const MAJOR_SEVENTHS: QualityId[] = ['maj7', 'dom7']
export const MINOR_SEVENTHS: QualityId[] = ['min7', 'm7b5', 'dim7']

export interface JazzSymbol {
  /** Como o jazz escreve depois da fundamental: Δ7, −7, ø7, °7. */
  jazz: string
  /** Como a cifra comum escreve: maj7, m7, m7♭5, dim7. */
  pop: string
  /** O nome por extenso. */
  name: string
  /** O nome em duas palavras, para caber no seletor. */
  short: string
  /** O que vem depois da nota quando se fala: "maior com 7ª maior". */
  say: string
  /** Em uma frase: de que é feito. */
  blurb: string
}

export const JAZZ: Partial<Record<QualityId, JazzSymbol>> = {
  maj: { jazz: '', pop: '', name: 'maior', short: 'maior', say: 'maior', blurb: 'fundamental, terça maior, quinta' },
  min: { jazz: '−', pop: 'm', name: 'menor', short: 'menor', say: 'menor', blurb: 'fundamental, terça menor, quinta' },
  maj7: { jazz: 'Δ7', pop: 'Maj7', name: 'maior com 7ª maior', short: 'maior', say: 'maior com 7ª maior', blurb: 'tríade maior + sétima maior (7)' },
  dom7: { jazz: '7', pop: '7', name: 'dominante', short: 'dominante', say: 'maior com 7ª', blurb: 'tríade maior + sétima menor (♭7): pede resolver' },
  min7: { jazz: '−7', pop: 'm7', name: 'menor com 7ª menor', short: 'menor', say: 'menor com 7ª', blurb: 'tríade menor + sétima menor (♭7)' },
  m7b5: { jazz: 'ø7', pop: 'm7♭5', name: 'meio-diminuto', short: 'meio-dim.', say: 'meio-diminuto', blurb: 'menor com ♭5 + sétima menor (♭7): o ii do ii–V menor' },
  dim7: { jazz: '°7', pop: 'dim7', name: 'diminuto', short: 'diminuto', say: 'diminuto', blurb: 'tudo em terças menores: ♭3, ♭5 e sétima diminuta (♭♭7)' },
}

/** A cifra do jazz: "C", "C−", "CΔ7", "C−7", "C7", "Cø7", "C°7". */
export const jazzSymbol = (rootName: string, quality: QualityId) => rootName + (JAZZ[quality]?.jazz ?? QUALITIES[quality].symbol)

/** A mesma cifra no estilo comum: "C", "Cm", "Cmaj7", "Cm7", "C7", "Cm7♭5", "Cdim7". */
export const popSymbol = (rootName: string, quality: QualityId) => rootName + (JAZZ[quality]?.pop ?? QUALITIES[quality].symbol)

const PT_NOTE: Record<string, string> = { C: 'Dó', D: 'Ré', E: 'Mi', F: 'Fá', G: 'Sol', A: 'Lá', B: 'Si' }

/** A nota como se fala: "B♭" vira "Si bemol", "C♯" vira "Dó sustenido". */
export const ptNote = (name: string) => (PT_NOTE[name[0]] ?? name[0]) + (name[1] === '♯' ? ' sustenido' : name[1] === '♭' ? ' bemol' : '')

/** O acorde como se fala: "Dó maior com 7ª maior". */
export const spokenName = (rootName: string, quality: QualityId) => `${ptNote(rootName)} ${JAZZ[quality]?.say ?? ''}`.trim()

/**
 * O shell voicing: fundamental, terça e sétima, sem a quinta.
 *
 * Três notas em três cordas vizinhas, o que o professor ensina para comping. A
 * quinta é a nota que menos diz sobre o acorde, e a terça com a sétima dizem
 * tudo (maior ou menor, Δ7, −7 ou dominante). Com a raiz na 6ª corda a ordem
 * subindo é 1–7–3 (cordas 6, 4, 3); com a raiz na 5ª é 1–3–7 (cordas 5, 4, 3).
 * Só vale para acordes com sétima.
 */
export function shellVoicing(root: number, quality: QualityId, shape: ShapeId): Voicing | null {
  const q = QUALITIES[quality]
  if (q.seventh === undefined) return null
  const rootString = V2_SHAPES.find((s) => s.id === shape)?.string === 6 ? 0 : 1
  const plan: [number, Role, number][] =
    rootString === 0
      ? [[0, 'R', 0], [2, 'S', q.seventh], [3, 'T', q.third]]
      : [[1, 'R', 0], [2, 'T', q.third], [3, 'S', q.seventh]]
  const rootPc = ((root % 12) + 12) % 12
  const roles: Role[] = ['R', 'T', 'F', 'S']

  /* A fundamental fica entre as casas 1 e 12 (sem corda solta), ou uma oitava acima
     quando é isso que aproxima as outras notas: o Bm7♭5 na forma A fica na casa 14,
     e não com uma nota na casa 12 e outra na 2. */
  const rootBase = (((rootPc - STANDARD_TUNING[rootString]) % 12) + 12) % 12 || 12
  let voices: Voice[] = []
  let bestSpan = Infinity
  for (const anchor of [rootBase, rootBase + 12]) {
    const candidate: Voice[] = plan.map(([string, role, interval]) => {
      const pc = (rootPc + interval) % 12
      const base = (((pc - STANDARD_TUNING[string]) % 12) + 12) % 12
      const near = [base, base + 12, base + 24].filter((f) => f >= 1)
      const fret = role === 'R' ? anchor : near.reduce((x, y) => (Math.abs(y - anchor) < Math.abs(x - anchor) ? y : x))
      return { string, fret, midi: STANDARD_TUNING[string] + fret, pc, role, degree: q.degrees[roles.indexOf(role)] ?? '', isRoot: role === 'R' }
    })
    const frets = candidate.map((v) => v.fret)
    const span = Math.max(...frets) - Math.min(...frets)
    if (span < bestSpan) {
      bestSpan = span
      voices = candidate
    }
  }
  const sounding = new Set(voices.map((v) => v.string))
  const frets = voices.map((v) => v.fret)
  return {
    root: rootPc,
    quality,
    shape,
    symbol: '',
    voices,
    muted: STANDARD_TUNING.map((_, s) => s).filter((s) => !sounding.has(s)),
    window: { from: Math.min(...frets), to: Math.max(...frets) },
  }
}
