/* Acordes no braço, pela lógica do CAGED.
 *
 * O ChordLab tinha `lib/theory.ts` com qualidades e notas; no piano o acorde é o
 * conjunto de alturas e acabou. Na guitarra o mesmo acorde tem cinco digitações
 * conhecidas, e é a digitação — não o conjunto de notas — que se estuda. Então o
 * que este arquivo produz é uma digitação concreta: corda, casa e o papel que
 * cada nota cumpre.
 */
import { SHARP_NAMES, STANDARD_TUNING, type ShapeId, type Window } from './fretboard'

/**
 * Papel de cada nota no acorde: fundamental, terça, quinta, sétima.
 *
 * A forma escolhe papéis; a qualidade escolhe os semitons de cada papel. É essa
 * separação que deixa as cinco formas servirem para as doze qualidades sem uma
 * tabela de digitações por qualidade.
 */
export type Role = 'R' | 'T' | 'F' | 'S'

export type QualityId =
  | 'maj' | 'min' | 'dim' | 'aug' | 'sus2' | 'sus4'
  | 'maj7' | 'min7' | 'dom7' | 'm7b5' | 'dim7' | 'six'

export interface Quality {
  /** Sufixo da cifra: C, Cm, Cmaj7… */
  symbol: string
  name: string
  third: number
  fifth: number
  seventh?: number
  /** Nome do grau de cada papel, na ordem R T F S. */
  degrees: [string, string, string, string?]
}

export const QUALITIES: Record<QualityId, Quality> = {
  maj:  { symbol: '',     name: 'maior',           third: 4, fifth: 7,              degrees: ['1', '3', '5'] },
  min:  { symbol: 'm',    name: 'menor',           third: 3, fifth: 7,              degrees: ['1', '♭3', '5'] },
  dim:  { symbol: 'dim',  name: 'diminuto',        third: 3, fifth: 6,              degrees: ['1', '♭3', '♭5'] },
  aug:  { symbol: 'aug',  name: 'aumentado',       third: 4, fifth: 8,              degrees: ['1', '3', '♯5'] },
  sus2: { symbol: 'sus2', name: 'suspenso 2',      third: 2, fifth: 7,              degrees: ['1', '2', '5'] },
  sus4: { symbol: 'sus4', name: 'suspenso 4',      third: 5, fifth: 7,              degrees: ['1', '4', '5'] },
  maj7: { symbol: 'maj7', name: 'maior com 7ª',    third: 4, fifth: 7, seventh: 11, degrees: ['1', '3', '5', '7'] },
  min7: { symbol: 'm7',   name: 'menor com 7ª',    third: 3, fifth: 7, seventh: 10, degrees: ['1', '♭3', '5', '♭7'] },
  dom7: { symbol: '7',    name: 'dominante',       third: 4, fifth: 7, seventh: 10, degrees: ['1', '3', '5', '♭7'] },
  m7b5: { symbol: 'm7♭5', name: 'meio-diminuto',   third: 3, fifth: 6, seventh: 10, degrees: ['1', '♭3', '♭5', '♭7'] },
  dim7: { symbol: 'dim7', name: 'diminuto com 7ª', third: 3, fifth: 6, seventh: 9,  degrees: ['1', '♭3', '♭5', '♭♭7'] },
  six:  { symbol: '6',    name: 'com sexta',       third: 4, fifth: 7, seventh: 9,  degrees: ['1', '3', '5', '6'] },
}

export const QUALITY_IDS = Object.keys(QUALITIES) as QualityId[]

/**
 * As duas formas com pestana: fundamental na 6ª corda e fundamental na 5ª.
 *
 * São as formas E e A do CAGED — o que muda não é o desenho, é o uso. No CAGED
 * elas são duas das cinco posições de uma tônica; com pestana são a receita que
 * anda pelo braço inteiro, e é assim que se aprende a tocar acorde em qualquer
 * tom antes de saber o que é CAGED.
 */
export const BARRE_SHAPES: ShapeId[] = ['E', 'A']

/**
 * Em que corda mora a fundamental de cada forma, contada como se conta corda:
 * 6 é o bordão.
 *
 * É o que distingue as formas na prática — E e G levam a fundamental na 6ª, A e
 * C na 5ª, D na 4ª —, e é por isso que escolher só a forma E dá sempre pestana
 * na 6ª corda.
 */
export const SHAPE_ROOT_STRING: Record<ShapeId, number> = { E: 6, G: 6, A: 5, C: 5, D: 4 }

/** A casa da pestana, ou null quando a digitação não tem uma. */
export function barreFret(voicing: Voicing): number | null {
  const pressed = voicing.voices.map((v) => v.fret).filter((f) => f > 0)
  if (pressed.length < 2) return null
  const lowest = Math.min(...pressed)
  return pressed.filter((f) => f === lowest).length >= 2 ? lowest : null
}

/** As qualidades do dia a dia, que cabem numa fileira de botões. */
export const COMMON_QUALITIES: QualityId[] = ['maj', 'min', 'dom7', 'maj7', 'min7', 'sus4']

/** Quanto a mão alcança: da casa mais baixa presa à mais alta. */
const MAX_SPAN = 4

/**
 * O papel que cada corda toca em cada forma, da 6ª para a 1ª.
 *
 * `null` é corda que não soa. `anchor` é a corda da fundamental grave, de onde a
 * forma se constrói — 6ª nas formas E e G, 5ª nas formas A e C, 4ª na D.
 *
 * A sétima vem como lista de variantes porque a corda que ela ocupa depende da
 * qualidade, não só da forma: na forma C, o C7 troca a quinta da 3ª corda
 * (x32310) e o Cmaj7 troca a fundamental da 2ª (x32000) — a outra opção jogaria
 * a nota onze casas acima. Gerando as duas e ficando com a de menor abertura,
 * cada qualidade cai sozinha na digitação que se toca.
 */
const SHAPE_ROLES: Record<
  ShapeId,
  { anchor: number; triad: (Role | null)[]; sevenths: (Role | null)[][] }
> = {
  E: {
    anchor: 0,
    triad: ['R', 'F', 'R', 'T', 'F', 'R'],
    sevenths: [['R', 'F', 'S', 'T', 'F', 'R']],
  },
  A: {
    anchor: 1,
    triad: [null, 'R', 'F', 'R', 'T', 'F'],
    sevenths: [[null, 'R', 'F', 'S', 'T', 'F']],
  },
  G: {
    anchor: 0,
    triad: ['R', 'T', 'F', 'R', 'T', 'R'],
    sevenths: [['R', 'T', 'F', 'R', 'T', 'S']],
  },
  C: {
    anchor: 1,
    triad: [null, 'R', 'T', 'F', 'R', 'T'],
    sevenths: [
      [null, 'R', 'T', 'S', 'R', 'T'],
      [null, 'R', 'T', 'F', 'S', 'T'],
    ],
  },
  D: {
    anchor: 2,
    triad: [null, null, 'R', 'F', 'R', 'T'],
    sevenths: [[null, null, 'R', 'F', 'S', 'T']],
  },
}

const ROLE_ORDER: Role[] = ['R', 'T', 'F', 'S']

export interface Voice {
  string: number
  fret: number
  midi: number
  pc: number
  role: Role
  degree: string
  isRoot: boolean
}

export interface Voicing {
  root: number
  quality: QualityId
  shape: ShapeId
  symbol: string
  /** As cordas que soam, da mais grave para a mais aguda. */
  voices: Voice[]
  /** As cordas que ficam de fora — o × antes da pestana. */
  muted: number[]
  window: Window
}

export function chordSymbol(root: number, quality: QualityId, name: (pc: number) => string = (pc) => SHARP_NAMES[pc]): string {
  return name(((root % 12) + 12) % 12) + QUALITIES[quality].symbol
}

/** Os semitons do acorde, da fundamental à sétima. */
export function chordIntervals(quality: QualityId): number[] {
  const q = QUALITIES[quality]
  return [0, q.third, q.fifth, ...(q.seventh === undefined ? [] : [q.seventh])]
}

/**
 * A digitação de um acorde numa das cinco formas.
 *
 * Construída empilhando: a fundamental grave na corda âncora e, daí para cima,
 * cada corda pega a menor altura que sirva ao seu papel sem descer em relação à
 * corda anterior. É a mesma ideia do `boxFor`, e o resultado paga o caminho: sem
 * uma única casa escrita à mão saem exatamente os acordes abertos que todo mundo
 * aprende — 022100, x02220, xx0232, x32010, 320003 — e, pela mesma conta, suas
 * versões com pestana em qualquer tônica.
 */
export function chordVoicing(
  root: number,
  quality: QualityId,
  shape: ShapeId,
  fromFret = 0,
  tuning = STANDARD_TUNING,
  fretCount = 17,
): Voicing | null {
  const spec = SHAPE_ROLES[shape]
  const q = QUALITIES[quality]
  const semitone: Record<Role, number | undefined> = { R: 0, T: q.third, F: q.fifth, S: q.seventh }
  const variants = q.seventh === undefined ? [spec.triad] : spec.sevenths
  const rootPc = ((root % 12) + 12) % 12

  // A fundamental grave é a primeira que aparece na corda âncora a partir de
  // `fromFret`. Vale tentar a oitava seguinte também: a forma G desce três casas
  // abaixo da âncora, e perto da pestana essa parte cairia em casa negativa — o
  // F na forma G mora na décima, não na primeira.
  const anchorOpen = tuning[spec.anchor]
  const first = fromFret + ((((rootPc - anchorOpen - fromFret) % 12) + 12) % 12)

  let best: Voice[] | null = null
  for (const roles of variants) {
    for (const anchorFret of [first, first + 12]) {
      if (anchorFret > fretCount) break
      const voices = stack(roles, semitone, rootPc, spec.anchor, anchorFret, q, tuning, fretCount)
      if (voices.length >= 3 && (best === null || better(voices, best))) best = voices
    }
  }
  if (best === null) return null

  const sounding = new Set(best.map((v) => v.string))
  const frets = best.map((v) => v.fret)
  return {
    root: rootPc,
    quality,
    shape,
    symbol: chordSymbol(rootPc, quality),
    voices: best,
    muted: tuning.map((_, s) => s).filter((s) => !sounding.has(s)),
    window: { from: Math.min(...frets), to: Math.max(...frets) },
  }
}

/**
 * Empilha a forma a partir da âncora, e para onde a mão para.
 *
 * O corte é o que separa uma digitação de uma lista de notas: quando a próxima
 * corda só serviria ao seu papel numa casa fora do alcance, a forma acaba ali e
 * as cordas restantes ficam mudas. Cortar em vez de esticar é o que evita
 * aberrações como um Cm com a primeira corda na décima primeira casa, e parar em
 * vez de pular mantém as cordas que soam vizinhas — corda muda no meio do acorde
 * ninguém toca.
 */
function stack(
  roles: (Role | null)[],
  semitone: Record<Role, number | undefined>,
  rootPc: number,
  anchorString: number,
  anchorFret: number,
  quality: Quality,
  tuning: number[],
  fretCount: number,
): Voice[] {
  const voices: Voice[] = []
  let previous = -Infinity
  let low = Infinity
  let high = -Infinity

  for (let string = anchorString; string < tuning.length; string++) {
    const role = roles[string]
    const interval = role ? semitone[role] : undefined
    if (role == null || interval === undefined) break

    const pc = (rootPc + interval) % 12
    const floor = string === anchorString ? tuning[string] + anchorFret : Math.max(previous, tuning[string])
    const midi = floor + ((((pc - floor) % 12) + 12) % 12)
    const fret = midi - tuning[string]
    if (fret > fretCount) break

    // Salto maior que uma oitava entre cordas vizinhas não é digitação, é duas
    // digitações. Acontece quando a âncora sai numa corda solta e o grau seguinte
    // só existe muito acima: o Am na forma C ancorado na 5ª solta jogaria a terça
    // para a décima casa. Cortando aqui, a oitava seguinte — pestana na casa 12 —
    // ganha a escolha, que é onde essa forma de fato se toca.
    if (voices.length > 0 && midi - previous > 12) break

    // Corda solta não custa alcance; casa presa, sim.
    const nextLow = fret > 0 ? Math.min(low, fret) : low
    const nextHigh = fret > 0 ? Math.max(high, fret) : high
    if (nextHigh - nextLow > MAX_SPAN) break
    low = nextLow
    high = nextHigh

    voices.push({
      string,
      fret,
      midi,
      pc,
      role,
      degree: quality.degrees[ROLE_ORDER.indexOf(role)] ?? '',
      isRoot: role === 'R',
    })
    previous = midi
  }

  return voices
}

/** Entre duas digitações do mesmo acorde: a mais completa, depois a mais fechada,
 *  depois a mais grave — nessa ordem, que é a ordem em que a mão escolhe. */
function better(candidate: Voice[], current: Voice[]): boolean {
  if (candidate.length !== current.length) return candidate.length > current.length
  const span = (v: Voice[]) => {
    const frets = v.map((x) => x.fret).filter((f) => f > 0)
    return frets.length > 0 ? Math.max(...frets) - Math.min(...frets) : 0
  }
  const a = span(candidate)
  const b = span(current)
  if (a !== b) return a < b
  return Math.min(...candidate.map((v) => v.fret)) < Math.min(...current.map((v) => v.fret))
}

/** A digitação em tablatura: "x32010". Serve para conferir e para o log. */
export function tabOf(voicing: Voicing, strings = 6): string {
  const byString = new Map(voicing.voices.map((v) => [v.string, v.fret]))
  let out = ''
  for (let s = 0; s < strings; s++) {
    const fret = byString.get(s)
    out += fret === undefined ? 'x' : fret > 9 ? `(${fret})` : String(fret)
  }
  return out
}
