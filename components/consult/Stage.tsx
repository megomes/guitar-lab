'use client'

/* O palco da consulta: o espaço entre os controles e o braço.
 *
 * O braço fica preso embaixo, e o que sobra em cima não fica vazio: vira uma
 * segunda leitura do que o braço mostra, de outro ângulo.
 *
 * - A roda: as doze notas em círculo, com a tônica no alto. A escala ou o acorde
 *   vira um polígono — e o desenho é a estrutura: toda pentatônica menor tem o
 *   mesmo desenho, todo acorde menor o mesmo triângulo, em qualquer tom.
 * - Os diagramas: as cinco formas CAGED de pé, como num caderno de acordes. Tocar
 *   num deles leva o braço para lá.
 * - Nas notas, em vez dos diagramas, a tabela de onde cada nota mora em cada corda.
 *
 * Tudo é SVG com viewBox: cresce e encolhe com a sobra de altura, do celular ao
 * tablet em pé.
 */
import { memo, type ReactNode } from 'react'

import { QUALITIES, SHAPE_ROOT_STRING, chordIntervals, chordSymbol, chordVoicing, type QualityId } from '@/lib/chords'
import { FRET_COUNT, SHAPE_IDS, STRING_LABELS, boxFor, scaleSpots, type Scale, type ShapeId } from '@/lib/fretboard'
import { harmonicField } from '@/lib/harmony'
import { fretsByString } from '@/lib/notes'
import { degreeColor } from '@/lib/roles'
import { sharpNames } from '@/lib/spelling'
import { INVERSION_NAME, STRING_SETS, closedTriads, setLabel } from '@/lib/triads'

import { useNames } from '../names'

const INTERVALS = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7']
const mod12 = (x: number) => ((x % 12) + 12) % 12

/* ── A roda ───────────────────────────────────────────────────────────── */

interface WheelProps {
  /** A nota do alto da roda. */
  top: number
  /** As notas acesas e o grau de cada uma. */
  lit: Map<number, string>
  center: string
  sub?: string
  onPress?: (pc: number) => void
  /** Rótulo de leitor de tela para o toque: "tônica", "ligar ou desligar". */
  pressHint: string
}

function WheelView({ top, lit, center, sub, onPress, pressHint }: WheelProps) {
  const nn = useNames()
  const R = 76
  const at = (k: number) => {
    const a = (k / 12) * Math.PI * 2 - Math.PI / 2
    return { x: 100 + R * Math.cos(a), y: 100 + R * Math.sin(a) }
  }
  const order = Array.from({ length: 12 }, (_, k) => mod12(top + k))
  const poly = order
    .map((pc, k) => (lit.has(pc) ? at(k) : null))
    .filter((p): p is { x: number; y: number } => p !== null)
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ')

  return (
    <svg className="stage-wheel" viewBox="0 0 200 200" role="group" aria-label="roda das notas">
      <circle cx={100} cy={100} r={R} fill="none" stroke="rgba(255,255,255,0.07)" />
      {lit.size > 2 && <polygon points={poly} style={{ fill: 'rgba(var(--accent-rgb), 0.12)', stroke: 'rgba(var(--accent-2-rgb), 0.75)' }} strokeWidth={1.4} strokeLinejoin="round" />}
      {lit.size === 2 && <polyline points={poly} fill="none" stroke="rgba(255,122,69,0.75)" strokeWidth={1.4} />}
      <text x={100} y={sub ? 96 : 100} className="stage-wheel-center">
        {center}
      </text>
      {sub && (
        <text x={100} y={114} className="stage-wheel-sub">
          {sub}
        </text>
      )}
      {order.map((pc, k) => {
        const p = at(k)
        const degree = lit.get(pc)
        const on = degree !== undefined
        const color = on ? degreeColor(degree) : undefined
        return (
          <g
            key={pc}
            className={`stage-wheel-note${onPress ? ' stage-press' : ''}`}
            transform={`translate(${p.x} ${p.y})`}
            onClick={onPress ? () => onPress(pc) : undefined}
            role={onPress ? 'button' : undefined}
            aria-label={onPress ? `${nn(pc)}: ${pressHint}` : undefined}
          >
            <circle r={13} fill="transparent" />
            {on ? (
              <>
                <circle r={11} fill={color} opacity={0.22} />
                <circle r={9.5} fill={color} />
                <text className="stage-wheel-name" fill="#141212">
                  {nn(pc)}
                </text>
                <text y={-16} className="stage-wheel-degree" fill={color}>
                  {degree}
                </text>
              </>
            ) : (
              <>
                <circle r={8} fill="rgba(12,12,13,0.9)" stroke="rgba(255,255,255,0.14)" />
                <text className="stage-wheel-name" fill="rgba(236,231,224,0.45)">
                  {nn(pc)}
                </text>
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export const Wheel = memo(WheelView)

/* ── Um diagrama de pé, como no caderno de acordes ────────────────────── */

export interface Dot {
  string: number
  fret: number
  pc: number
  degree: string
  /** Nota de fundo: apagada, só para situar o resto. */
  ghost?: boolean
}

/** A primeira casa desenhada e quantas casas o diagrama mostra. */
export function frameOf(dots: { fret: number }[]): { first: number; rows: number } {
  const pressed = dots.filter((d) => d.fret > 0).map((d) => d.fret)
  const lo = pressed.length ? Math.min(...pressed) : 1
  const hi = pressed.length ? Math.max(...pressed) : 4
  /* Com corda solta, o diagrama começa no capotraste. */
  const first = dots.some((d) => d.fret === 0) || lo <= 2 ? 1 : lo
  return { first, rows: Math.max(4, hi - first + 1) }
}

interface BoxProps {
  dots: Dot[]
  muted?: number[]
  title: ReactNode
  sub?: string
  on?: boolean
  onPress?: () => void
  /** O que vai escrito na bolinha; sem isso, o nome da nota. */
  label?: (d: Dot) => string
  /** Para alinhar vários diagramas: a mesma moldura em todos. */
  frame?: { first: number; rows: number }
  /** A pestana do acorde: uma barra numa casa, de uma corda a outra. */
  barre?: { fret: number; from: number; to: number } | null
}

/** A pestana: a casa presa mais baixa, quando duas ou mais cordas caem nela. */
export function barreOf(dots: Dot[]): { fret: number; from: number; to: number } | null {
  const pressed = dots.filter((d) => d.fret > 0)
  if (pressed.length < 2) return null
  const lo = Math.min(...pressed.map((d) => d.fret))
  const on = pressed.filter((d) => d.fret === lo).map((d) => d.string)
  return on.length >= 2 ? { fret: lo, from: Math.min(...on), to: Math.max(...on) } : null
}

function BoxView({ dots, muted = [], title, sub, on = false, onPress, label, frame, barre }: BoxProps) {
  const nn = useNames()
  const { first, rows } = frame ?? frameOf(dots)
  const L = 22
  const GAP = 16
  const TOP = 18
  const ROW = 20
  const W = L + GAP * 5 + 12
  const H = TOP + rows * ROW + 6
  const x = (s: number) => L + s * GAP
  const y = (f: number) => (f === 0 ? TOP - 9 : TOP + (f - first + 0.5) * ROW)

  const Tag = onPress ? 'button' : 'div'
  return (
    <Tag type={onPress ? 'button' : undefined} className={`stage-box${on ? ' stage-box-on' : ''}`} onClick={onPress} aria-pressed={onPress ? on : undefined}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ aspectRatio: `${W} / ${H}` }} aria-hidden>
        {first === 1 ? (
          <rect x={x(0) - 1} y={TOP - 3} width={GAP * 5 + 2} height={4} rx={1.5} fill="#e9e4da" />
        ) : (
          <text x={L - 9} y={TOP + ROW / 2} className="stage-box-fret">
            {first}
          </text>
        )}
        {Array.from({ length: rows + 1 }, (_, i) => (
          <line key={`f${i}`} x1={x(0)} x2={x(5)} y1={TOP + i * ROW} y2={TOP + i * ROW} stroke="rgba(255,255,255,0.22)" strokeWidth={1} />
        ))}
        {Array.from({ length: 6 }, (_, s) => (
          <line key={`s${s}`} x1={x(s)} x2={x(s)} y1={TOP} y2={TOP + rows * ROW} stroke="rgba(236,231,224,0.5)" strokeWidth={s < 3 ? 1.3 : 0.9} />
        ))}
        {muted.map((s) => (
          <text key={`x${s}`} x={x(s)} y={TOP - 9} className="stage-box-mute">
            ×
          </text>
        ))}
        {barre && (
          <rect
            x={x(barre.from) - 7.4}
            y={y(barre.fret) - 7.4}
            width={x(barre.to) - x(barre.from) + 14.8}
            height={14.8}
            rx={7.4}
            fill="rgba(236,231,224,0.22)"
            stroke="rgba(236,231,224,0.45)"
            strokeWidth={0.8}
          />
        )}
        {dots.map((d) => {
          const c = d.ghost ? 'rgba(236,231,224,0.28)' : degreeColor(d.degree)
          const open = d.fret === 0
          return (
            <g key={`${d.string}-${d.fret}`} transform={`translate(${x(d.string)} ${y(d.fret)})`}>
              {open ? (
                <circle r={5.5} fill="#0f0f10" stroke={c} strokeWidth={d.ghost ? 1 : 1.6} />
              ) : d.ghost ? (
                <>
                  <circle r={7.4} fill="#1d1c1e" stroke="rgba(236,231,224,0.16)" strokeWidth={0.8} />
                  <text className="stage-box-name" fill="rgba(236,231,224,0.4)">
                    {label ? label(d) : nn(d.pc)}
                  </text>
                </>
              ) : (
                <>
                  <circle r={7.4} fill={c} />
                  <text className="stage-box-name" fill="#141212">
                    {label ? label(d) : nn(d.pc)}
                  </text>
                </>
              )}
            </g>
          )
        })}
      </svg>
      <span className="stage-box-title">
        {title}
        {sub && <small>{sub}</small>}
      </span>
    </Tag>
  )
}

export const Box = memo(BoxView)

/* ── Escalas ──────────────────────────────────────────────────────────── */

/** O acorde da forma (o acorde aberto que dá nome a ela) encaixado na caixa da escala: a oitava
 * que mais cai dentro dela, e só as notas que cabem ali — perto do capotraste a forma às vezes
 * pediria uma casa negativa, e aí aquela nota fica de fora, mas o desenho continua. */
function parentChord(rootPc: number, quality: QualityId, shape: ShapeId, w: { from: number; to: number }): Dot[] {
  const v = chordVoicing(rootPc, quality, shape)
  if (!v) return []
  const fits = (f: number) => f >= 0 && f <= FRET_COUNT && f >= w.from - 1 && f <= w.to + 1
  let best: Dot[] = []
  for (const by of [-24, -12, 0, 12, 24]) {
    const notes = v.voices.filter((x) => fits(x.fret + by)).map((x) => ({ string: x.string, fret: x.fret + by, pc: x.pc, degree: x.degree }))
    if (notes.length > best.length) best = notes
  }
  return best
}

export function ScaleStage({
  rootPc,
  scale,
  shape,
  onRoot,
  onShape,
  onChord,
}: {
  rootPc: number
  scale: Scale
  shape: ShapeId
  onRoot: (pc: number) => void
  onShape: (s: ShapeId) => void
  onChord: (root: number, quality: QualityId) => void
}) {
  const nn = useNames()
  const lit = new Map(scale.intervals.map((iv, i) => [mod12(rootPc + iv), scale.degrees[i]]))
  const field = harmonicField(rootPc, scale)
  /* O acorde que dá nome a cada forma: maior se a escala tem a terça maior, menor se não. */
  const parent: QualityId = scale.intervals.includes(4) ? 'maj' : 'min'
  const raw = SHAPE_IDS.map((id) => {
    const pos = boxFor(rootPc, id, scale)
    const dots: Dot[] = pos ? scaleSpots(rootPc, scale, pos).filter((s) => s.inShape) : []
    return { id, pos, dots, chord: pos ? parentChord(rootPc, parent, id, pos.window) : [] }
  })
  /* Todos os diagramas com o mesmo número de casas, para as janelas ficarem do mesmo tamanho. */
  const frames = raw.map((r) => frameOf([...r.dots, ...r.chord]))
  const rows = Math.max(...frames.map((f) => f.rows))
  const shapes = raw.map((r, i) => ({ ...r, frame: { first: frames[i].first, rows } }))
  return (
    <section className="stage card" aria-label="a escala de outros ângulos">
      <div className="stage-in">
        <Wheel top={rootPc} lit={lit} center={nn(rootPc)} sub={`${scale.intervals.length} notas`} onPress={onRoot} pressHint="virar a tônica" />
        <div className="stage-side">
          <div className="stage-boxes stage-boxes-pairs">
            {shapes.flatMap(({ id, pos, dots, chord, frame }) => {
              const barre = barreOf(chord)
              /* Embaixo da pestana não sobra nota da escala: ali a corda está presa no acorde. */
              const under = (d: Dot) => !!barre && d.fret === barre.fret && d.string >= barre.from && d.string <= barre.to
              const back = dots.filter((d) => !under(d) && !chord.some((c) => c.string === d.string && c.fret === d.fret)).map((d) => ({ ...d, ghost: true }))
              return [
              <Box
                key={id}
                dots={dots}
                frame={frame}
                title={`forma ${id}`}
                sub={pos ? `${pos.window.from}–${pos.window.to}` : undefined}
                on={id === shape}
                onPress={() => onShape(id)}
              />,
              <Box
                key={`${id}-acorde`}
                dots={[...back, ...chord]}
                barre={barre}
                frame={frame}
                title={`${id}${parent === 'min' ? 'm' : ''} aberto`}
                sub={chord.length ? `vira ${chordSymbol(rootPc, parent, nn)}` : 'não cabe'}
                on={id === shape}
                onPress={() => onShape(id)}
              />,
              ]
            })}
          </div>
          {field.length > 0 && (
            <div className="stage-field" role="group" aria-label="campo harmônico">
              <span className="stage-label">Campo harmônico</span>
              {field.map((d) => (
                <button key={d.numeral} type="button" className="stage-chord" onClick={() => onChord(d.root, d.quality)} title="ver o acorde">
                  <small>{d.numeral}</small>
                  {chordSymbol(d.root, d.quality, nn)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/* ── Acordes ──────────────────────────────────────────────────────────── */

export function ChordStage({
  rootPc,
  quality,
  shape,
  triadSet,
  triads,
  onRoot,
  onShape,
}: {
  rootPc: number
  quality: QualityId
  shape: ShapeId
  triadSet: number
  /** Vendo as tríades: os diagramas são as três inversões no grupo de cordas. */
  triads: boolean
  onRoot: (pc: number) => void
  onShape: (s: ShapeId) => void
}) {
  const nn = useNames()
  const q = QUALITIES[quality]
  const lit = new Map(chordIntervals(quality).map((iv, i) => [mod12(rootPc + iv), q.degrees[i] ?? '']))
  const set = STRING_SETS[triadSet] ?? STRING_SETS[0]
  const inversions = triads ? closedTriads(rootPc, quality, set).slice(0, 3) : []

  return (
    <section className="stage card" aria-label="o acorde de outros ângulos">
      <div className="stage-in">
        <Wheel top={rootPc} lit={lit} center={chordSymbol(rootPc, quality, nn)} sub={q.name} onPress={onRoot} pressHint="virar a fundamental" />
        <div className="stage-side">
          <div className="stage-boxes">
            {triads
              ? inversions.map((t) => (
                  <Box key={`${t.inv}-${t.from}`} dots={t.notes} muted={[0, 1, 2, 3, 4, 5].filter((s) => !set.includes(s))} title={INVERSION_NAME[t.inv]} sub={`cordas ${setLabel(set)}`} />
                ))
              : SHAPE_IDS.map((id) => {
                  const v = chordVoicing(rootPc, quality, id)
                  return (
                    <Box
                      key={id}
                      dots={v?.voices ?? []}
                      muted={v?.muted}
                      title={`forma ${id}`}
                      sub={v ? `tônica na ${SHAPE_ROOT_STRING[id]}ª` : 'não cabe'}
                      on={id === shape}
                      onPress={() => onShape(id)}
                    />
                  )
                })}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Notas ────────────────────────────────────────────────────────────── */

export function NoteStage({ pcs, onToggle }: { pcs: number[]; onToggle: (pc: number) => void }) {
  const ref = pcs[0] ?? 0
  const lit = new Map(pcs.map((pc) => [pc, INTERVALS[mod12(pc - ref)]]))
  /* Da referência para cima, como no topo da tela. */
  const ordered = [...pcs].sort((a, b) => mod12(a - ref) - mod12(b - ref))
  return (
    <section className="stage card" aria-label="onde cada nota mora">
      <div className="stage-in">
        <Wheel top={0} lit={lit} center={pcs.length ? String(pcs.length) : '–'} sub={pcs.length === 1 ? 'nota' : 'notas'} onPress={onToggle} pressHint="ligar ou desligar" />
        <div className="stage-side">
          {ordered.length === 0 ? (
            <p className="stage-empty">Toque nas notas da roda para ver onde cada uma mora.</p>
          ) : (
            <div className="stage-table-wrap">
              <table className="stage-table">
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="stage-label">Onde mora</span>
                    </th>
                    {[0, 1, 2, 3, 4, 5].map((s) => (
                      <th key={s} scope="col">
                        {6 - s}ª<small>{STRING_LABELS[s]}</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((pc) => {
                    const color = degreeColor(INTERVALS[mod12(pc - ref)])
                    return (
                      <tr key={pc}>
                        <th scope="row">
                          <i style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                          {sharpNames(pc)}
                        </th>
                        {fretsByString(pc).map((fs, s) => (
                          <td key={s}>{fs.map((f) => (f === 0 ? 'solta' : f)).join(' · ')}</td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
