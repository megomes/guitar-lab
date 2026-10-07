'use client'

/* Acordes V2 — as oito formas que o professor pede para decorar.
 *
 * Quatro acordes (maior, menor, maior com 7ª, menor com 7ª) em duas formas com
 * pestana: fundamental na 6ª corda (a forma E) e na 5ª (a forma A). Cada
 * diagrama escreve o grau dentro da bolinha — é o grau que se decora, não a nota
 * — e a cifra vem no jeito do jazz, com a de cifra comum ao lado.
 *
 * "Com 7ª" não é um acorde só. A terça maior admite sétima maior (Δ7) ou menor
 * (o dominante, 7); a terça menor admite a menor (−7), a menor com quinta
 * bemol (ø7, o meio-diminuto) e a diminuta (°7). Cada uma das duas colunas tem o
 * seu seletor, e o quadro de baixo desfaz a dúvida de qual símbolo é qual.
 */
import { QUALITIES, chordVoicing, tabOf, type QualityId } from '@/lib/chords'
import { JAZZ, MAJOR_SEVENTHS, MINOR_SEVENTHS, V2_SHAPES, jazzSymbol, popSymbol, shellVoicing } from '@/lib/jazz'
import { degreeColor } from '@/lib/roles'
import type { Settings, V2Voicing } from '@/lib/settings'

import { useNames } from '../names'
import { Segmented } from '../ui'
import { Tonics } from './Controls'
import { Box, type Dot } from './Stage'

type Setter = <K extends keyof Settings>(key: K) => (value: Settings[K]) => void

interface Props {
  settings: Settings
  set: Setter
}

interface Column {
  key: string
  title: string
  quality: QualityId
  /** As 7ªs que a coluna aceita; sem isso, a coluna é fixa. */
  options?: QualityId[]
  onQuality?: (q: QualityId) => void
}

export function ChordsV2({ settings, set }: Props) {
  const { rootPc, labelMode, v2Maj7, v2Min7, v2Voicing } = settings
  const nn = useNames()

  const columns: Column[] = [
    { key: 'maj', title: 'Maior', quality: 'maj' },
    { key: 'min', title: 'Menor', quality: 'min' },
    { key: 'maj7', title: 'Maior com 7ª', quality: v2Maj7, options: MAJOR_SEVENTHS, onQuality: set('v2Maj7') },
    { key: 'min7', title: 'Menor com 7ª', quality: v2Min7, options: MINOR_SEVENTHS, onQuality: set('v2Min7') },
  ]

  const label = (d: Dot) => (labelMode === 'note' ? nn(d.pc) : d.degree)

  return (
    <main className="wrap screen v2">
      <div className="screen-head">
        <h1 className="screen-title">
          Acordes V2
          <small>as 8 formas com pestana</small>
        </h1>
      </div>

      <div className="controls card">
        <Tonics rootPc={rootPc} minor={false} onRoot={set('rootPc')} />
        <Segmented<V2Voicing>
          options={[
            { value: 'full', label: 'completo' },
            { value: 'shell', label: 'shell: 1 · 3 · 7' },
          ]}
          value={v2Voicing}
          onChange={set('v2Voicing')}
        />
        <Segmented
          options={[
            { value: 'degree', label: 'graus' },
            { value: 'note', label: 'notas' },
          ]}
          value={labelMode === 'note' ? 'note' : 'degree'}
          onChange={set('labelMode')}
        />
      </div>

      <div className="v2-grid">
        {columns.map((col) => {
          const info = JAZZ[col.quality]
          const shell = v2Voicing === 'shell' && !!col.options
          return (
            <section key={col.key} className="v2-col card" aria-label={col.title}>
              <header className="v2-head">
                <h2>{col.title}</h2>
                {col.options && col.onQuality && (
                  <Segmented<QualityId>
                    options={col.options.map((q) => ({ value: q, label: JAZZ[q]?.jazz ?? '' }))}
                    value={col.quality}
                    onChange={col.onQuality}
                  />
                )}
                <p className="v2-blurb">
                  <b>{[info?.jazz && `${info.jazz} ${info.name}`, QUALITIES[col.quality].degrees.filter((d) => !(shell && d?.includes('5'))).join(' ')].filter(Boolean).join(' · ') || info?.name}</b>
                  {info?.blurb}
                </p>
              </header>
              <div className="v2-cells">
                {V2_SHAPES.map((shape) => {
                  /* Sem corda solta: o que se decora é a forma que anda pelo braço. */
                  const v =
                    shell
                      ? shellVoicing(rootPc, col.quality, shape.id)
                      : chordVoicing(rootPc, col.quality, shape.id, 1)
                  return (
                    <div key={shape.id} className="v2-cell">
                      <Box
                        dots={v?.voices ?? []}
                        muted={v?.muted}
                        label={label}
                        title={
                          <>
                            {jazzSymbol(nn(rootPc), col.quality)}
                            <small>
                              {popSymbol(nn(rootPc), col.quality)} · raiz na {shape.string}ª{shell ? ' · sem 5ª' : ''}
                            </small>
                          </>
                        }
                      />
                      {v && (
                        <ol className="v2-degs" aria-label="grau de cada corda, da mais grave para a mais aguda">
                          {v.voices.map((voice) => (
                            <li key={voice.string} style={{ color: degreeColor(voice.degree) }}>
                              <small>{6 - voice.string}ª</small>
                              {voice.degree}
                            </li>
                          ))}
                        </ol>
                      )}
                      {v && <span className="v2-tab mono">{tabOf(v)}</span>}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

    </main>
  )
}
