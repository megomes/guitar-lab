/* O mapa de notas: as casas das notas escolhidas, com o intervalo contado a partir
 * da primeira delas. É a consulta do "Achar notas" do app nativo, sem a pergunta. */
import { FRET_COUNT, STANDARD_TUNING, type Spot } from './fretboard'

/** Nome do intervalo de cada semitom acima da nota de referência. */
const INTERVALS = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7']

/** As sete notas sem acidente: C D E F G A B. É o que o braço mostra de saída. */
export const NATURALS = [0, 2, 4, 5, 7, 9, 11]
export const ALL_PCS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

/** Liga ou desliga uma nota. A ordem de escolha é mantida: a primeira é a
 *  referência dos graus e a que acende em âmbar. */
export function togglePc(selected: number[], pc: number): number[] {
  return selected.includes(pc) ? selected.filter((p) => p !== pc) : [...selected, pc]
}

/**
 * As casas das notas escolhidas, e só elas.
 *
 * As outras não viram fantasma: aqui a pergunta é "onde estão estas notas", e o
 * braço coberto de sustenidos apagados atrapalha mais do que ajuda.
 */
export function noteSpots(selected: number[], tuning = STANDARD_TUNING, fretCount = FRET_COUNT): Spot[] {
  const chosen = new Set(selected)
  const ref = selected[0] ?? 0
  const spots: Spot[] = []
  for (let string = 0; string < tuning.length; string++) {
    for (let fret = 0; fret <= fretCount; fret++) {
      const midi = tuning[string] + fret
      const pc = midi % 12
      if (!chosen.has(pc)) continue
      spots.push({
        string,
        fret,
        midi,
        pc,
        degree: INTERVALS[(pc - ref + 12) % 12],
        isRoot: pc === ref,
        inShape: true,
      })
    }
  }
  return spots
}

/** As casas da nota em cada corda, da 6ª para a 1ª. */
export function fretsByString(pc: number, tuning = STANDARD_TUNING, fretCount = FRET_COUNT): number[][] {
  return tuning.map((open) => {
    const out: number[] = []
    for (let fret = (pc - open + 120) % 12; fret <= fretCount; fret += 12) out.push(fret)
    return out
  })
}
