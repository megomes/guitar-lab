'use client'

/* A barra da direita: a análise do que está no braço, e os atalhos que saem
 * dela — o campo harmônico leva ao acorde, as cinco formas levam o braço. */
import { ChevronRight, Sparkles } from 'lucide-react'
import { memo } from 'react'

import { QUALITIES, QUALITY_IDS, SHAPE_ROOT_STRING, barreFret, chordSymbol, chordVoicing, tabOf, type QualityId, type Voicing } from '@/lib/chords'
import { SHAPE_IDS, STRING_LABELS, type Scale, type ShapeId } from '@/lib/fretboard'
import { harmonicField } from '@/lib/harmony'
import { fretsByString } from '@/lib/notes'
import { ROLE_COLOR } from '@/lib/roles'
import { sharpNames } from '@/lib/spelling'

import { useNames } from '../names'
import { Chip, Group, Panel } from '../ui'
import { qualityLabel } from './Sidebars'

/* ── Escalas ──────────────────────────────────────────────────────────── */

interface ScaleInsightsProps {
  rootPc: number
  scale: Scale
  shape: ShapeId
  lookup: QualityId | null
  voicing: Voicing | null
  onLookup: (quality: QualityId | null) => void
  onOpenChord: (root: number, quality: QualityId) => void
}

function ScaleInsightsView({ rootPc, scale, shape, lookup, voicing, onLookup, onOpenChord }: ScaleInsightsProps) {
  const nn = useNames()
  const field = harmonicField(rootPc, scale)
  const barre = voicing ? barreFret(voicing) : null

  return (
    <Panel title="Análise" className="side side-right">
      <Group
        label="Acorde por cima"
        hint={`tônica ${nn(rootPc)} · forma ${shape}`}
        action={lookup ? { label: 'limpar', onPress: () => onLookup(null) } : undefined}
        grid={4}
      >
        {QUALITY_IDS.map((id) => (
          <Chip key={id} label={qualityLabel(id)} fixed on={lookup === id} onPress={() => onLookup(lookup === id ? null : id)} />
        ))}
      </Group>

      {lookup && (
        <div className="result glass">
          <Sparkles size={16} strokeWidth={1.6} />
          <span className="result-symbol">{chordSymbol(rootPc, lookup, nn)}</span>
          <span className="result-detail">
            {voicing ? `${tabOf(voicing)}${barre === null ? '' : ` · pestana ${barre}`}` : `sem digitação na forma ${shape}`}
          </span>
        </div>
      )}

      {field.length > 0 && (
        <section className="group">
          <h3 className="group-label">
            Campo harmônico<span className="group-hint">toque para abrir</span>
          </h3>
          <div className="hfield">
            {field.map((d) => (
              <button key={d.numeral} type="button" className="hfield-item" onClick={() => onOpenChord(d.root, d.quality)}>
                <span className="hfield-numeral">{d.numeral}</span>
                <span className="hfield-symbol">{chordSymbol(d.root, d.quality, nn)}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </Panel>
  )
}

export const ScaleInsights = memo(ScaleInsightsView)

/* ── Acordes ──────────────────────────────────────────────────────────── */

function ChordInsightsView({ rootPc, quality, shape, onShape }: { rootPc: number; quality: QualityId; shape: ShapeId; onShape: (shape: ShapeId) => void }) {
  const nn = useNames()
  return (
    <Panel title="As cinco formas" className="side side-right">
      <div className="actions">
        {SHAPE_IDS.map((id) => {
          const v = chordVoicing(rootPc, quality, id)
          const barre = v ? barreFret(v) : null
          return (
            <button key={id} type="button" className={`action${shape === id ? ' action-on' : ''}`} onClick={() => onShape(id)} disabled={!v}>
              <span className="icon-tile icon-tile-letter">{id}</span>
              <span className="action-text">
                <span className="action-title mono">{v ? tabOf(v) : 'sem digitação'}</span>
                <span className="action-sub">
                  tônica na {SHAPE_ROOT_STRING[id]}ª
                  {v ? ` · casas ${v.window.from}–${v.window.to}` : ''}
                  {barre === null ? '' : ` · pestana ${barre}`}
                </span>
              </span>
              <ChevronRight size={16} strokeWidth={1.6} className="action-chevron" />
            </button>
          )
        })}
      </div>
      <p className="side-note">
        {QUALITIES[quality].name[0].toUpperCase() + QUALITIES[quality].name.slice(1)} em {nn(rootPc)}: o mesmo acorde em cinco lugares
        do braço. E e A, com pestana, são a receita que anda pelo braço inteiro.
      </p>
    </Panel>
  )
}

export const ChordInsights = memo(ChordInsightsView)

/* ── Notas ────────────────────────────────────────────────────────────── */

function NoteInsightsView({ pcs }: { pcs: number[] }) {
  if (pcs.length === 1) {
    const frets = fretsByString(pcs[0])
    return (
      <Panel title="Casas por corda" className="side side-right">
        <div className="actions">
          {frets
            .map((list, string) => ({ list, string }))
            .reverse()
            .map(({ list, string }) => (
              <div key={string} className="action action-static">
                <span className="icon-tile icon-tile-letter">{STRING_LABELS[string]}</span>
                <span className="action-text">
                  <span className="action-title">{list.join(' · ')}</span>
                  <span className="action-sub">{6 - string}ª corda</span>
                </span>
              </div>
            ))}
        </div>
      </Panel>
    )
  }

  /* Várias notas: onde cada uma mora nas duas cordas graves — é de lá que se
     acha tônica de pestana. */
  const ref = pcs[0]
  const ordered = [...pcs].sort((a, b) => ((a - ref + 12) % 12) - ((b - ref + 12) % 12))
  return (
    <Panel title="Nas cordas graves" className="side side-right">
      {pcs.length === 0 ? (
        <p className="side-note">Nenhuma nota escolhida.</p>
      ) : (
        <div className="table">
          <div className="table-row table-head">
            <span>nota</span>
            <span>6ª (E)</span>
            <span>5ª (A)</span>
          </div>
          {ordered.map((pc) => {
            const frets = fretsByString(pc)
            return (
              <div key={pc} className="table-row">
                <span>
                  <i className="pip-dot" style={{ background: pc === ref ? ROLE_COLOR.root : ROLE_COLOR.other }} />
                  {sharpNames(pc)}
                </span>
                <span>{frets[0].join(' · ')}</span>
                <span>{frets[1].join(' · ')}</span>
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

export const NoteInsights = memo(NoteInsightsView)
