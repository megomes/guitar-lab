'use client'

/* As peças que toda tela usa: chip, segmentado, interruptor, legenda e o
 * diálogo do "Como funciona". */
import { Check, X } from 'lucide-react'
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

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <div className="legend" aria-label="legenda">
      {items.map((it, i) => (
        <span key={`${it.kind}-${it.text}-${i}`} className={`legend-item${it.kind === 'chord' ? ' legend-chord' : ''}`} style={it.kind === 'chord' ? { borderColor: it.color, color: it.color } : undefined}>
          {it.kind === 'dot' && <i style={{ background: it.color, boxShadow: `0 0 8px ${it.color}` }} />}
          {it.kind === 'ghost' && <i className="lg-ghost" />}
          {it.kind === 'ring' && <i className="lg-ring" />}
          {it.kind === 'windows' && <i className="lg-win" />}
          {it.kind === 'outline' && <i className="lg-outline" />}
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
  /** Lembretes soltos, fora da ordem dos passos. */
  notes?: string[]
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
          {content.notes && (
            <ul className="dlg-notes">
              {content.notes.map((n) => (
                <li key={n}>
                  <Check size={14} strokeWidth={2} />
                  {n}
                </li>
              ))}
            </ul>
          )}
          {content.src && <div className="src" dangerouslySetInnerHTML={{ __html: `Fonte da ideia: ${content.src}` }} />}
        </div>
      )}
    </dialog>
  )
}
