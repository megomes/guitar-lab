'use client'

/* A barra da esquerda: o que decide o que o braço desenha. */
import { memo } from 'react'

import { QUALITIES, QUALITY_IDS, SHAPE_ROOT_STRING, type QualityId } from '@/lib/chords'
import { SCALES, SHAPE_IDS, type ShapeId } from '@/lib/fretboard'
import { ALL_PCS, NATURALS, togglePc } from '@/lib/notes'
import { sharpNames, tonicLabel } from '@/lib/spelling'

import { Chip, Group, Panel, type GroupAction } from '../ui'

export const qualityLabel = (id: QualityId) => (QUALITIES[id].symbol === '' ? 'maior' : QUALITIES[id].symbol)

/** As doze tônicas, cada uma escrita no tom dela: D♭ maior, C♯ menor. */
export function TonicGroup({ rootPc, minor, onRoot, label = 'Tônica' }: { rootPc: number; minor: boolean; onRoot: (pc: number) => void; label?: string }) {
  return (
    <Group label={label} grid={6}>
      {ALL_PCS.map((pc) => (
        <Chip key={pc} label={tonicLabel(pc, minor)} fixed on={rootPc === pc} onPress={() => onRoot(pc)} />
      ))}
    </Group>
  )
}

/* ── Escalas ──────────────────────────────────────────────────────────── */

interface ScaleSidebarProps {
  rootPc: number
  minor: boolean
  shape: ShapeId
  scaleId: string
  window: { from: number; to: number } | null
  onRoot: (pc: number) => void
  onShape: (shape: ShapeId) => void
  onScale: (id: string) => void
}

function ScaleSidebarView({ rootPc, minor, shape, scaleId, window, onRoot, onShape, onScale }: ScaleSidebarProps) {
  return (
    <Panel title="Escala" className="side side-left">
      <TonicGroup rootPc={rootPc} minor={minor} onRoot={onRoot} />

      <Group label="Forma CAGED" hint={window ? `casas ${window.from}–${window.to}` : undefined} grid={5}>
        {SHAPE_IDS.map((id) => (
          <Chip key={id} label={id} fixed on={shape === id} onPress={() => onShape(id)} />
        ))}
      </Group>

      <section className="group">
        <h3 className="group-label">Escala</h3>
        <div className="scale-list">
          {SCALES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`scale-row${scaleId === s.id ? ' scale-row-on' : ''}`}
              aria-pressed={scaleId === s.id}
              onClick={() => onScale(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      </section>
    </Panel>
  )
}

export const ScaleSidebar = memo(ScaleSidebarView)

/* ── Acordes ──────────────────────────────────────────────────────────── */

interface ChordSidebarProps {
  rootPc: number
  minor: boolean
  shape: ShapeId
  quality: QualityId
  onRoot: (pc: number) => void
  onShape: (shape: ShapeId) => void
  onQuality: (quality: QualityId) => void
}

function ChordSidebarView({ rootPc, minor, shape, quality, onRoot, onShape, onQuality }: ChordSidebarProps) {
  return (
    <Panel title="Acorde" className="side side-left">
      <TonicGroup rootPc={rootPc} minor={minor} onRoot={onRoot} />

      <Group label="Qualidade" grid={4}>
        {QUALITY_IDS.map((id) => (
          <Chip key={id} label={qualityLabel(id)} fixed on={quality === id} onPress={() => onQuality(id)} />
        ))}
      </Group>

      <Group label="Forma" hint="corda da tônica" grid={5}>
        {SHAPE_IDS.map((id) => (
          <Chip key={id} label={`${id} ${SHAPE_ROOT_STRING[id]}ª`} fixed on={shape === id} onPress={() => onShape(id)} />
        ))}
      </Group>
    </Panel>
  )
}

export const ChordSidebar = memo(ChordSidebarView)

/* ── Notas ────────────────────────────────────────────────────────────── */

const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x))

/* Cumulativo: cada toque acrescenta ou tira uma nota. Os atalhos só aparecem
   quando mudam alguma coisa. */
function NoteSidebarView({ pcs, onPcs }: { pcs: number[]; onPcs: (pcs: number[]) => void }) {
  const actions: GroupAction[] = []
  if (!sameSet(pcs, NATURALS)) actions.push({ label: 'naturais', onPress: () => onPcs(NATURALS) })
  if (pcs.length < 12) actions.push({ label: 'todas', onPress: () => onPcs(ALL_PCS) })
  if (pcs.length > 0) actions.push({ label: 'limpar', onPress: () => onPcs([]) })

  return (
    <Panel title="Notas" className="side side-left">
      <Group label="No braço" action={actions} grid={6}>
        {ALL_PCS.map((pc) => (
          <Chip key={pc} label={sharpNames(pc)} fixed on={pcs.includes(pc)} onPress={() => onPcs(togglePc(pcs, pc))} />
        ))}
      </Group>
      <p className="side-note">
        Cada toque acrescenta ou tira uma nota. A primeira escolhida é a referência dos graus — e a que acende em laranja.
      </p>
    </Panel>
  )
}

export const NoteSidebar = memo(NoteSidebarView)
