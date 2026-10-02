'use client'

/* As peças que toda tela usa: chip, grupo, segmentado, interruptor, métrica,
 * painel, selo, legenda e o diálogo do "Como funciona". */
import { X } from 'lucide-react'
import { memo, useEffect, useRef, type ReactNode } from 'react'

import type { LegendItem } from '@/lib/marks'

interface ChipProps {
  label: ReactNode
  on?: boolean
  onPress: () => void
  /** Largura igual para todos, quando estão numa grade. */
  fixed?: boolean
  /** Ponto de cor à esquerda do texto. */
  dot?: string
  strong?: boolean
}

function ChipView({ label, on = false, onPress, fixed = false, dot, strong = false }: ChipProps) {
  return (
    <button
      type="button"
      className={`chip${fixed ? ' chip-fixed' : ''}${on ? ' chip-on' : ''}${strong ? ' chip-strong' : ''}`}
      aria-pressed={on}
      onClick={onPress}
    >
      {dot && <i className="chip-dot" style={{ background: dot }} />}
      {label}
    </button>
  )
}

export const Chip = memo(ChipView)

export interface GroupAction {
  label: string
  onPress: () => void
}

/** Um grupo de controles com rótulo em cima e, se fizer sentido, ações. */
export function Group({
  label,
  hint,
  action,
  children,
  grid,
}: {
  label: string
  hint?: string
  action?: GroupAction | GroupAction[]
  children: ReactNode
  grid?: number
}) {
  const actions = action === undefined ? [] : Array.isArray(action) ? action : [action]
  return (
    <section className="group">
      <div className="group-head">
        <h3 className="group-label">
          {label}
          {hint && <span className="group-hint">{hint}</span>}
        </h3>
        {actions.length > 0 && (
          <div className="group-actions">
            {actions.map((a) => (
              <button key={a.label} type="button" className="group-action" onClick={a.onPress}>
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={grid ? 'chips chips-grid' : 'chips'} style={grid ? { gridTemplateColumns: `repeat(${grid}, 1fr)` } : undefined}>
        {children}
      </div>
    </section>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: ReactNode }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={`segment${o.value === value ? ' segment-on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Switch({ label, on, onChange }: { label: string; on: boolean; onChange: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={`switch${on ? ' switch-on' : ''}`} onClick={onChange}>
      <span className="switch-label">{label}</span>
      <span className="switch-track">
        <span className="switch-thumb" />
      </span>
    </button>
  )
}

export function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="metric">
      <span className="icon-tile">{icon}</span>
      <span className="metric-text">
        <span className="metric-label">{label}</span>
        <span className="metric-value">{value}</span>
      </span>
    </div>
  )
}

export function Panel({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`panel${className ? ` ${className}` : ''}`}>
      {title && <h2 className="panel-title">{title}</h2>}
      {children}
    </section>
  )
}

/** O selo de cima de cada tela: ponto laranja, grupo e o que está em uso. */
export function Eyebrow({ group, children }: { group: string; children?: ReactNode }) {
  return (
    <span className="eyebrow">
      <i />
      <b>{group}</b>
      {children && <span className="eyebrow-ctx">{children}</span>}
    </span>
  )
}

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <div className="legend" aria-label="legenda">
      {items.map((it, i) => (
        <span key={`${it.kind}-${it.text}-${i}`} className={`legend-item${it.kind === 'chord' ? ' legend-chord' : ''}`} style={it.kind === 'chord' ? { borderColor: it.color, color: it.color } : undefined}>
          {it.kind === 'dot' && <i style={{ background: it.color, boxShadow: `0 0 8px ${it.color}` }} />}
          {it.kind === 'ghost' && <i className="lg-ghost" />}
          {it.kind === 'ring' && <i className="lg-ring" />}
          {it.kind === 'windows' && <i className="lg-win" />}
          {it.text}
        </span>
      ))}
    </div>
  )
}

export interface HowContent {
  title: string
  /** HTML curto escrito pelo próprio app (negrito e aviso). */
  how: string
  steps: string[]
  src?: string
}

/** O "Como funciona": o porquê, os passos e de onde veio a ideia. */
export function HowDialog({ content, onClose }: { content: HowContent | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (content && !d.open) d.showModal()
    if (!content && d.open) d.close()
  }, [content])

  return (
    <dialog
      ref={ref}
      className="dlg"
      aria-labelledby="dlg-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      {content && (
        <div className="dlg-in">
          <div className="dlg-h">
            <h3 id="dlg-title">{content.title}</h3>
            <button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose}>
              <X size={16} strokeWidth={1.8} />
            </button>
          </div>
          {content.how && <p dangerouslySetInnerHTML={{ __html: content.how }} />}
          <ol>
            {content.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {content.src && <div className="src" dangerouslySetInnerHTML={{ __html: `Fonte da ideia: ${content.src}` }} />}
        </div>
      )}
    </dialog>
  )
}
