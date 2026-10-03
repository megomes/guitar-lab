'use client'

/* O braço, visto de cima, em SVG — o mesmo nas seis telas.
 *
 * Do Fretlab vem o desenho: escala escura, trastes e cordas de metal com volume,
 * e as notas como esferas de vidro que brilham na cor do papel delas. Do CAGED
 * Lab vêm as intensidades (acesa, discreta, fantasma), o anel da nota-alvo, as
 * cinco posições lado a lado e a nota que está soando, acesa enquanto toca.
 *
 * Convenção de tablatura: 1ª corda (mi agudo) em cima, 6ª embaixo.
 */
import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'

import type { Voicing } from '@/lib/chords'
import { DOUBLE_INLAYS, FRET_COUNT, INLAYS, STRING_LABELS } from '@/lib/fretboard'
import type { Mark, NeckWindow, Pin } from '@/lib/marks'
import { ROLE_COLOR, mix, roleOf } from '@/lib/roles'
import type { LabelMode } from '@/lib/settings'

import { useNames } from './names'

/** O que vai escrito em cada casa. `both` é a nota dentro da esfera e o grau num
 *  selo pequeno no canto — as duas leituras sem trocar de visão. */
export type { LabelMode }

interface Props {
  marks: Mark[]
  /** Vãos acesos: a forma, a posição, ou as cinco posições com rótulo. */
  windows?: NeckWindow[]
  /** Desenha também as notas fantasma (fora da forma, fora da posição). Com uma
   *  digitação por cima elas ficam sempre: são o arpejo que ela recorta. */
  showOutside: boolean
  /** A digitação de um acorde, desenhada por cima. */
  voicing?: Voicing | null
  /** Anéis brancos: a nota-alvo do exercício. */
  rings?: Pin[]
  /** O que está soando agora. */
  now?: Pin[]
  labelMode: LabelMode
  /** Para onde rolar no celular; sem isso, a digitação ou o primeiro vão. */
  focus?: NeckWindow | null
  /** Quantas casas desenhar. */
  frets?: number
}

/* ── Medidas ─────────────────────────────────────────────────────────── */

const OPEN_WIDTH = 84
const NUT_WIDTH = 8
const PAD_RIGHT = 10
const NUMBER_ROW = 26
const STRING_WEIGHT = [3.6, 3.1, 2.6, 2.1, 1.7, 1.35]

/**
 * Espaçamento entre trastes: metade da compressão de um braço real, que com
 * dezessete casas espremeria as agudas a ponto de não caber o rótulo.
 */
function fretOffsets(count: number): number[] {
  const widths = Array.from({ length: count }, (_, i) => Math.pow(2, -i / 24))
  const total = widths.reduce((a, b) => a + b, 0)
  const offsets = [0]
  let acc = 0
  for (const w of widths) {
    acc += w / total
    offsets.push(acc)
  }
  return offsets
}

const gradientKey = (hex: string) => hex.replace('#', '').toLowerCase()

interface Hover {
  x: number
  y: number
  note: string
  degree: string
  color: string
  string: number
  fret: number
}

function FretboardView({
  marks,
  windows = [],
  showOutside,
  voicing = null,
  rings = [],
  now = [],
  labelMode,
  focus,
  frets: fretCount = FRET_COUNT,
}: Props) {
  const OFFSETS = useMemo(() => fretOffsets(fretCount), [fretCount])
  const names = useNames()
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const id = (name: string) => `${uid}-${name}`
  const scroller = useRef<HTMLDivElement>(null)
  const board = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [hover, setHover] = useState<Hover | null>(null)
  const settled = useRef(false)

  useLayoutEffect(() => {
    const el = board.current
    if (!el) return
    const measure = () => {
      const { width, height } = el.getBoundingClientRect()
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const labeled = windows.some((w) => w.label)
  const padTop = labeled ? 34 : 12
  const { width, height } = size
  const boardLeft = OPEN_WIDTH + NUT_WIDTH
  const boardRight = width - PAD_RIGHT
  /* Num espaço alto (tablet em pé) as cordas não se afastam além da conta: o braço
     fica com a altura de um braço e centrado, em vez de esticar. */
  const rowHeight = Math.min((height - NUMBER_ROW - padTop) / 6, 66)
  const boardTop = padTop + Math.max(0, (height - NUMBER_ROW - padTop - rowHeight * 6) / 2)
  const boardBottom = boardTop + rowHeight * 6
  /* A esfera também respeita a casa mais estreita, para não encostar na vizinha. */
  const narrowest = (OFFSETS[fretCount] - OFFSETS[fretCount - 1]) * Math.max(0, width - PAD_RIGHT - OPEN_WIDTH - NUT_WIDTH)
  const radius = Math.max(10, Math.min(17, rowHeight * 0.34, narrowest * 0.46))

  const fretX = (n: number) => boardLeft + OFFSETS[n] * (boardRight - boardLeft)
  const slotX = (n: number) => (n === 0 ? OPEN_WIDTH - radius - 10 : (fretX(n - 1) + fretX(n)) / 2)
  const stringY = (s: number) => boardTop + (5 - s) * rowHeight + rowHeight / 2

  /* No celular o braço não cabe e rola de lado: trocar de forma leva a rolagem até lá. */
  const target = focus === undefined ? (voicing?.window ?? windows[0] ?? null) : focus
  useEffect(() => {
    const el = scroller.current
    if (!el || width <= 0 || el.scrollWidth <= el.clientWidth) return
    // Na primeira vez pula direto: rolagem suave logo na abertura às vezes é
    // interrompida pelo próprio carregamento e o braço fica no começo.
    const still = !settled.current || globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
    settled.current = true
    if (!target) {
      el.scrollTo({ left: 0, behavior: still ? 'auto' : 'smooth' })
      return
    }
    const from = target.from <= 0 ? 0 : fretX(target.from - 1)
    const to = fretX(Math.min(fretCount, target.to))
    el.scrollTo({ left: (from + to) / 2 - el.clientWidth / 2, behavior: still ? 'auto' : 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.from, target?.to, width])

  const muted = new Set(voicing?.muted ?? [])
  const visible = (showOutside || voicing ? marks : marks.filter((m) => m.level !== 'ghost')).filter((m) => !(m.fret === 0 && muted.has(m.string)))

  const colorOf = (m: { degree: string; color?: string }) => m.color ?? ROLE_COLOR[roleOf(m.degree)]

  /* Um gradiente de esfera por cor em uso: os papéis e as cores dos exercícios. */
  const ballColors = useMemo(() => {
    const set = new Set<string>(Object.values(ROLE_COLOR))
    for (const m of marks) if (m.color) set.add(m.color)
    return [...set]
  }, [marks])

  const geometry = useMemo(() => {
    if (width <= 0) return null
    const frets = Array.from({ length: fretCount }, (_, i) => i + 1)
    return (
      <g>
        <rect x={boardLeft - 2} y={boardTop} width={boardRight - boardLeft + 2} height={boardBottom - boardTop} rx={14} fill={`url(#${id('wood')})`} stroke="rgba(255,255,255,0.07)" />
        <rect x={boardLeft - 2} y={boardTop} width={boardRight - boardLeft + 2} height={boardBottom - boardTop} rx={14} fill={`url(#${id('sheen')})`} />

        {INLAYS.filter((n) => n <= fretCount).map((n) =>
          (DOUBLE_INLAYS.includes(n) ? [1.5, 4.5] : [3]).map((row) => (
            <circle key={`inlay-${n}-${row}`} cx={slotX(n)} cy={boardTop + rowHeight * row} r={5.5} fill={`url(#${id('pearl')})`} />
          )),
        )}

        {frets.map((n) => (
          <g key={`fret-${n}`}>
            <rect x={fretX(n) + 1.5} y={boardTop + 1} width={3} height={boardBottom - boardTop - 2} fill="rgba(0,0,0,0.45)" />
            <rect x={fretX(n) - 1.5} y={boardTop + 1} width={3} height={boardBottom - boardTop - 2} rx={1.5} fill={`url(#${id('fret')})`} />
          </g>
        ))}

        <rect x={OPEN_WIDTH} y={boardTop - 2} width={NUT_WIDTH} height={boardBottom - boardTop + 4} rx={3} fill={`url(#${id('nut')})`} />

        <g mask={`url(#${id('fade')})`}>
          {STRING_WEIGHT.map((w, s) => (
            <rect key={`shadow-${s}`} x={0} y={stringY(s) + w * 0.9} width={boardRight} height={w} fill="rgba(0,0,0,0.55)" filter={`url(#${id('soft')})`} />
          ))}
          {STRING_WEIGHT.map((w, s) => (
            <g key={`string-${s}`}>
              <rect x={0} y={stringY(s) - w / 2} width={boardRight} height={w} rx={w / 2} fill={`url(#${id(s < 3 ? 'wound' : 'plain')})`} />
              {s < 3 && <rect x={0} y={stringY(s) - w / 2} width={boardRight} height={w} fill={`url(#${id('coil')})`} />}
            </g>
          ))}
        </g>

        {STRING_LABELS.map((name, s) => (
          <text key={`label-${s}`} x={10} y={stringY(s)} className="fb-string-label">
            {name}
          </text>
        ))}
      </g>
    )
    // Tudo aqui dentro sai das dimensões.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, uid, padTop, fretCount])

  const inWindow = (n: number) => windows.some((w) => n >= w.from && n <= w.to)
  const bandX = (w: NeckWindow) => (w.from <= 0 ? slotX(0) - radius - 8 : fretX(w.from - 1))
  const bandRight = (w: NeckWindow) => fretX(Math.min(fretCount, Math.max(1, w.to)))

  const hoverOn = (x: number, y: number, m: { pc: number; degree: string; string: number; fret: number; color?: string }) => () =>
    setHover({ x, y, note: names(m.pc), degree: m.degree, color: colorOf(m), string: m.string, fret: m.fret })

  return (
    <div className="fb-scroll" ref={scroller}>
      <div
        className="fb-board"
        ref={board}
        style={fretCount === FRET_COUNT ? undefined : { ['--fb-scale' as string]: fretCount / FRET_COUNT }}
        onMouseLeave={() => setHover(null)}
      >
        {width > 0 && (
          <svg width={width} height={height} className="fb-svg" role="img" aria-label="braço da guitarra">
            <defs>
              <linearGradient id={id('wood')} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#18171a" />
                <stop offset="1" stopColor="#0c0b0d" />
              </linearGradient>
              <linearGradient id={id('sheen')} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="rgba(255,255,255,0.05)" />
                <stop offset="0.35" stopColor="rgba(255,255,255,0)" />
                <stop offset="0.7" stopColor="rgba(255,255,255,0.025)" />
                <stop offset="1" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
              <radialGradient id={id('pearl')} cx="0.35" cy="0.35" r="0.8">
                <stop offset="0" stopColor="rgba(255,255,255,0.32)" />
                <stop offset="1" stopColor="rgba(255,255,255,0.08)" />
              </radialGradient>
              <linearGradient id={id('fret')} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#5d626a" />
                <stop offset="0.45" stopColor="#f4f6f9" />
                <stop offset="1" stopColor="#6c717a" />
              </linearGradient>
              <linearGradient id={id('nut')} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#bdb7ab" />
                <stop offset="0.4" stopColor="#f5f2ea" />
                <stop offset="1" stopColor="#a9a397" />
              </linearGradient>
              <linearGradient id={id('plain')} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ffffff" />
                <stop offset="0.5" stopColor="#d4d8de" />
                <stop offset="1" stopColor="#7d838c" />
              </linearGradient>
              <linearGradient id={id('wound')} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fbf6ec" />
                <stop offset="0.5" stopColor="#cfc6b6" />
                <stop offset="1" stopColor="#7a7263" />
              </linearGradient>
              <pattern id={id('coil')} width="2.4" height="8" patternUnits="userSpaceOnUse" patternTransform="skewX(-28)">
                <rect width="0.9" height="8" fill="rgba(0,0,0,0.32)" />
              </pattern>
              <linearGradient id={id('fade-h')} gradientUnits="userSpaceOnUse" x1={24} y1={0} x2={OPEN_WIDTH - 6} y2={0}>
                <stop offset="0" stopColor="#000" />
                <stop offset="1" stopColor="#fff" />
              </linearGradient>
              <mask id={id('fade')} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
                <rect x={0} y={0} width={width} height={height} fill={`url(#${id('fade-h')})`} />
              </mask>
              <filter id={id('soft')} x="-5%" y="-200%" width="110%" height="500%">
                <feGaussianBlur stdDeviation="1.4" />
              </filter>
              <filter id={id('glow')} x="-150%" y="-150%" width="400%" height="400%">
                <feGaussianBlur stdDeviation="6" />
              </filter>
              <linearGradient id={id('band')} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="rgba(255,91,36,0.13)" />
                <stop offset="0.5" stopColor="rgba(255,91,36,0.04)" />
                <stop offset="1" stopColor="rgba(255,91,36,0.13)" />
              </linearGradient>
              {ballColors.map((c) => (
                <radialGradient key={c} id={id(`ball-${gradientKey(c)}`)} cx="0.36" cy="0.32" r="0.78">
                  <stop offset="0" stopColor={mix(c, '#ffffff', 0.72)} />
                  <stop offset="0.5" stopColor={c} />
                  <stop offset="1" stopColor={mix(c, '#000000', 0.38)} />
                </radialGradient>
              ))}
            </defs>

            {geometry}

            {/* Números das casas: os do vão aceso em laranja. */}
            {Array.from({ length: fretCount }, (_, i) => i + 1).map((n) => (
              <text key={`num-${n}`} x={slotX(n)} y={boardBottom + NUMBER_ROW / 2 + 2} className={`fb-fret-number${inWindow(n) ? ' fb-fret-number-on' : ''}`}>
                {n}
              </text>
            ))}

            {/* Um vão: faixa de luz. Vários: contornos tracejados com o nome da posição. */}
            {windows.length === 1 && (
              <rect
                className="fb-band"
                x={bandX(windows[0])}
                y={boardTop - 4}
                width={bandRight(windows[0]) - bandX(windows[0])}
                height={boardBottom - boardTop + 8}
                rx={10}
                fill={`url(#${id('band')})`}
                stroke="rgba(255,122,69,0.6)"
                strokeWidth={1.2}
              />
            )}
            {windows.length > 1 &&
              windows.map((w, i) => {
                const x = bandX(w)
                const r = bandRight(w)
                const lift = i % 2 ? 0 : 6
                return (
                  <g key={`win-${i}`}>
                    <rect
                      x={x + 1}
                      y={boardTop - 6 + lift}
                      width={r - x - 2}
                      height={boardBottom - boardTop + 12 - lift * 2}
                      rx={10}
                      fill="none"
                      stroke="rgba(255,122,69,0.55)"
                      strokeDasharray="4 5"
                      strokeWidth={1.2}
                    />
                    {w.label && (
                      <text x={(x + r) / 2} y={boardTop - (i % 2 ? 25 : 12)} className="fb-win-label">
                        {w.label}
                      </text>
                    )}
                  </g>
                )
              })}

            {visible.map((m) => {
              const x = slotX(m.fret)
              const y = stringY(m.string)
              const color = colorOf(m)
              const text = m.label ?? (labelMode === 'degree' && m.degree ? m.degree : names(m.pc))
              return (
                <Note
                  key={`m-${m.string}-${m.fret}-${m.level}-${color}`}
                  x={x}
                  y={y}
                  r={radius}
                  color={color}
                  level={m.level}
                  main={text}
                  badge={labelMode === 'both' && m.level === 'on' && !m.label && m.degree ? m.degree : null}
                  gradient={`url(#${id(`ball-${gradientKey(color)}`)})`}
                  glow={`url(#${id('glow')})`}
                  onEnter={m.level === 'ghost' ? undefined : hoverOn(x, y, m)}
                />
              )
            })}

            {voicing?.voices.map((voice) => {
              const x = slotX(voice.fret)
              const y = stringY(voice.string)
              const color = ROLE_COLOR[roleOf(voice.degree)]
              return (
                <Note
                  key={`voice-${voicing.symbol}-${voicing.shape}-${voice.string}`}
                  x={x}
                  y={y}
                  r={radius + 1.5}
                  color={color}
                  level="on"
                  ring
                  main={labelMode === 'degree' ? voice.degree : names(voice.pc)}
                  badge={labelMode === 'both' ? voice.degree : null}
                  gradient={`url(#${id(`ball-${gradientKey(color)}`)})`}
                  glow={`url(#${id('glow')})`}
                  onEnter={hoverOn(x, y, { ...voice })}
                />
              )
            })}

            {voicing?.muted.map((s) => (
              <text key={`mute-${s}`} x={slotX(0)} y={stringY(s)} className="fb-mute">
                ×
              </text>
            ))}

            {rings.map((p) => (
              <circle key={`ring-${p.string}-${p.fret}`} className="fb-ring" cx={slotX(p.fret)} cy={stringY(p.string)} r={radius + 5} fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth={1.8} />
            ))}

            {now.map((p) => (
              <g key={`now-${p.string}-${p.fret}`} className="fb-now">
                <circle cx={slotX(p.fret)} cy={stringY(p.string)} r={radius + 6} fill="rgba(255,255,255,0.14)" stroke="#fff" strokeWidth={2.6} />
              </g>
            ))}
          </svg>
        )}

        {hover && (
          <div className="fb-tip" style={{ left: hover.x, top: hover.y - radius - 10 }}>
            <span className="fb-tip-label">
              {6 - hover.string}ª corda · {hover.fret === 0 ? 'solta' : `casa ${hover.fret}`}
            </span>
            <span className="fb-tip-value">
              {hover.note}
              {hover.degree && <small style={{ color: hover.color }}>{hover.degree}</small>}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Uma nota: esfera de vidro com brilho, halo na cor do papel e o nome dentro.
 * Discreta, ela encolhe e perde o halo; fantasma, vira só um contorno.
 */
function Note({
  x,
  y,
  r,
  color,
  level,
  ring = false,
  main,
  badge,
  gradient,
  glow,
  onEnter,
}: {
  x: number
  y: number
  r: number
  color: string
  level: Mark['level']
  ring?: boolean
  main: string
  badge: string | null
  gradient: string
  glow: string
  onEnter?: () => void
}) {
  /* Contorno: a nota da forma que não está acesa — dá para ler a forma sem disputar com o que soa. */
  if (level === 'outline') {
    return (
      <g className="fb-note fb-note-ghost" transform={`translate(${x} ${y})`} onMouseEnter={onEnter}>
        <circle r={r * 0.84} fill="rgba(12,12,13,0.86)" stroke={color} strokeWidth={2} />
        <text className="fb-note-text" fill={color} fontSize={r * 0.64}>
          {main}
        </text>
      </g>
    )
  }

  if (level === 'ghost') {
    return (
      <g className="fb-note fb-note-ghost" transform={`translate(${x} ${y})`}>
        <circle r={r * 0.8} fill="rgba(12,12,13,0.74)" stroke={color} strokeOpacity={0.34} strokeWidth={1} />
        <text className="fb-note-text" fill={color} fillOpacity={0.6} fontSize={r * 0.62}>
          {main}
        </text>
      </g>
    )
  }

  const soft = level === 'soft'
  const rr = soft ? r * 0.74 : r
  const size = main.length > 2 ? rr * 0.66 : rr * 0.8
  const badgeWidth = badge ? Math.max(15, badge.length * 6.2 + 8) : 0
  const halo = !soft && color !== ROLE_COLOR.other

  return (
    <g className="fb-note" transform={`translate(${x} ${y})`} onMouseEnter={onEnter} opacity={soft ? 0.82 : 1}>
      <g className="fb-note-pop">
        {halo && <circle r={rr * 1.05} fill={color} opacity={0.62} filter={glow} />}
        {ring && <circle className="fb-ring" r={rr + 5} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={1.6} />}
        <circle r={rr} fill={gradient} />
        <ellipse cx={-rr * 0.3} cy={-rr * 0.46} rx={rr * 0.42} ry={rr * 0.24} fill="rgba(255,255,255,0.5)" />
        <text className="fb-note-text" fill="#141212" fontSize={size}>
          {main}
        </text>
        {badge && (
          <g transform={`translate(${rr * 0.72} ${-rr * 0.95})`}>
            <rect x={0} y={-7.5} width={badgeWidth} height={15} rx={7.5} fill="rgba(12,12,13,0.92)" stroke="rgba(255,255,255,0.22)" />
            <text x={badgeWidth / 2} y={0.5} className="fb-badge-text" fill={color}>
              {badge}
            </text>
          </g>
        )}
      </g>
    </g>
  )
}

export const Fretboard = memo(FretboardView)
