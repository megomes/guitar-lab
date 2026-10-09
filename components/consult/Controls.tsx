'use client'

/* A faixa de controles da consulta: o que decide o que o braço desenha, em
 * grupos lado a lado — rótulo curto e as opções na mesma linha. */
import { memo, type ReactNode } from 'react'

import { QUALITIES, QUALITY_IDS, SHAPE_ROOT_STRING, type QualityId } from '@/lib/chords'
import { GUITAR_SCALES, SCALES, SCALE_BY_ID, SHAPE_IDS, scaleDelta, type ShapeId } from '@/lib/fretboard'
import { ALL_PCS, NATURALS, togglePc } from '@/lib/notes'
import type { ChordView } from '@/lib/settings'
import { sharpNames, tonicLabel } from '@/lib/spelling'
import { STRING_SETS, hasTriad, setLabel } from '@/lib/triads'

import { Chip, Segmented } from '../ui'

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
export function Tonics({ rootPc, minor, onRoot }: { rootPc: number; minor: boolean; onRoot: (pc: number) => void }) {
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
  window: { from: number; to: number } | null
  onRoot: (pc: number) => void
  onShape: (shape: ShapeId) => void
}

function ScaleControlsView({ rootPc, minor, shape, window, onRoot, onShape }: ScaleControlsProps) {
  return (
    <>
      <Tonics rootPc={rootPc} minor={minor} onRoot={onRoot} />
      <CGroup label="Forma" hint={window ? `casas ${window.from}–${window.to}` : undefined}>
        {SHAPE_IDS.map((id) => (
          <Chip key={id} label={id} fixed on={shape === id} onPress={() => onShape(id)} />
        ))}
      </CGroup>
    </>
  )
}

export const ScaleControls = memo(ScaleControlsView)

/* A relativa: as mesmas notas lidas de outra tônica — três semitons abaixo no maior, acima no menor. */
const RELATIVE: Record<string, { id: string; by: number }> = {
  major: { id: 'minor', by: 9 },
  minor: { id: 'major', by: 3 },
  pentaMajor: { id: 'pentaMinor', by: 9 },
  pentaMinor: { id: 'pentaMajor', by: 3 },
}

/**
 * As cinco escalas numa linha de botões. Embaixo de cada uma, o que muda em relação à que
 * está acesa — '−2 −♭6' da menor para a penta menor, '+♭5' para o blues —, e no fim a
 * relativa, que tem as mesmas notas a partir de outra tônica.
 */
function ScaleBarView({ rootPc, scaleId, onScale, onRelative }: { rootPc: number; scaleId: string; onScale: (id: string) => void; onRelative: (rootPc: number, scaleId: string) => void }) {
  const cur = SCALE_BY_ID.get(scaleId) ?? SCALES[0]
  const rel = RELATIVE[scaleId]
  const relPc = rel ? (rootPc + rel.by) % 12 : 0
  const relMinor = rel?.id === 'minor' || rel?.id === 'pentaMinor'
  return (
    <div className="scale-bar" role="radiogroup" aria-label="escala">
      <span className="cgroup-label">
        Escala
        <small>o que muda</small>
      </span>
      {GUITAR_SCALES.map((s) => {
        const on = s.id === scaleId
        const delta = on ? [] : scaleDelta(cur, SCALE_BY_ID.get(s.id)!)
        return (
          <button key={s.id} type="button" role="radio" aria-checked={on} className={`scale-btn${on ? ' scale-btn-on' : ''}`} onClick={() => onScale(s.id)}>
            {s.label}
            <small>{on ? `${cur.intervals.length} notas` : delta.join(' ')}</small>
          </button>
        )
      })}
      {rel ? (
        <button type="button" className="scale-rel" onClick={() => onRelative(relPc, rel.id)} title="as mesmas notas, a partir de outra tônica">
          <small>relativa</small>
          {tonicLabel(relPc, relMinor)} {GUITAR_SCALES.find((g) => g.id === rel.id)!.label.toLowerCase()}
        </button>
      ) : (
        /* O blues não tem relativa entre as cinco: o lugar fica guardado, para nada andar. */
        <span className="scale-rel" aria-hidden style={{ visibility: 'hidden' }}>
          <small>relativa</small>–
        </span>
      )}
    </div>
  )
}

export const ScaleBar = memo(ScaleBarView)

/* ── Acordes ──────────────────────────────────────────────────────────── */

interface ChordControlsProps {
  rootPc: number
  minor: boolean
  shape: ShapeId
  quality: QualityId
  view: ChordView
  triadSet: number
  onRoot: (pc: number) => void
  onShape: (shape: ShapeId) => void
  onQuality: (quality: QualityId) => void
  onView: (view: ChordView) => void
  onTriadSet: (set: number) => void
}

function ChordControlsView({ rootPc, minor, shape, quality, view, triadSet, onRoot, onShape, onQuality, onView, onTriadSet }: ChordControlsProps) {
  const triads = view === 'triads' && hasTriad(quality)
  return (
    <>
      <Tonics rootPc={rootPc} minor={minor} onRoot={onRoot} />
      {hasTriad(quality) && (
        <Segmented<ChordView>
          options={[
            { value: 'caged', label: 'forma CAGED' },
            { value: 'triads', label: 'tríades' },
          ]}
          value={view}
          onChange={onView}
        />
      )}
      {triads ? (
        <CGroup label="Cordas" hint="uma nota em cada">
          {STRING_SETS.map((set, i) => (
            <Chip key={i} label={setLabel(set)} fixed on={triadSet === i} onPress={() => onTriadSet(i)} />
          ))}
        </CGroup>
      ) : (
        <CGroup label="Forma" hint="corda da tônica">
          {SHAPE_IDS.map((id) => (
            <Chip key={id} label={`${id} ${SHAPE_ROOT_STRING[id]}ª`} fixed on={shape === id} onPress={() => onShape(id)} />
          ))}
        </CGroup>
      )}
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
