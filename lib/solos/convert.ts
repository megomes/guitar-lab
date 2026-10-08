/* Da lição para o app: compassos da tab (com som), marcas do braço e anéis da nota-alvo.
 *
 * Cordas: a lição conta como o professor (1 = mi agudo); o app guarda da grave para a
 * aguda (0 = 6ª). A cor sai do grau, igual nas outras telas.
 */
import { STANDARD_TUNING } from '../fretboard'
import type { Mark, NeckWindow, Pin } from '../marks'
import type { Bar, TabNote } from '../practice/session'
import { CHORD_COLOR, degreeColor } from '../roles'
import type { LNote, LVisual } from './types'

export const toS = (corda: number) => 6 - corda
const midiOf = (n: LNote) => STANDARD_TUNING[toS(n.corda)] + n.casa
const pcOf = (n: LNote) => midiOf(n) % 12

/** A tab da lição em colcheias: 8 colunas por compasso. */
export const TAB_COLS = 8

const BAR_DOTS = [CHORD_COLOR.I, CHORD_COLOR.IV, CHORD_COLOR.V, CHORD_COLOR.vi]

export function toBars(v: LVisual): Bar[] {
  const dot = new Map<string, string>()
  return v.compassos.map((b) => {
    if (b.acorde && !dot.has(b.acorde)) dot.set(b.acorde, BAR_DOTS[dot.size % BAR_DOTS.length])
    return {
      ci: null,
      head: b.acorde ? { dot: dot.get(b.acorde), text: b.acorde } : { text: '' },
      events: b.tempos
        .filter((e) => e.notas.length)
        .map((e) => ({
          col: Math.round(e.t * 2),
          notes: e.notas.map(
            (n): TabNote => ({
              s: toS(n.corda),
              f: n.casa,
              midi: midiOf(n),
              role: n.alvo ? 'target' : 'deg',
              deg: n.grau,
              color: degreeColor(n.grau),
            }),
          ),
        })),
    }
  })
}

const allNotes = (v: LVisual): LNote[] => (v.tipo === 'tab' ? v.compassos.flatMap((b) => b.tempos.flatMap((e) => e.notas)) : v.marcas)

/** Cada casa uma vez só: no braço, a frase inteira acesa por baixo do que está soando. */
export function toMarks(v: LVisual): Mark[] {
  const seen = new Map<string, Mark>()
  for (const n of allNotes(v)) {
    const key = `${n.corda}:${n.casa}`
    if (!seen.has(key)) seen.set(key, { string: toS(n.corda), fret: n.casa, pc: pcOf(n), degree: n.grau, level: 'on' })
  }
  return [...seen.values()]
}

export function toRings(v: LVisual): Pin[] {
  const seen = new Set<string>()
  return allNotes(v)
    .filter((n) => n.alvo)
    .filter((n) => !seen.has(`${n.corda}:${n.casa}`) && seen.add(`${n.corda}:${n.casa}`))
    .map((n) => ({ string: toS(n.corda), fret: n.casa }))
}

/** A região do braço onde a frase mora, com uma casa de folga. */
export function toWindow(v: LVisual): NeckWindow | null {
  const frets = allNotes(v).map((n) => n.casa).filter((f) => f > 0)
  if (!frets.length) return null
  return { from: Math.max(0, Math.min(...frets) - 1), to: Math.max(...frets) + 1 }
}

/** "x32010" → casas por corda (6ª→1ª), null = abafada. Casas ≥ 10 vêm em letra. */
export function parseShape(d: string): (number | null)[] {
  return d.split('').map((c) => (c.toLowerCase() === 'x' ? null : parseInt(c, 36)))
}

/** As notas soltas de um acorde, da grave para a aguda: o rasgueado ao tocar no diagrama. */
export function chordMidis(d: string): number[] {
  return parseShape(d).flatMap((f, i) => (f === null ? [] : [STANDARD_TUNING[i] + f]))
}

export const hasNotes = (v: LVisual | null): v is LVisual =>
  !!v && v.tipo !== 'nenhum' && (v.tipo === 'acordes' ? v.acordes.length > 0 : allNotes(v).length > 0)
