/* A grafia das notas: C♯ ou D♭.
 *
 * O Fretlab escrevia tudo em sustenido; o CAGED Lab trocava para bemol nos tons
 * de bemol. Aqui vale a regra do CAGED Lab para o app inteiro: o nome sai do tom,
 * e o tom de uma tônica menor é o da relativa maior. Escala de sete notas tem uma
 * regra a mais — cada letra uma vez só —, que é o que a teoria pede.
 */
export type Names = (pc: number) => string

const SHARPS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const FLATS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']

const mod12 = (x: number) => ((x % 12) + 12) % 12

export const sharpNames: Names = (pc) => SHARPS[mod12(pc)]
export const flatNames: Names = (pc) => FLATS[mod12(pc)]

/** Tons maiores escritos em bemol: F, B♭, E♭, A♭, D♭. */
const FLAT_KEYS = [5, 10, 3, 8, 1]

/** Escala ou acorde de cara menor: tem ♭3 e não tem 3. */
export const isMinorish = (intervals: number[]) => intervals.includes(3) && !intervals.includes(4)

/** O tom maior que dá a grafia: o da própria tônica, ou o da relativa maior. */
export const keyOf = (tonicPc: number, minor: boolean) => mod12(minor ? tonicPc + 3 : tonicPc)

export function namesForKey(keyPc: number): Names {
  return FLAT_KEYS.includes(mod12(keyPc)) ? flatNames : sharpNames
}

export function namesForTonic(tonicPc: number, minor: boolean): Names {
  return namesForKey(keyOf(tonicPc, minor))
}

/** Escala inteira: com sete notas, a grafia que usa cada letra uma vez. */
export function namesForScale(rootPc: number, intervals: number[]): Names {
  const byKey = namesForTonic(rootPc, isMinorish(intervals))
  if (intervals.length !== 7) return byKey
  const distinct = (names: Names) => new Set(intervals.map((i) => names(rootPc + i)[0])).size === 7
  const sharp = distinct(sharpNames)
  const flat = distinct(flatNames)
  if (sharp !== flat) return sharp ? sharpNames : flatNames
  return byKey
}

/** O nome de cada tônica no seletor, escrito no tom dela mesma. */
export const tonicLabel = (pc: number, minor: boolean) => namesForTonic(pc, minor)(pc)
