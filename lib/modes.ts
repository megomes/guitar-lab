/* As sete telas, em três grupos.
 *
 * Consulta é o Fretlab: o braço mostra a escala, o acorde ou a nota, e acabou.
 * Treino é o CAGED Lab: exercícios em tab e braço, com som, para tocar em cima.
 * O Jogo é para decorar o braço: a nota aparece, o dedo acha.
 * As duas metades olham para a mesma tônica e a mesma forma CAGED — trocar uma lá
 * troca aqui.
 */
export type ModeId = 'scales' | 'chords' | 'notes' | 'practice' | 'meeting' | 'plan' | 'quiz'

export type ModeGroup = 'consulta' | 'treino' | 'jogo'

export interface Mode {
  id: ModeId
  group: ModeGroup
  name: string
  hint: string
}

export const MODES: Mode[] = [
  { id: 'scales', group: 'consulta', name: 'Escalas', hint: 'a escala na forma CAGED, e o acorde por cima' },
  { id: 'chords', group: 'consulta', name: 'Acordes', hint: 'a digitação nas cinco formas' },
  { id: 'notes', group: 'consulta', name: 'Notas', hint: 'onde cada nota mora no braço' },
  { id: 'practice', group: 'treino', name: 'Prática', hint: 'exercícios da posição, com som' },
  { id: 'meeting', group: 'treino', name: 'Reunião', hint: 'drills silenciosos para a mão esquerda' },
  { id: 'plan', group: 'treino', name: 'Plano', hint: '30 minutos por noite, uma posição por vez' },
  { id: 'quiz', group: 'jogo', name: 'Jogo', hint: 'decorar o braço: ache a nota' },
]

export const GROUP_NAME: Record<ModeGroup, string> = { consulta: 'Consulta', treino: 'Treino', jogo: 'Jogo' }
