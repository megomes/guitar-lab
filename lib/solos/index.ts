/* As lições da aba Solos e a trilha inteira.
 *
 * A trilha (12 módulos, 61 lições) sai da taxonomia; as lições prontas vêm do
 * registry.ts, que o gerador (solos/scripts/gerar_licoes.py) reescreve sozinho a
 * cada lição nova.
 */
import { LESSONS } from './registry'
import trilha from './trilha.json'
import type { TrailModule } from './types'

export { LESSONS }

export const MODULES: TrailModule[] = (trilha as { modulos: TrailModule[] }).modulos
