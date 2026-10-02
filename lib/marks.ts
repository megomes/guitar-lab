/* O que o braço desenha, em uma linguagem só para as seis telas.
 *
 * O Fretlab tinha "na forma" e "fora da forma"; o CAGED Lab tinha bolinha
 * grande, pequena, apagada e anel. É a mesma ideia em três intensidades — e é
 * isso que fica: acesa, discreta e fantasma. A cor sai do grau, a não ser que o
 * exercício peça outra (inversões, dedos da aranha).
 */
import type { Spot } from './fretboard'

export type Level = 'on' | 'soft' | 'ghost'

export interface Mark {
  string: number
  fret: number
  pc: number
  /** Grau em relação à referência da tela: "1", "♭3", "5"… Vazio quando não se aplica. */
  degree: string
  level: Level
  /** Cor no lugar da cor do grau. */
  color?: string
  /** Texto no lugar do nome da nota — o dedo, na aranha. */
  label?: string
}

export interface Pin {
  string: number
  fret: number
}

/** Um vão de casas aceso. Com rótulo, quando há vários (as 5 posições). */
export interface NeckWindow {
  from: number
  to: number
  label?: string
}

/** As casas de uma escala, do jeito do Fretlab: a forma acesa, o resto fantasma. */
export function marksFromSpots(spots: Spot[], dimAll = false): Mark[] {
  return spots.map((s) => ({
    string: s.string,
    fret: s.fret,
    pc: s.pc,
    degree: s.degree,
    level: s.inShape && !dimAll ? 'on' : 'ghost',
  }))
}

export type LegendItem =
  | { kind: 'dot'; color: string; text: string }
  | { kind: 'chord'; color: string; text: string }
  | { kind: 'ghost' | 'ring' | 'windows' | 'text'; text: string }
