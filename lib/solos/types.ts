/* A lição da aba Solos, como sai de solos/scripts/gerar_licoes.py.
 *
 * O formato é neutro de propósito — corda 1 é o mi agudo, como o professor fala —
 * e convert.ts traduz para o que a tab, o braço e o som do app já entendem.
 */

export interface LNote {
  /** 1 = mi agudo … 6 = mi grave. */
  corda: number
  casa: number
  nota: string
  /** Em relação ao acorde do compasso, ou à tônica do visual. */
  grau: string
  alvo: boolean
}

export interface LBeat {
  /** Posição no compasso 4/4: 0, 0.5, 1 … 3.5. */
  t: number
  notas: LNote[]
}

export interface LBar {
  acorde: string
  tempos: LBeat[]
}

export interface LChord {
  nome: string
  /** Seis posições da 6ª para a 1ª corda; x abafada; a = 10, b = 11… */
  digitacao: string
}

export interface LVisual {
  id: string
  tipo: 'tab' | 'braco' | 'acordes' | 'nenhum'
  legenda: string
  tonica: string
  bpm: number
  compassos: LBar[]
  marcas: LNote[]
  acordes: LChord[]
}

export interface LSource {
  id: string
  tipo: 'video' | 'documento'
  autor: string
  titulo: string
  url: string
  /** Id do vídeo no YouTube, quando é vídeo. */
  video: string | null
  /** Segundo em que o trecho começa (já com 2 s de folga). */
  inicio: number | null
  momento: string | null
  ideia: string
}

export interface LConcept {
  titulo: string
  texto: string
  destaque: string
  visual: LVisual | null
}

export interface LExercise {
  titulo: string
  objetivo: string
  nivel: 'iniciante' | 'intermediario' | 'avancado'
  minutos: number
  passos: string[]
  visual: LVisual | null
  variacoes: string[]
  cuidado: string
  inspirado_em: LSource[]
}

export type Illustration = 'respiracao' | 'gravidade' | 'conversa' | 'mapa' | 'ondas' | 'degraus'

export interface Lesson {
  titulo: string
  gancho: string
  porque_importa: string
  ilustracao: Illustration
  conceito: LConcept[]
  fontes_destaque: { ref: number; porque: string; fonte: LSource }[]
  exercicios: LExercise[]
  erros_comuns: string[]
  resumo: string[]
  proximos_passos: string
  _meta: { subcategoria: string; modulo: { id: string; nome: string }; nome: string }
}

export interface TrailLesson {
  id: string
  nome: string
  descricao: string
  nivel: string
  itens: number
  fontes: number
}

export interface TrailModule {
  id: string
  nome: string
  descricao: string
  licoes: TrailLesson[]
}
