/* As oito telas, em três grupos.
 *
 * Consulta é o Fretlab: o braço mostra a escala, o acorde ou a nota, e acabou.
 * Treino é o CAGED Lab: exercícios em tab e braço, com som, para tocar em cima.
 * O Jogo é para decorar o braço: a nota aparece, o dedo acha.
 * As duas metades olham para a mesma tônica e a mesma forma CAGED — trocar uma lá
 * troca aqui.
 */
export type ModeId = 'scales' | 'chords' | 'chords3' | 'notes' | 'practice' | 'meeting' | 'plan' | 'quiz' | 'solos' | 'pChords' | 'pScales' | 'pGame'

export type ModeGroup = 'consulta' | 'treino' | 'jogo' | 'estudo' | 'piano' | 'pjogo'

/** O app é um só; o seletor do topo troca o instrumento e, com ele, as telas. */
export type Instrument = 'guitar' | 'piano'

export interface Mode {
  id: ModeId
  group: ModeGroup
  instrument: Instrument
  name: string
  hint: string
}

export const MODES: Mode[] = [
  { id: 'scales', group: 'consulta', instrument: 'guitar', name: 'Escalas', hint: 'a escala na forma CAGED, e o acorde por cima' },
  { id: 'chords', group: 'consulta', instrument: 'guitar', name: 'Acordes', hint: 'a digitação nas cinco formas' },
  { id: 'chords3', group: 'consulta', instrument: 'guitar', name: 'Acordes V3', hint: 'as formas que estou decorando: pestana e tríade, na 6ª e na 5ª corda' },
  { id: 'notes', group: 'consulta', instrument: 'guitar', name: 'Notas', hint: 'onde cada nota mora no braço' },
  { id: 'practice', group: 'treino', instrument: 'guitar', name: 'Prática', hint: 'exercícios da posição, com som' },
  { id: 'meeting', group: 'treino', instrument: 'guitar', name: 'Reunião', hint: 'drills silenciosos para a mão esquerda' },
  { id: 'plan', group: 'treino', instrument: 'guitar', name: 'Plano', hint: '30 minutos por noite, uma posição por vez' },
  { id: 'quiz', group: 'jogo', instrument: 'guitar', name: 'Jogo', hint: 'decorar o braço: ache a nota' },
  { id: 'solos', group: 'estudo', instrument: 'guitar', name: 'Solos', hint: 'lições de solo e improvisação, com exercícios que tocam' },
  { id: 'pChords', group: 'piano', instrument: 'piano', name: 'Acordes', hint: 'o acorde no teclado, com as inversões' },
  { id: 'pScales', group: 'piano', instrument: 'piano', name: 'Escalas', hint: 'a escala numa oitava, da tônica à tônica' },
  { id: 'pGame', group: 'pjogo', instrument: 'piano', name: 'Jogo', hint: 'o app pede um acorde, você toca — no MIDI, no teclado do computador ou na tela' },
]

export const instrumentOf = (mode: ModeId): Instrument => MODES.find((m) => m.id === mode)?.instrument ?? 'guitar'

export const modesOf = (instrument: Instrument) => MODES.filter((m) => m.instrument === instrument)

export const INSTRUMENT_NAME: Record<Instrument, string> = { guitar: 'Guitar Lab', piano: 'Piano Lab' }

export const GROUP_NAME: Record<ModeGroup, string> = { consulta: 'Consulta', treino: 'Treino', jogo: 'Jogo', estudo: 'Estudo', piano: 'Piano', pjogo: 'Jogo' }
