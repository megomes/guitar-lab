/* A cifra do jazz, para as oito formas do Acordes V2.
 *
 * O professor pede quatro acordes em duas cordas-raiz: maior, menor, maior com 7ª
 * e menor com 7ª, com a fundamental na 6ª ou na 5ª corda. A "7ª" tem mais de uma
 * cara, e é aí que a cifra confunde: o que decide é a terça (maior ou menor) e a
 * sétima (maior, menor ou diminuta). Por isso as duas colunas de 7ª ganham um
 * seletor cada uma, com a cifra do jazz na frente e a cifra de cifra-club ao lado.
 */
import { QUALITIES, type QualityId } from './chords'
import type { ShapeId } from './fretboard'

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
  /** Em uma frase: de que é feito. */
  blurb: string
}

export const JAZZ: Partial<Record<QualityId, JazzSymbol>> = {
  maj: { jazz: '', pop: '', name: 'maior', short: 'maior', blurb: 'fundamental, terça maior, quinta' },
  min: { jazz: '−', pop: 'm', name: 'menor', short: 'menor', blurb: 'fundamental, terça menor, quinta' },
  maj7: { jazz: 'Δ7', pop: 'maj7', name: 'maior com 7ª maior', short: 'maior', blurb: 'tríade maior + sétima maior (7)' },
  dom7: { jazz: '7', pop: '7', name: 'dominante', short: 'dominante', blurb: 'tríade maior + sétima menor (♭7): pede resolver' },
  min7: { jazz: '−7', pop: 'm7', name: 'menor com 7ª menor', short: 'menor', blurb: 'tríade menor + sétima menor (♭7)' },
  m7b5: { jazz: 'ø7', pop: 'm7♭5', name: 'meio-diminuto', short: 'meio-dim.', blurb: 'menor com ♭5 + sétima menor (♭7): o ii do ii–V menor' },
  dim7: { jazz: '°7', pop: 'dim7', name: 'diminuto', short: 'diminuto', blurb: 'tudo em terças menores: ♭3, ♭5 e sétima diminuta (♭♭7)' },
}

/** A cifra do jazz: "C", "C−", "CΔ7", "C−7", "C7", "Cø7", "C°7". */
export const jazzSymbol = (rootName: string, quality: QualityId) => rootName + (JAZZ[quality]?.jazz ?? QUALITIES[quality].symbol)

/** A mesma cifra no estilo comum: "C", "Cm", "Cmaj7", "Cm7", "C7", "Cm7♭5", "Cdim7". */
export const popSymbol = (rootName: string, quality: QualityId) => rootName + QUALITIES[quality].symbol
