/* O teclado do Piano Lab: a geometria das teclas, o acorde e a escala como alturas
 * concretas, e o jogo de acordes que veio do ChordLab.
 *
 * No piano não existe digitação para estudar como no braço: o acorde é o conjunto
 * de alturas e a inversão é qual delas fica no baixo. Por isso este arquivo não
 * sabe nada de forma nem de casa — só de MIDI.
 */
import { QUALITIES, chordIntervals, type QualityId } from './chords'
import type { Scale } from './fretboard'

/** O teclado desenhado: C3…C6, três oitavas e o dó de cima. */
export const LOW_NOTE = 48
export const HIGH_NOTE = 84

const BLACK_PCS = new Set([1, 3, 6, 8, 10])
export const isBlack = (midi: number) => BLACK_PCS.has(((midi % 12) + 12) % 12)

export interface KeyGeometry {
  midi: number
  black: boolean
  /** Posição e largura em % da faixa toda, para o teclado ser fluido. */
  left: number
  width: number
}

/** Brancas lado a lado, pretas centradas sobre a divisa. */
export function keyGeometry(lo = LOW_NOTE, hi = HIGH_NOTE): KeyGeometry[] {
  let whites = 0
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites++
  const w = 100 / whites
  const bw = w * 0.6
  const keys: KeyGeometry[] = []
  let i = 0
  for (let m = lo; m <= hi; m++) {
    const black = isBlack(m)
    keys.push({ midi: m, black, left: black ? i * w - bw / 2 : i * w, width: black ? bw : w })
    if (!black) i++
  }
  return keys
}

/** "C4": o nome com a oitava científica, que é o que se escreve na tecla do dó. */
export const octaveOf = (midi: number) => Math.floor(midi / 12) - 1

export const INVERSION_NAMES = ['estado fundamental', '1ª inversão', '2ª inversão', '3ª inversão']
export const INVERSION_SHORT = ['fund.', '1ª', '2ª', '3ª']

/* ── Acorde e escala ──────────────────────────────────────────────────── */

export interface PianoNote {
  midi: number
  pc: number
  degree: string
}

/**
 * O acorde empilhado a partir de C3, com as vozes de baixo subindo uma oitava
 * até chegar na inversão pedida. Qualquer inversão cabe numa oitava e pouco,
 * então nunca passa do teclado.
 */
export function pianoChord(root: number, quality: QualityId, inversion: number): PianoNote[] {
  const ivs = chordIntervals(quality)
  const inv = inversion % ivs.length
  const degrees = QUALITIES[quality].degrees
  const stacked = ivs.map((iv, i) => ({ iv: i < inv ? iv + 12 : iv, degree: degrees[i] ?? '' }))
  let notes = stacked.map(({ iv, degree }) => ({ midi: LOW_NOTE + root + iv, pc: (root + iv) % 12, degree }))
  while (Math.max(...notes.map((n) => n.midi)) > HIGH_NOTE) notes = notes.map((n) => ({ ...n, midi: n.midi - 12 }))
  return notes.sort((a, b) => a.midi - b.midi)
}

/** A escala numa oitava, da tônica (a partir de C4) à tônica de cima. */
export function pianoScale(root: number, scale: Scale): PianoNote[] {
  const base = 60 + root
  return [
    ...scale.intervals.map((iv, i) => ({ midi: base + iv, pc: (root + iv) % 12, degree: scale.degrees[i] })),
    { midi: base + 12, pc: root, degree: '1' },
  ]
}

/** A nota do baixo de cada inversão. */
export const bassOf = (root: number, quality: QualityId, inversion: number) => (root + chordIntervals(quality)[inversion % chordIntervals(quality).length]) % 12

/** As escalas da consulta do piano: as do dia a dia. */
export const PIANO_SCALES: { id: string; label: string }[] = [
  { id: 'major', label: 'Maior' },
  { id: 'minor', label: 'Menor' },
  { id: 'pentaMajor', label: 'Penta maior' },
  { id: 'pentaMinor', label: 'Penta menor' },
  { id: 'blues', label: 'Blues' },
]

/* ── Tríade, sétima e nona ────────────────────────────────────────────── */

/**
 * Na consulta do piano o acorde é montado em camadas: a tríade, a sétima (ou a
 * sexta) por cima, e a nona por cima de tudo. A cifra sai da combinação — C, C7,
 * C9, C7(♭9), Cm6/9 —, que é como se lê no songbook.
 */
export type Seventh = 'none' | '6' | 'b7' | '7' | 'bb7'
export type Ninth = 'none' | '9' | 'b9' | '#9'

export const TRIADS: QualityId[] = ['maj', 'min', 'dim', 'aug', 'sus2', 'sus4']
export const isTriad = (q: QualityId) => TRIADS.includes(q)

const SEVENTH: Record<Exclude<Seventh, 'none'>, { iv: number; degree: string; label: string; name: string }> = {
  '6': { iv: 9, degree: '6', label: '6', name: 'sexta' },
  b7: { iv: 10, degree: '♭7', label: '♭7', name: '7ª menor' },
  '7': { iv: 11, degree: '7', label: '7M', name: '7ª maior' },
  bb7: { iv: 9, degree: '♭♭7', label: '♭♭7', name: '7ª diminuta' },
}

const NINTH: Record<Exclude<Ninth, 'none'>, { iv: number; degree: string; name: string }> = {
  '9': { iv: 14, degree: '9', name: '9ª' },
  b9: { iv: 13, degree: '♭9', name: '9ª menor' },
  '#9': { iv: 15, degree: '♯9', name: '9ª aumentada' },
}

export const SEVENTH_LABEL = (s: Seventh) => (s === 'none' ? '—' : SEVENTH[s].label)
export const NINTH_LABEL = (n: Ninth) => (n === 'none' ? '—' : NINTH[n].degree)
export const NINTHS: Ninth[] = ['none', '9', 'b9', '#9']

/** As sétimas que fazem sentido em cada tríade: a sexta só na maior e na menor, a
 *  diminuta só na diminuta (e o sus2 com sexta não tem nome que se use). */
export function seventhsFor(triad: QualityId): Seventh[] {
  if (triad === 'maj' || triad === 'min') return ['none', '6', 'b7', '7']
  if (triad === 'dim') return ['none', 'b7', 'bb7', '7']
  return ['none', 'b7', '7']
}

export interface ChordSpec {
  root: number
  triad: QualityId
  seventh: Seventh
  ninth: Ninth
}

interface Tone {
  iv: number
  degree: string
}

/** As notas da tríade com a sétima: o que gira nas inversões. A nona fica fora. */
function coreTones({ triad, seventh }: ChordSpec): Tone[] {
  const q = QUALITIES[triad]
  const tones = [0, q.third, q.fifth].map((iv, i) => ({ iv, degree: q.degrees[i] ?? '' }))
  const s = seventh === 'none' ? undefined : SEVENTH[seventh]
  if (s) tones.push({ iv: s.iv, degree: s.degree })
  return tones
}

export const specSize = (spec: ChordSpec) => coreTones(spec).length

/** Os intervalos de tudo, para a roda e para a grafia. */
export function specIntervals(spec: ChordSpec): number[] {
  const ivs = coreTones(spec).map((t) => t.iv)
  return spec.ninth === 'none' ? ivs : [...ivs, NINTH[spec.ninth].iv]
}

export function specDegrees(spec: ChordSpec): string[] {
  const d = coreTones(spec).map((t) => t.degree)
  return spec.ninth === 'none' ? d : [...d, NINTH[spec.ninth].degree]
}

/** A nota do baixo na inversão pedida. */
export const specBass = (spec: ChordSpec, inversion: number) => {
  const core = coreTones(spec)
  return (spec.root + core[inversion % core.length].iv) % 12
}

/**
 * O acorde empilhado a partir de C3, com as vozes de baixo subindo uma oitava até
 * a inversão pedida. A nona vai sempre por cima de tudo — no baixo ela deixa de
 * soar como nona.
 */
export function pianoVoicing(spec: ChordSpec, inversion: number): PianoNote[] {
  const core = coreTones(spec)
  const inv = inversion % core.length
  const base = LOW_NOTE + spec.root
  let notes = core.map((t, i) => {
    const iv = i < inv ? t.iv + 12 : t.iv
    return { midi: base + iv, pc: (spec.root + t.iv) % 12, degree: t.degree }
  })
  if (spec.ninth !== 'none') {
    const n = NINTH[spec.ninth]
    const top = Math.max(...notes.map((x) => x.midi))
    let midi = base + n.iv
    while (midi <= top) midi += 12
    notes.push({ midi, pc: (spec.root + n.iv) % 12, degree: n.degree })
  }
  while (Math.max(...notes.map((x) => x.midi)) > HIGH_NOTE) notes = notes.map((x) => ({ ...x, midi: x.midi - 12 }))
  return notes.sort((a, b) => a.midi - b.midi)
}

/** O sufixo da cifra: m7, maj9, 7(♭9), m6/9, add9… */
export function specSuffix({ triad, seventh, ninth }: ChordSpec): string {
  const sus = triad === 'sus2' || triad === 'sus4' ? triad : ''
  const nine = ninth === 'none' ? '' : NINTH[ninth].degree
  /* A tétrade, em cifra de songbook. */
  let base: string
  if (seventh === 'none') base = triad === 'maj' ? '' : triad === 'min' ? 'm' : triad === 'dim' ? 'dim' : triad === 'aug' ? 'aug' : ''
  else if (seventh === '6') base = triad === 'min' ? 'm6' : '6'
  else if (seventh === 'bb7') base = 'dim7'
  else if (seventh === 'b7') base = triad === 'min' ? 'm7' : triad === 'dim' ? 'm7♭5' : triad === 'aug' ? '7♯5' : '7'
  else base = triad === 'min' ? 'm(maj7)' : triad === 'dim' ? 'dim(maj7)' : triad === 'aug' ? 'maj7♯5' : 'maj7'

  if (!nine) return base + sus
  /* Nona natural sobre sétima: o 7 vira 9 (C9, Cm9, Cmaj9, C9sus4). */
  if (ninth === '9' && seventh !== 'none' && seventh !== '6') {
    if (base === '7') return `9${sus}`
    if (base === 'm7') return 'm9'
    if (base === 'maj7') return `maj9${sus}`
    if (base === 'm(maj7)') return 'm(maj9)'
    return `${base}(9)${sus}`
  }
  if (seventh === '6') return `${base}/${nine}`
  /* Sem sétima é add: Cadd9, Cm(add9), Csus4(add9). */
  if (seventh === 'none') return base || sus ? `${base}${sus}(add${nine})` : `add${nine}`
  return `${base}${sus}(${nine})`
}

/** "menor · 7ª menor · 9ª": o nome por extenso, por camadas. */
export function specName({ triad, seventh, ninth }: ChordSpec): string {
  return [QUALITIES[triad].name, seventh !== 'none' && SEVENTH[seventh].name, ninth !== 'none' && NINTH[ninth].name].filter(Boolean).join(' · ')
}

/* ── O jogo (do ChordLab) ─────────────────────────────────────────────── */

export type Group = 'triads' | 'sevenths'
export const groupOf = (q: QualityId): Group => (QUALITIES[q].seventh === undefined ? 'triads' : 'sevenths')

export interface KeyOption {
  id: string
  label: string
  tonic?: number
  minor?: boolean
}

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11]
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10]
const MAJOR_TRIADS: QualityId[] = ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim']
const MINOR_TRIADS: QualityId[] = ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj']
const MAJOR_SEVENTHS: QualityId[] = ['maj7', 'min7', 'min7', 'maj7', 'dom7', 'min7', 'm7b5']
const MINOR_SEVENTHS: QualityId[] = ['min7', 'm7b5', 'maj7', 'min7', 'min7', 'maj7', 'dom7']
const ROMAN_MAJOR = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']
const ROMAN_MINOR = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']

/** As tonalidades do ChordLab: o cromático, nove maiores e seis menores. */
export const KEY_OPTIONS: KeyOption[] = [
  { id: 'free', label: 'Livre · cromático' },
  { id: '0-maj', label: 'C maior', tonic: 0, minor: false },
  { id: '7-maj', label: 'G maior', tonic: 7, minor: false },
  { id: '2-maj', label: 'D maior', tonic: 2, minor: false },
  { id: '9-maj', label: 'A maior', tonic: 9, minor: false },
  { id: '4-maj', label: 'E maior', tonic: 4, minor: false },
  { id: '5-maj', label: 'F maior', tonic: 5, minor: false },
  { id: '10-maj', label: 'B♭ maior', tonic: 10, minor: false },
  { id: '3-maj', label: 'E♭ maior', tonic: 3, minor: false },
  { id: '8-maj', label: 'A♭ maior', tonic: 8, minor: false },
  { id: '9-min', label: 'A menor', tonic: 9, minor: true },
  { id: '4-min', label: 'E menor', tonic: 4, minor: true },
  { id: '11-min', label: 'B menor', tonic: 11, minor: true },
  { id: '2-min', label: 'D menor', tonic: 2, minor: true },
  { id: '7-min', label: 'G menor', tonic: 7, minor: true },
  { id: '0-min', label: 'C menor', tonic: 0, minor: true },
]

export function parseKey(id: string): { tonic: number; minor: boolean } | null {
  const m = /^(\d+)-(maj|min)$/.exec(id)
  if (!m) return null
  const tonic = Number(m[1])
  return tonic >= 0 && tonic <= 11 ? { tonic, minor: m[2] === 'min' } : null
}

export interface Challenge {
  root: number
  quality: QualityId
  inversion: number
  pcs: number[]
  bassPc: number
  /** Grau no tom, quando sorteado dentro de um. */
  degree?: number
  keyId: string
}

interface Candidate {
  root: number
  quality: QualityId
  degree?: number
}

/** Todos os acordes que os filtros deixam sortear. */
export function chordPool(qualities: QualityId[], keyId: string): Candidate[] {
  const key = parseKey(keyId)
  const out: Candidate[] = []
  if (!key) {
    for (let root = 0; root < 12; root++) for (const quality of qualities) out.push({ root, quality })
    return out
  }
  const steps = key.minor ? MINOR_STEPS : MAJOR_STEPS
  const triads = key.minor ? MINOR_TRIADS : MAJOR_TRIADS
  const sevenths = key.minor ? MINOR_SEVENTHS : MAJOR_SEVENTHS
  for (let degree = 0; degree < 7; degree++) {
    const root = (key.tonic + steps[degree]) % 12
    for (const quality of qualities) {
      const diatonic = groupOf(quality) === 'triads' ? triads[degree] === quality : sevenths[degree] === quality
      /* Suspenso não é diatônico, mas cabe em qualquer grau que não seja diminuto —
         é assim que aparece na prática. */
      const suspended = (quality === 'sus2' || quality === 'sus4') && triads[degree] !== 'dim'
      if (diatonic || suspended) out.push({ root, quality, degree })
    }
  }
  return out
}

function challenge(c: Candidate, inversion: number, keyId: string): Challenge {
  const ivs = chordIntervals(c.quality)
  const inv = inversion % ivs.length
  return { ...c, inversion: inv, pcs: ivs.map((i) => (c.root + i) % 12), bassPc: (c.root + ivs[inv]) % 12, keyId }
}

/** Sorteia um acorde dentro dos filtros, sem repetir o anterior. */
export function pickChallenge(qualities: QualityId[], inversions: number[], keyId: string, previous: Challenge | null): Challenge | null {
  const pool = chordPool(qualities, keyId)
  if (pool.length === 0) return null
  const invs = inversions.length ? inversions : [0]
  for (let tries = 0; tries < 80; tries++) {
    const c = pool[Math.floor(Math.random() * pool.length)]
    const allowed = invs.filter((i) => i < chordIntervals(c.quality).length)
    if (!allowed.length) continue
    const inversion = allowed[Math.floor(Math.random() * allowed.length)]
    if (previous && previous.root === c.root && previous.quality === c.quality && previous.inversion === inversion) continue
    return challenge(c, inversion, keyId)
  }
  /* Filtro tão estreito que só sobra um acorde: repete em vez de travar. */
  const only = pool[0]
  return challenge(only, invs.find((i) => i < chordIntervals(only.quality).length) ?? 0, keyId)
}

export function romanOf(c: Challenge): string | null {
  const key = parseKey(c.keyId)
  if (c.degree == null || !key) return null
  return (key.minor ? ROMAN_MINOR : ROMAN_MAJOR)[c.degree]
}

export type Judgement = 'pending' | 'correct' | 'wrong'

/**
 * As notas tocadas contra o alvo. Dobrar uma nota em outra oitava vale — é o que a
 * mão faz —; nota de fora não vale e erra na hora.
 */
export function judge(pressed: number[], target: Challenge, requireBass: boolean): Judgement {
  if (pressed.length === 0) return 'pending'
  const played = new Set(pressed.map((n) => n % 12))
  const wanted = new Set(target.pcs)
  for (const pc of played) if (!wanted.has(pc)) return 'wrong'
  if (played.size < wanted.size) return 'pending'
  if (requireBass && Math.min(...pressed) % 12 !== target.bassPc) return 'wrong'
  return 'correct'
}

/** A voicing de referência do desafio, para o "Ouvir" e para a dica no teclado. */
export const challengeNotes = (c: Challenge) => pianoChord(c.root, c.quality, c.inversion)
