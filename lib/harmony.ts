/* O campo harmônico: a tríade que nasce em cada grau de uma escala de sete notas,
 * empilhando terças dentro dela. */
import type { QualityId } from './chords'
import type { Scale } from './fretboard'

export interface Diatonic {
  /** Numeral romano: maiúsculo é maior, minúsculo é menor, ° é diminuto. */
  numeral: string
  root: number
  quality: QualityId
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

export function harmonicField(rootPc: number, scale: Scale): Diatonic[] {
  const n = scale.intervals.length
  if (n !== 7) return []
  const at = (i: number) => scale.intervals[i % n] + (i >= n ? 12 : 0)
  return scale.intervals.map((interval, i) => {
    const third = at(i + 2) - interval
    const fifth = at(i + 4) - interval
    const quality: QualityId | null =
      third === 4 && fifth === 7 ? 'maj' : third === 3 && fifth === 7 ? 'min' : third === 3 && fifth === 6 ? 'dim' : third === 4 && fifth === 8 ? 'aug' : null
    const roman = ROMAN[i]
    const numeral =
      quality === 'min' ? roman.toLowerCase() : quality === 'dim' ? `${roman.toLowerCase()}°` : quality === 'aug' ? `${roman}+` : roman
    return { numeral, root: (rootPc + interval) % 12, quality: quality ?? 'maj' }
  })
}
