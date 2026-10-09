'use client'

/* O palco da consulta: o espaço entre os controles e o braço.
 *
 * O braço fica preso embaixo, e o que sobra em cima não fica vazio: vira uma
 * segunda leitura do que o braço mostra, de outro ângulo.
 *
 * - A roda: as doze notas no ciclo de quintas, com a tônica no alto. A escala ou o acorde
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
import { FRET_COUNT, SHAPE_IDS, shapeLabel, STRING_LABELS, boxFor, scaleSpots, type Scale, type ShapeId } from '@/lib/fretboard'
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
  /** O centro é o nome do tom: ganha o m quando o tom aceso é menor (C vira Cm). */
  asKey?: boolean
  sub?: string
  onPress?: (pc: number) => void
  /** Rótulo de leitor de tela para o toque: "tônica", "ligar ou desligar". */
  pressHint: string
}

/** Uma fatia de anel: de um ângulo a outro (em graus, 0 no alto), entre dois raios. */
function slice(k: number, r0: number, r1: number): string {
  const pad = 1.6
  const a0 = ((k * 30 - 15 + pad) * Math.PI) / 180
  const a1 = ((k * 30 + 15 - pad) * Math.PI) / 180
  const p = (r: number, a: number) => `${(100 + r * Math.sin(a)).toFixed(2)} ${(100 - r * Math.cos(a)).toFixed(2)}`
  return `M ${p(r1, a0)} A ${r1} ${r1} 0 0 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`
}

/* Arredondado: o servidor e o navegador erram o seno na última casa e a hidratação reclama. */
const round2 = (v: number) => Math.round(v * 100) / 100
const polar = (k: number, r: number) => {
  const a = (k * 30 * Math.PI) / 180
  return { x: round2(100 + r * Math.sin(a)), y: round2(100 - r * Math.cos(a)) }
}

/* Os dois anéis: por fora os tons maiores, por dentro a relativa menor de cada um. */
const RINGS = { outer: [71, 97], inner: [44, 69] } as const

/**
 * O ciclo de quintas em dois anéis, como no de papel: C por fora, Am por dentro.
 *
 * O anel do tom que está na tela acende: maior acende o de fora, menor o de dentro — e a
 * tônica fica sempre no alto. Os nomes não mudam de lugar ao trocar maior por menor: a roda
 * gira um quarto de volta (a tônica menor mora três quintas antes, embaixo da relativa maior)
 * e os nomes giram ao contrário, para ficarem de pé. As notas da escala viram fatias coloridas pelo grau, vizinhas
 * (cada uma a uma quinta da outra), e a tônica salta um pouco para fora. O outro anel fica
 * quieto, com a relativa marcada por um contorno: as mesmas notas, lidas da outra tônica.
 */
function WheelView({ top, lit, center, asKey = false, sub, onPress, pressHint }: WheelProps) {
  const nn = useNames()
  const degrees = [...lit.values()]
  /* Tom menor quando a terça acesa é a menor. */
  const minorKey = degrees.includes('♭3') && !degrees.includes('3')
  const outer = Array.from({ length: 12 }, (_, k) => mod12(top + 7 * k))
  const turn = minorKey ? 90 : 0
  const upright = (c: { x: number; y: number }) => ({ transform: `rotate(${-turn}deg)`, transformOrigin: `${c.x}px ${c.y}px` })
  const inner = outer.map((pc) => mod12(pc + 9))

  const ring = (which: 'outer' | 'inner') => {
    const active = (which === 'inner') === minorKey
    const pcs = which === 'outer' ? outer : inner
    const [r0, r1] = RINGS[which]
    const mid = (r0 + r1) / 2
    return pcs.map((pc, k) => {
      const degree = active ? lit.get(pc) : undefined
      const on = degree !== undefined
      const tonic = on && degree === '1'
      /* No anel quieto, a fatia da relativa: logo acima ou abaixo da tônica. */
      const relative = !active && k === (minorKey ? 9 : 0) && lit.size > 0
      const color = on ? degreeColor(degree) : undefined
      /* O anel de dentro é o dos tons menores: o m fica sempre, aceso ou não. */
      const name = which === 'outer' ? nn(pc) : `${nn(pc)}m`
      /* Nome e grau empilhados na vertical, em qualquer ponto da roda. */
      const c = polar(k, mid)
      const label = { x: c.x, y: on ? round2(c.y - 3.5) : c.y }
      const deg = { x: c.x, y: round2(c.y + 5) }
      return (
        <g
          key={`${which}-${k}`}
          className={`stage-wheel-slice${onPress ? ' stage-press' : ''}`}
          onClick={onPress ? () => onPress(pc) : undefined}
          role={onPress ? 'button' : undefined}
          aria-label={onPress ? `${nn(pc)}${which === 'inner' ? ' menor' : ''}: ${pressHint}` : undefined}
        >
          <path
            d={slice(k, r0, tonic ? r1 + 3 : r1)}
            stroke={relative ? 'var(--accent-2)' : on ? 'none' : 'rgba(255,255,255,0.06)'}
            strokeWidth={relative ? 1 : 0.6}
            strokeDasharray={relative ? '2.5 2' : undefined}
            style={{ fill: on ? color : active ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.018)', filter: tonic ? `drop-shadow(0 0 5px ${color})` : undefined }}
          />
          <g className="stage-wheel-upright" style={upright(c)}>
          <text
            x={label.x}
            y={label.y}
            className={`stage-wheel-name${which === 'inner' ? ' stage-wheel-name-in' : ''}`}
            fill={on ? '#141212' : relative ? 'var(--accent-2)' : active ? 'rgba(236,231,224,0.55)' : 'rgba(236,231,224,0.3)'}
          >
            {name}
          </text>
          {on && (
            <text x={deg.x} y={deg.y} className="stage-wheel-degree" fill="rgba(20,18,18,0.72)">
              {degree}
            </text>
          )}
          </g>
        </g>
      )
    })
  }

  return (
    <svg className="stage-wheel" viewBox="0 0 200 200" role="group" aria-label={`ciclo de quintas, ${minorKey ? 'tons menores' : 'tons maiores'} acesos`}>
      <circle cx={100} cy={100} r={40} fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.06)" />
      <g className="stage-wheel-turn" style={{ transform: `rotate(${turn}deg)`, transformOrigin: '100px 100px' }}>
        {ring('inner')}
        {ring('outer')}
      </g>
      <text x={100} y={sub ? 95 : 100} className="stage-wheel-center">
        {asKey && minorKey ? `${center}m` : center}
      </text>
      {sub && (
        <text x={100} y={114} className="stage-wheel-sub">
          {sub}
        </text>
      )}
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

type DiagramProps = Pick<BoxProps, 'dots' | 'muted' | 'label' | 'frame' | 'barre'>

/** O desenho de um diagrama, sem moldura nem título. */
function Diagram({ dots, muted = [], label, frame, barre }: DiagramProps) {
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

  return (
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
            <g key={`${d.string}-${d.fret}-${d.ghost ? 'g' : d.degree}`} transform={`translate(${x(d.string)} ${y(d.fret)})`}>
              <g className="stage-dot">
              {open ? (
                <circle r={5.5} fill="#0f0f10" stroke={c} strokeWidth={d.ghost ? 1 : 1.6} />
              ) : d.ghost ? (
                <>
                  <circle r={7.4} fill="#1d1c1e" stroke="rgba(236,231,224,0.16)" strokeWidth={0.8} />
                  <text className={`stage-box-name${label ? " stage-box-deg" : ""}`} fill="rgba(236,231,224,0.4)">
                    {label ? label(d) : nn(d.pc)}
                  </text>
                </>
              ) : (
                <>
                  <circle r={7.4} fill={c} />
                  <text className={`stage-box-name${label ? " stage-box-deg" : ""}`} fill="#141212">
                    {label ? label(d) : nn(d.pc)}
                  </text>
                </>
              )}
              </g>
            </g>
          )
        })}
      </svg>
  )
}

function BoxView({ title, sub, on = false, onPress, ...diagram }: BoxProps) {
  const Tag = onPress ? 'button' : 'div'
  return (
    <Tag type={onPress ? 'button' : undefined} className={`stage-box${on ? ' stage-box-on' : ''}`} onClick={onPress} aria-pressed={onPress ? on : undefined}>
      <Diagram {...diagram} />
      <span className="stage-box-title">
        {title}
        {sub && <small>{sub}</small>}
      </span>
    </Tag>
  )
}

export const Box = memo(BoxView)

/** Uma forma e o acorde que dá nome a ela, um em cima do outro, na mesma caixa e na mesma
 * moldura. O texto é uma linha só em cima — a letra da forma e as casas —, o resto é desenho. */
function PairBox({ name, range, hint, top, bottom, on, onPress }: { name: string; range?: string; hint: string; top: DiagramProps; bottom: DiagramProps; on: boolean; onPress: () => void }) {
  return (
    <button type="button" className={`stage-box stage-pair${on ? ' stage-box-on' : ''}`} onClick={onPress} aria-pressed={on} title={hint}>
      <span className="stage-pair-head">
        <b>{name}</b>
        {range && <small>{range}</small>}
      </span>
      <Diagram {...top} />
      <Diagram {...bottom} />
    </button>
  )
}

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

/* Todo diagrama de forma tem seis casas, em qualquer escala e tônica: trocar de escala só
   troca as bolinhas, nada muda de tamanho. Cabe tudo — a caixa tem até cinco casas e o
   acorde passa no máximo uma de cada lado. */
const SHAPE_ROWS = 6

/** Nos diagramas das formas, a bolinha leva o grau, não o nome da nota. */
const byDegree = (d: Dot) => d.degree

/** A moldura de uma forma: pela janela da caixa, que é a mesma na maior e na penta maior (e na
 * menor, penta menor e blues), com a forma centrada; perto do capotraste, a partir dele. */
function shapeFrame(w: { from: number; to: number } | null, chord: Dot[]): { first: number; rows: number } {
  if (!w) return { first: 1, rows: SHAPE_ROWS }
  const fr = [w.from, w.to, ...chord.map((c) => c.fret)]
  const pressed = fr.filter((f) => f > 0)
  const lo = Math.min(...pressed)
  const hi = Math.max(...pressed)
  if (fr.includes(0) || lo <= 1) return { first: 1, rows: SHAPE_ROWS }
  return { first: Math.max(1, lo - Math.floor((SHAPE_ROWS - (hi - lo + 1)) / 2)), rows: SHAPE_ROWS }
}

export function ScaleStage({
  rootPc,
  scale,
  shape,
  onRoot,
  onShape,
}: {
  rootPc: number
  scale: Scale
  shape: ShapeId
  onRoot: (pc: number) => void
  onShape: (s: ShapeId) => void
}) {
  const nn = useNames()
  const lit = new Map(scale.intervals.map((iv, i) => [mod12(rootPc + iv), scale.degrees[i]]))
  /* O acorde que dá nome a cada forma: maior se a escala tem a terça maior, menor se não. */
  const parent: QualityId = scale.intervals.includes(4) ? 'maj' : 'min'
  const raw = SHAPE_IDS.map((id) => {
    const pos = boxFor(rootPc, id, scale)
    const dots: Dot[] = pos ? scaleSpots(rootPc, scale, pos).filter((s) => s.inShape) : []
    return { id, pos, dots, chord: pos ? parentChord(rootPc, parent, id, pos.window) : [] }
  })
  /* Todos os diagramas com o mesmo número de casas, para as janelas ficarem do mesmo tamanho. */
  const shapes = raw.map((r) => ({ ...r, frame: shapeFrame(r.pos?.window ?? null, r.chord) }))
  return (
    <section className="stage card" aria-label="a escala de outros ângulos">
      <div className="stage-in">
        <Wheel top={rootPc} lit={lit} center={nn(rootPc)} asKey sub={`${scale.intervals.length} notas`} onPress={onRoot} pressHint="virar a tônica" />
        <div className="stage-side">
          <div className="stage-boxes">
            {shapes.map(({ id, pos, dots, chord, frame }) => {
              const barre = barreOf(chord)
              /* Embaixo da pestana não sobra nota da escala: ali a corda está presa no acorde. */
              const under = (d: Dot) => !!barre && d.fret === barre.fret && d.string >= barre.from && d.string <= barre.to
              const back = dots.filter((d) => !under(d) && !chord.some((c) => c.string === d.string && c.fret === d.fret)).map((d) => ({ ...d, ghost: true }))
              return (
                <PairBox
                  key={id}
                  name={shapeLabel(id, parent === 'min')}
                  range={pos ? `${pos.window.from}–${pos.window.to}` : undefined}
                  hint={chord.length ? `forma ${id}: em cima a escala, embaixo o acorde ${id}${parent === 'min' ? 'm' : ''} nessa casa (aqui ele vira ${chordSymbol(rootPc, parent, nn)})` : `forma ${id}`}
                  top={{ dots, frame, label: byDegree }}
                  bottom={{ dots: [...back, ...chord], barre, frame, label: byDegree }}
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
