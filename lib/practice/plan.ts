/* O plano: 30 minutos por noite, uma posição por noite, e o critério para avançar.
 *
 * As evoluções eram fixas no CAGED Lab (a partir de Em). Aqui saem do tom em uso:
 * o mesmo raciocínio — outro tom, a relativa maior, o VI maior —, em qualquer tônica.
 */
import { mod12, type ProgId, type Tonality } from './caged'
import type { ExerciseId, Practice } from './session'

export const BLOCKS: { min: number; name: string; ex: ExerciseId; txt: string }[] = [
  { min: 4, name: 'Forma da penta', ex: 'box', txt: 'Aquecimento: a penta da posição do root ao topo, ao grave e de volta.' },
  { min: 5, name: 'Acordes cheios', ex: 'base', txt: 'A progressão com as formas completas da posição da noite.' },
  { min: 8, name: 'Arpejos encadeados', ex: 'arp', txt: 'Colcheias contínuas no metrônomo, nota mais próxima na troca.' },
  { min: 6, name: 'Penta até a terça', ex: 'penta', txt: 'Linha na penta da tônica caindo na terça de cada acorde.' },
  { min: 7, name: 'Penta de cada acorde', ex: 'pchord', txt: 'Com backing track, gravando. Maior nos maiores, menor nos menores.' },
]

export function blockRanges(): [number, number][] {
  let acc = 0
  return BLOCKS.map((b) => {
    const r: [number, number] = [acc, acc + b.min]
    acc += b.min
    return r
  })
}

export interface Evolution {
  title: string
  text: string
  load: { tonality: Tonality; tonicPc: number; prog: ProgId }
}

export function evolutions(P: Practice): Evolution[] {
  const nn = P.names
  const rel = mod12(P.keyPc + 9)
  const otherMinor = rel === 9 ? 4 : 9
  const K = nn(P.keyPc)
  const VI = nn(rel)
  return [
    {
      title: 'Trocar de tom',
      text: `${otherMinor === 9 ? 'A' : 'E'} menor: as mesmas formas em outro lugar do braço.`,
      load: { tonality: 'min', tonicPc: otherMinor, prog: 'menor' },
    },
    {
      title: 'Penta maior',
      text: `${K} maior, I V vi IV: as mesmas notas lidas a partir do ${K}.`,
      load: { tonality: 'maj', tonicPc: P.keyPc, prog: 'pop' },
    },
    {
      title: 'Desafio VI maior',
      text: `${K} maior com ${VI} maior no lugar do ${VI}m: o ${nn(rel + 4)} não está na penta.`,
      load: { tonality: 'maj', tonicPc: P.keyPc, prog: 'desafio' },
    },
  ]
}
