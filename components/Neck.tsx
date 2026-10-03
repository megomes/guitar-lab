'use client'

/* A área do braço, igual em todas as telas: legenda, a barra de visão (notas,
 * graus, fora da forma) e o braço. */
import { memo, type ReactNode } from 'react'

import type { Voicing } from '@/lib/chords'
import type { LegendItem, Mark, NeckWindow, Pin, Shift } from '@/lib/marks'
import { ROLE_COLOR, ROLE_NAME, ROLES } from '@/lib/roles'

import { Fretboard, type LabelMode } from './Fretboard'
import { Legend, Segmented, Switch } from './ui'

export const ROLE_LEGEND: LegendItem[] = ROLES.map((role) => ({ kind: 'dot', color: ROLE_COLOR[role], text: ROLE_NAME[role] }))

const LABEL_OPTIONS: { value: LabelMode; label: string }[] = [
  { value: 'both', label: 'notas + graus' },
  { value: 'note', label: 'notas' },
  { value: 'degree', label: 'graus' },
]

interface Props {
  marks: Mark[]
  windows?: NeckWindow[]
  voicing?: Voicing | null
  rings?: Pin[]
  now?: Pin[]
  focus?: NeckWindow | null
  legend?: LegendItem[]
  labelMode: LabelMode
  showOutside: boolean
  /** O nome do interruptor: "fora da forma", "fora da posição". Sem ele, some. */
  outsideLabel?: string | null
  onLabelMode: (mode: LabelMode) => void
  onShowOutside: (show: boolean) => void
  size?: 'md' | 'lg'
  className?: string
  extra?: ReactNode
  /** Casas do braço; o padrão são 17. */
  frets?: number
  shifts?: Shift[]
}

function NeckView(props: Props) {
  const { legend = ROLE_LEGEND, labelMode, showOutside, outsideLabel = 'fora da forma', size = 'md' } = props
  return (
    <section className={`viewport${props.className ? ` ${props.className}` : ''}`} aria-label="braço da guitarra">
      <div className="viewport-bar">
        <Legend items={legend} />
        <div className="toolbar">
          {props.extra}
          <Segmented options={LABEL_OPTIONS} value={labelMode} onChange={props.onLabelMode} />
          {outsideLabel && <Switch label={outsideLabel} on={showOutside} onChange={() => props.onShowOutside(!showOutside)} />}
        </div>
      </div>
      <div className={size === 'lg' ? 'neck neck-lg' : 'neck'}>
        <Fretboard
          marks={props.marks}
          windows={props.windows}
          voicing={props.voicing}
          rings={props.rings}
          now={props.now}
          focus={props.focus}
          frets={props.frets}
          shifts={props.shifts}
          labelMode={labelMode}
          showOutside={showOutside || !outsideLabel}
        />
      </div>
    </section>
  )
}

export const Neck = memo(NeckView)
