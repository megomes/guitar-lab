'use client'

/* O teclado, igual nas três telas do piano: as notas marcadas com a cor do papel
 * (a mesma do braço), a tecla tocada acesa e, no jogo, o verde e o vermelho do
 * veredito. Fluido: as teclas são porcentagens da largura. */
import { memo, useMemo, useRef } from 'react'

import { HIGH_NOTE, LOW_NOTE, keyGeometry, octaveOf } from '@/lib/piano'
import { sharpNames } from '@/lib/spelling'

export interface KeyMark {
  color: string
  /** Nome da nota e grau, escritos na tecla. */
  note?: string
  degree?: string
  /** Só o contorno: a dica, ou a nota que faltou. */
  ghost?: boolean
}

export type KeyTone = 'hit' | 'miss'

interface Props {
  marks?: Map<number, KeyMark>
  /** O que está soando agora (tocado, ou a escala andando). */
  lit?: Set<number>
  tones?: Map<number, KeyTone>
  onDown?: (midi: number) => void
  onUp?: (midi: number) => void
  /** O nome em cada tecla sem marca (o "Nome das notas" do jogo). */
  label?: (midi: number) => string
  lo?: number
  hi?: number
}

function KeyboardView({ marks, lit, tones, onDown, onUp, label, lo = LOW_NOTE, hi = HIGH_NOTE }: Props) {
  const keys = useMemo(() => keyGeometry(lo, hi), [lo, hi])
  /* O dedo que arrasta de uma tecla para outra solta a primeira. */
  const down = useRef(new Map<number, number>())

  const press = (pointer: number, midi: number) => {
    const prev = down.current.get(pointer)
    if (prev === midi) return
    if (prev !== undefined) onUp?.(prev)
    down.current.set(pointer, midi)
    onDown?.(midi)
  }
  const release = (pointer: number) => {
    const prev = down.current.get(pointer)
    if (prev === undefined) return
    down.current.delete(pointer)
    onUp?.(prev)
  }

  return (
    <div className="kb" role="group" aria-label="teclado" onPointerLeave={(e) => release(e.pointerId)}>
      {[false, true].map((black) =>
        keys
          .filter((k) => k.black === black)
          .map((k) => {
            const mark = marks?.get(k.midi)
            const tone = tones?.get(k.midi)
            const on = lit?.has(k.midi)
            const cls = `kb-key ${black ? 'kb-black' : 'kb-white'}${mark ? (mark.ghost ? ' kb-ghost' : ' kb-marked') : ''}${on ? ' kb-on' : ''}${tone ? ` kb-${tone}` : ''}`
            return (
              <button
                key={k.midi}
                type="button"
                className={cls}
                style={{ left: `${k.left}%`, width: `${k.width}%`, ['--mk' as string]: mark?.color }}
                aria-label={`${mark?.note ?? sharpNames(k.midi)}${octaveOf(k.midi)}`}
                onPointerDown={(e) => {
                  e.currentTarget.releasePointerCapture?.(e.pointerId)
                  press(e.pointerId, k.midi)
                }}
                onPointerEnter={(e) => {
                  if (down.current.has(e.pointerId)) press(e.pointerId, k.midi)
                }}
                onPointerUp={(e) => release(e.pointerId)}
                onPointerCancel={(e) => release(e.pointerId)}
                onContextMenu={(e) => e.preventDefault()}
              >
                {mark && (
                  <span className="kb-mark">
                    {mark.degree && <small>{mark.degree}</small>}
                    {mark.note && <b>{mark.note}</b>}
                    <i />
                  </span>
                )}
                {!mark && label && <span className="kb-oct kb-label">{k.midi % 12 === 0 ? `C${octaveOf(k.midi)}` : label(k.midi)}</span>}
                {!mark && !label && !black && k.midi % 12 === 0 && <span className="kb-oct">C{octaveOf(k.midi)}</span>}
              </button>
            )
          }),
      )}
    </div>
  )
}

export const Keyboard = memo(KeyboardView)
