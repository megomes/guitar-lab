/* Tríades fechadas em grupos de três cordas: uma nota por corda, as três
 * inversões subindo o braço. O desenho é o mesmo em todo grupo de cordas e só
 * anda uma casa quando o grupo inclui a corda Si (a terça maior entre Sol e Si).
 */
import { QUALITIES, chordIntervals, type QualityId } from './chords'
import { FRET_COUNT, STANDARD_TUNING } from './fretboard'

/** Os quatro grupos de três cordas vizinhas, da 6ª para a 1ª (0 = 6ª corda). */
export const STRING_SETS: [number, number, number][] = [
  [0, 1, 2],
  [1, 2, 3],
  [2, 3, 4],
  [3, 4, 5],
]

export const setLabel = (set: number[]) => set.map((s) => 6 - s).join('-')

/** As qualidades de três notas: as que têm tríade. */
export const TRIAD_QUALITIES: QualityId[] = ['maj', 'min', 'dim', 'aug', 'sus2', 'sus4']
export const hasTriad = (q: QualityId) => TRIAD_QUALITIES.includes(q)

export const INVERSION_NAME = ['fund.', '1ª inv.', '2ª inv.'] as const

export interface TriadShape {
  /** 0 fundamental no baixo, 1 a terça, 2 a quinta. */
  inv: 0 | 1 | 2
  notes: { string: number; fret: number; pc: number; degree: string }[]
  from: number
  to: number
}

/** Todas as tríades fechadas (as três notas dentro de uma oitava) num grupo de cordas. */
export function closedTriads(rootPc: number, quality: QualityId, set: number[], maxFret = FRET_COUNT): TriadShape[] {
  const ivs = chordIntervals(quality).slice(0, 3)
  const degreeOf = (pc: number) => QUALITIES[quality].degrees[ivs.findIndex((iv) => (rootPc + iv) % 12 === pc)] ?? ''
  const pcs = ivs.map((iv) => (rootPc + iv) % 12)
  const out: TriadShape[] = []
  for (let a = 0; a <= maxFret; a++)
    for (let b = 0; b <= maxFret; b++)
      for (let c = 0; c <= maxFret; c++) {
        const fr = [a, b, c]
        const midi = fr.map((f, k) => STANDARD_TUNING[set[k]] + f)
        const p = midi.map((m) => m % 12)
        if (new Set(p).size < 3 || !p.every((x) => pcs.includes(x))) continue
        if (!(midi[0] < midi[1] && midi[1] < midi[2]) || midi[2] - midi[0] >= 12) continue
        const inv = pcs.indexOf(p[0]) as 0 | 1 | 2
        out.push({
          inv,
          notes: fr.map((f, k) => ({ string: set[k], fret: f, pc: p[k], degree: degreeOf(p[k]) })),
          from: Math.min(...fr),
          to: Math.max(...fr),
        })
      }
  return out.sort((x, y) => x.from - y.from || x.to - y.to)
}
