'use client'

/* A tablatura do exercício, do CAGED Lab.
 *
 * Compassos lado a lado enquanto couberem, quebrando em linhas iguais. Colcheias
 * que só caem nos tempos viram semínimas largas, para ler de longe. A nota que
 * está soando acende — é ela que diz onde o olho tem que estar.
 */
import { memo, useLayoutEffect, useRef, useState } from 'react'

import { STRING_LABELS } from '@/lib/fretboard'
import type { Bar } from '@/lib/practice/session'

interface Props {
  bars: Bar[]
  cols: number
  /** "compasso:coluna" do que está soando. */
  now: string | null
}

const LBL = 16

function TabView({ bars, cols, now }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [avail, setAvail] = useState(900)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setAvail(Math.max(240, el.clientWidth - 20))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const used = bars.flatMap((b) => b.events.map((e) => e.col))
  let res = cols
  let map = (c: number) => c
  if (cols === 8 && used.every((c) => c % 2 === 0)) {
    res = 4
    map = (c) => c / 2
  }
  const minCw = res === 12 ? 15 : 17
  const maxCw = res === 4 ? 46 : 32
  let per = Math.min(bars.length, 4)
  while (per > 1 && per * (res * minCw + 2) + LBL + 20 > avail) per--
  const rows = Math.ceil(bars.length / per)
  per = Math.ceil(bars.length / rows)
  const cw = Math.max(minCw, Math.min(maxCw, Math.floor((avail - LBL - 20 - per * 2) / (per * res))))

  const beats = Array.from({ length: res }, (_, c) => {
    if (res === 4) return { cls: 'b1', t: String(c + 1) }
    if (res === 8) return { cls: c % 2 === 0 ? 'b1' : '', t: c % 2 === 0 ? String(c / 2 + 1) : '&' }
    return { cls: c % 3 === 0 ? 'b1' : '', t: c % 3 === 0 ? String(c / 3 + 1) : '' }
  })

  const lines: number[] = []
  for (let i = 0; i < bars.length; i += per) lines.push(i)

  return (
    <div className="tabwrap" ref={ref}>
      {lines.map((start) => (
        <div key={start} className="tab" style={{ ['--cols' as string]: res, ['--cw' as string]: `${cw}px` }}>
          <div className="tab-lbl">
            <div />
            {[5, 4, 3, 2, 1, 0].map((s) => (
              <div key={s}>{STRING_LABELS[s]}</div>
            ))}
            <div />
          </div>
          {bars.slice(start, start + per).map((b, j) => {
            const bi = start + j
            return (
              <div key={bi} className="bar">
                <div className="bar-head">
                  {b.head?.dot && <span className="dot" style={{ background: b.head.dot }} />}
                  {b.head?.text}
                  {b.head?.sub && <small>{b.head.sub}</small>}
                </div>
                <div className="bar-grid">
                  {[0, 1, 2, 3, 4, 5].flatMap((r) => {
                    const s = 5 - r
                    return Array.from({ length: res }, (_, c) => {
                      const ev = b.events.find((e) => map(e.col) === c)
                      const n = ev?.notes.find((x) => x.s === s)
                      const key = ev ? `${bi}:${ev.col}` : ''
                      return (
                        <div key={`${r}-${c}`} className="cell">
                          {n && (
                            <span
                              className={`fn${n.role === 'pass' ? ' fn-pass' : ''}${n.role === 'target' ? ' fn-target' : ''}${key === now ? ' fn-now' : ''}`}
                              style={n.color ? { ['--c' as string]: n.color } : undefined}
                            >
                              {n.f}
                            </span>
                          )}
                        </div>
                      )
                    })
                  })}
                </div>
                <div className="beats">
                  {beats.map((x, i) => (
                    <span key={i} className={x.cls}>
                      {x.t}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export const Tab = memo(TabView)
