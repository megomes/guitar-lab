'use client'

/* A faixa de controles da consulta: o que decide o que o braço desenha, em
 * grupos lado a lado — rótulo curto e as opções na mesma linha. */
import { memo, type ReactNode } from 'react'

import { QUALITIES, QUALITY_IDS, SHAPE_ROOT_STRING, type QualityId } from '@/lib/chords'
import { SCALES, SHAPE_IDS, type ShapeId } from '@/lib/fretboard'
import { ALL_PCS, NATURALS, togglePc } from '@/lib/notes'
import { sharpNames, tonicLabel } from '@/lib/spelling'

import { Chip } from '../ui'

const qualityLabel = (id: QualityId) => (QUALITIES[id].symbol === '' ? 'maior' : QUALITIES[id].symbol)

export function CGroup({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="cgroup">
      <span className="cgroup-label">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <div className="chips">{children}</div>
    </div>
  )
}

/** As doze tônicas, cada uma escrita no tom dela: D♭ maior, C♯ menor. */
function Tonics({ rootPc, minor, onRoot }: { rootPc: number; minor: boolean; onRoot: (pc: number) => void }) {
  return (
    <CGroup label="Tônica">
      {ALL_PCS.map((pc) => (
        <Chip key={pc} label={tonicLabel(pc, minor)} fixed on={rootPc === pc} onPress={() => onRoot(pc)} />
      ))}
    </CGroup>
  )
}

/* ── Escalas ──────────────────────────────────────────────────────────── */

interface ScaleControlsProps {
  rootPc: number
  minor: boolean
  shape: ShapeId
  scaleId: string
  window: { from: number; to: number } | null
  onRoot: (pc: number) => void
  onShape: (shape: ShapeId) => void
  onScale: (id: string) => void
}

function ScaleControlsView({ rootPc, minor, shape, scaleId, window, onRoot, onShape, onScale }: ScaleControlsProps) {
  return (
    <>
      <Tonics rootPc={rootPc} minor={minor} onRoot={onRoot} />
      <CGroup label="Forma" hint={window ? `casas ${window.from}–${window.to}` : undefined}>
        {SHAPE_IDS.map((id) => (
          <Chip key={id} label={id} fixed on={shape === id} onPress={() => onShape(id)} />
        ))}
      </CGroup>
      <label className="select">
        Escala
        <select value={scaleId} onChange={(e) => onScale(e.target.value)}>
          {SCALES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
    </>
  )
}

export const ScaleControls = memo(ScaleControlsView)

/* ── Acordes ──────────────────────────────────────────────────────────── */

interface ChordControlsProps {
  rootPc: number
  minor: boolean
  shape: ShapeId
  quality: QualityId
  onRoot: (pc: number) => void
  onShape: (shape: ShapeId) => void
  onQuality: (quality: QualityId) => void
}

function ChordControlsView({ rootPc, minor, shape, quality, onRoot, onShape, onQuality }: ChordControlsProps) {
  return (
    <>
      <Tonics rootPc={rootPc} minor={minor} onRoot={onRoot} />
      <CGroup label="Forma" hint="corda da tônica">
        {SHAPE_IDS.map((id) => (
          <Chip key={id} label={`${id} ${SHAPE_ROOT_STRING[id]}ª`} fixed on={shape === id} onPress={() => onShape(id)} />
        ))}
      </CGroup>
      <CGroup label="Qualidade">
        {QUALITY_IDS.map((id) => (
          <Chip key={id} label={qualityLabel(id)} fixed on={quality === id} onPress={() => onQuality(id)} />
        ))}
      </CGroup>
    </>
  )
}

export const ChordControls = memo(ChordControlsView)

/* ── Notas ────────────────────────────────────────────────────────────── */

const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x))

/* Cumulativo: cada toque acrescenta ou tira uma nota; a primeira é a referência dos
   graus. Os atalhos só aparecem quando mudam alguma coisa. */
function NoteControlsView({ pcs, onPcs }: { pcs: number[]; onPcs: (pcs: number[]) => void }) {
  return (
    <>
      <CGroup label="Notas" hint="a 1ª é a referência">
        {ALL_PCS.map((pc) => (
          <Chip key={pc} label={sharpNames(pc)} fixed on={pcs.includes(pc)} onPress={() => onPcs(togglePc(pcs, pc))} />
        ))}
      </CGroup>
      <div className="chips">
        {!sameSet(pcs, NATURALS) && <Chip label="naturais" onPress={() => onPcs(NATURALS)} />}
        {pcs.length < 12 && <Chip label="todas" onPress={() => onPcs(ALL_PCS)} />}
        {pcs.length > 0 && <Chip label="limpar" onPress={() => onPcs([])} />}
      </div>
    </>
  )
}

export const NoteControls = memo(NoteControlsView)
