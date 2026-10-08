/* Gerado por solos/scripts/gerar_licoes.py — não editar à mão. As lições prontas, na ordem da trilha. */
import type { Lesson } from './types'

import L_C01_1 from './licoes/C01.1.json'
import L_C01_2 from './licoes/C01.2.json'
import L_C01_3 from './licoes/C01.3.json'
import L_C01_4 from './licoes/C01.4.json'
import L_C01_5 from './licoes/C01.5.json'
import L_C02_1 from './licoes/C02.1.json'
import L_C07_3 from './licoes/C07.3.json'
import L_C09_1 from './licoes/C09.1.json'

export const LESSONS: Record<string, Lesson> = {
  'C01.1': L_C01_1 as unknown as Lesson,
  'C01.2': L_C01_2 as unknown as Lesson,
  'C01.3': L_C01_3 as unknown as Lesson,
  'C01.4': L_C01_4 as unknown as Lesson,
  'C01.5': L_C01_5 as unknown as Lesson,
  'C02.1': L_C02_1 as unknown as Lesson,
  'C07.3': L_C07_3 as unknown as Lesson,
  'C09.1': L_C09_1 as unknown as Lesson,
}
