/* O que fica salvo no navegador, para as seis telas.
 *
 * A tônica e a forma CAGED são uma só: escolher A na forma E em Escalas abre a
 * Prática em A, na posição da forma E — e vice-versa. O modo de leitura do braço
 * (notas, graus) e o "fora da forma" também valem para tudo.
 */
import { QUALITIES, type QualityId } from './chords'
import { MAJOR_SEVENTHS, MINOR_SEVENTHS } from './jazz'
import { SCALES, SHAPE_IDS, type ShapeId } from './fretboard'
import { MODES, type ModeId } from './modes'
import { PROG_BY, type ProgId, type Tonality } from './practice/caged'
import { DRILLS, PERMS, type DrillId } from './practice/drills'
import { EXERCISES, type ExerciseId } from './practice/session'
import { QUIZ_KINDS, type QuizKind, type QuizRound, type QuizSpell } from './quiz'

export type LabelMode = 'both' | 'note' | 'degree'
export type VisMode = 'both' | 'tab' | 'neck'
/** A pentatônica na consulta: a forma CAGED, ou a diagonal com a escada das formas. */
export type ScaleView = 'box' | 'diag'
/** O acorde na consulta: a forma CAGED inteira, ou as tríades num grupo de três cordas. */
export type ChordView = 'caged' | 'triads'

/** Acordes V2: as formas completas, ou o shell (fundamental, terça e sétima). */
export type V2Voicing = 'full' | 'shell'

/** 2: a pentatônica menor virou o padrão de tudo. 3: o jogo pega o braço inteiro. */
export const SETTINGS_VERSION = 3

export interface Settings {
  version: number
  mode: ModeId
  /** Tônica de tudo: da escala, do acorde, do treino. */
  rootPc: number
  /** Forma CAGED de tudo: a caixa da escala, a digitação, a posição do treino. */
  shape: ShapeId
  labelMode: LabelMode
  showOutside: boolean

  /* Consulta */
  scaleId: string
  /** Acorde consultado por cima da escala. Null é braço limpo. */
  lookup: QualityId | null
  quality: QualityId
  /** Acordes V2: qual sétima aparece na coluna da terça maior e na da terça menor. */
  v2Maj7: QualityId
  v2Min7: QualityId
  v2Voicing: V2Voicing
  /** Notas do mapa, na ordem de escolha: a primeira é a referência dos graus. */
  notePcs: number[]
  scaleView: ScaleView
  chordView: ChordView
  /** O grupo de cordas das tríades: 0 = 6-5-4 … 3 = 3-2-1. */
  triadSet: number
  /** 1: a forma uma oitava acima (o CAGED recomeça depois do D), se couber. */
  shapeOct: number
  /** A corda de onde a diagonal sai: 0 = 6ª … 4 = 2ª. */
  diagString: number

  /* Treino */
  tonality: Tonality
  prog: ProgId
  vis: VisMode
  exercise: ExerciseId
  /** O acorde da progressão em foco no braço. */
  chordSel: number
  bpm: number
  click: boolean
  drill: DrillId
  drillVis: VisMode
  perm: string
  box: number
  diag: number
  invSet: number
  cagedSel: number
  rootSel: number
  accSel: number

  /* Jogo */
  quizKind: QuizKind
  /** As cordas que entram no sorteio (0 = 6ª). */
  quizStrings: number[]
  /** As notas que entram no sorteio. */
  quizPcs: number[]
  /** O vão de casas do sorteio. */
  quizLo: number
  quizHi: number
  quizRound: QuizRound
  quizSpell: QuizSpell
  /** Tocar a nota da casa tocada. */
  quizSound: boolean
}

export const DEFAULTS: Settings = {
  version: SETTINGS_VERSION,
  mode: 'scales',
  rootPc: 9,
  shape: 'E',
  labelMode: 'both',
  showOutside: true,
  scaleId: 'pentaMinor',
  lookup: null,
  quality: 'min',
  v2Maj7: 'maj7',
  v2Min7: 'min7',
  v2Voicing: 'full',
  /** A pentatônica menor de Lá, com a tônica primeiro (a referência dos graus). */
  notePcs: [9, 0, 2, 4, 7],
  scaleView: 'box',
  chordView: 'caged',
  triadSet: 0,
  shapeOct: 0,
  diagString: 0,
  tonality: 'min',
  prog: 'menor',
  vis: 'both',
  exercise: 'box',
  chordSel: 0,
  bpm: 70,
  click: false,
  drill: 'caged',
  drillVis: 'both',
  perm: '1234',
  box: 0,
  diag: 0,
  invSet: 3,
  cagedSel: 0,
  rootSel: 0,
  accSel: 0,
  quizKind: 'find',
  quizStrings: [0, 1, 2, 3, 4, 5],
  /** Começa pelas naturais: os sustenidos vêm de graça depois. */
  quizPcs: [0, 2, 4, 5, 7, 9, 11],
  quizLo: 0,
  quizHi: 21,
  quizRound: 'free',
  quizSpell: 'sharp',
  quizSound: true,
}

export const STORAGE_KEY = 'guitarlab:settings'

const VIS: VisMode[] = ['both', 'tab', 'neck']
const int = (v: unknown, lo: number, hi: number, d: number) => (Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi ? (v as number) : d)

/** Lê o que ficou salvo, descartando o que não existe mais nesta versão. */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw)
    const s = Object.fromEntries(
      Object.entries(DEFAULTS).map(([key, value]) => [key, key in parsed ? parsed[key] : value]),
    ) as unknown as Settings
    /* Quem vem da versão 1 passa a abrir na pentatônica menor, o padrão agora. */
    if (!(parsed.version >= 2)) {
      s.scaleId = 'pentaMinor'
      s.notePcs = DEFAULTS.notePcs
    }
    /* Quem vem da versão 2 tinha o jogo só até a casa 12: passa a ser o braço inteiro. */
    if (!(parsed.version >= 3)) {
      s.quizLo = DEFAULTS.quizLo
      s.quizHi = DEFAULTS.quizHi
    }
    s.version = SETTINGS_VERSION
    if (!MODES.some((m) => m.id === s.mode)) s.mode = DEFAULTS.mode
    s.rootPc = int(s.rootPc, 0, 11, DEFAULTS.rootPc)
    if (!SHAPE_IDS.includes(s.shape)) s.shape = DEFAULTS.shape
    if (!['both', 'note', 'degree'].includes(s.labelMode)) s.labelMode = DEFAULTS.labelMode
    s.showOutside = s.showOutside !== false
    if (!SCALES.some((x) => x.id === s.scaleId)) s.scaleId = DEFAULTS.scaleId
    if (!(s.quality in QUALITIES)) s.quality = DEFAULTS.quality
    if (!MAJOR_SEVENTHS.includes(s.v2Maj7)) s.v2Maj7 = DEFAULTS.v2Maj7
    if (!MINOR_SEVENTHS.includes(s.v2Min7)) s.v2Min7 = DEFAULTS.v2Min7
    if (s.v2Voicing !== 'full' && s.v2Voicing !== 'shell') s.v2Voicing = DEFAULTS.v2Voicing
    if (s.lookup !== null && !(s.lookup in QUALITIES)) s.lookup = null
    const pcs = s.notePcs
    s.notePcs = Array.isArray(pcs) && pcs.every((p) => Number.isInteger(p) && p >= 0 && p <= 11) ? [...new Set(pcs)] : DEFAULTS.notePcs
    if (s.scaleView !== 'box' && s.scaleView !== 'diag') s.scaleView = DEFAULTS.scaleView
    if (s.chordView !== 'caged' && s.chordView !== 'triads') s.chordView = DEFAULTS.chordView
    s.triadSet = int(s.triadSet, 0, 3, 0)
    s.shapeOct = int(s.shapeOct, 0, 1, 0)
    s.diagString = int(s.diagString, 0, 4, 0)
    if (s.tonality !== 'min' && s.tonality !== 'maj') s.tonality = DEFAULTS.tonality
    if (!PROG_BY[s.tonality].some((p) => p.id === s.prog)) s.prog = PROG_BY[s.tonality][0].id
    if (!VIS.includes(s.vis)) s.vis = DEFAULTS.vis
    if (!VIS.includes(s.drillVis)) s.drillVis = DEFAULTS.drillVis
    if (!EXERCISES.some((e) => e.id === s.exercise)) s.exercise = DEFAULTS.exercise
    if (!DRILLS.some((d) => d.id === s.drill)) s.drill = DEFAULTS.drill
    if (!PERMS.includes(s.perm)) s.perm = DEFAULTS.perm
    s.chordSel = int(s.chordSel, 0, 3, 0)
    s.bpm = int(s.bpm, 40, 160, DEFAULTS.bpm)
    s.click = s.click === true
    s.box = int(s.box, 0, 4, 0)
    s.diag = int(s.diag, 0, 9, 0)
    s.invSet = int(s.invSet, 0, 3, DEFAULTS.invSet)
    s.cagedSel = int(s.cagedSel, 0, 5, 0)
    s.rootSel = int(s.rootSel, 0, 3, 0)
    s.accSel = int(s.accSel, 0, 3, 0)
    if (!QUIZ_KINDS.some((k) => k.id === s.quizKind)) s.quizKind = DEFAULTS.quizKind
    const list = (v: unknown, hi: number) => (Array.isArray(v) && v.every((x) => Number.isInteger(x) && x >= 0 && x <= hi) ? [...new Set(v as number[])] : null)
    s.quizStrings = list(s.quizStrings, 5) ?? DEFAULTS.quizStrings
    s.quizPcs = list(s.quizPcs, 11) ?? DEFAULTS.quizPcs
    s.quizLo = int(s.quizLo, 0, 21, DEFAULTS.quizLo)
    s.quizHi = int(s.quizHi, 0, 21, DEFAULTS.quizHi)
    if (s.quizHi < s.quizLo) [s.quizLo, s.quizHi] = [DEFAULTS.quizLo, DEFAULTS.quizHi]
    if (s.quizRound !== 'free' && s.quizRound !== 'sprint') s.quizRound = DEFAULTS.quizRound
    if (!['sharp', 'flat', 'mix'].includes(s.quizSpell)) s.quizSpell = DEFAULTS.quizSpell
    s.quizSound = s.quizSound !== false
    return s
  } catch {
    return DEFAULTS
  }
}
