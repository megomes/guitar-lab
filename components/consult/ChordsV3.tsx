'use client'

/* Acordes V3 — as formas que estou decorando agora.
 *
 * Quatro acordes (maior, menor, 7 e menor com 7ª), na 6ª e na 5ª corda, em dois tamanhos:
 * a pestana inteira e a tríade/shell de três notas. Não é jogo nem prática: é para olhar,
 * decorar e ligar uma forma à outra. Por isso a tela tem duas partes bem separadas:
 *
 * - Você mexe: a tônica, qual corda-raiz, graus ou notas, e se marca o que mudou.
 * - Para olhar: a grade, com as pestanas e as tríades lado a lado, na mesma moldura, para
 *   comparar de relance. A regra de cada acorde vai no nome da linha, numa frase.
 *
 * Cada forma de cima para baixo é o maior com uma ou duas notas mexidas: no modo "o que
 * mudou", a nota que mexeu ganha um anel e o lugar de onde ela veio fica tracejado.
 */
import { memo } from 'react'

import { degreeColor } from '@/lib/roles'
import type { Settings, V3RootView } from '@/lib/settings'
import { TRIAD_VARIANT, V3_ROWS, moves, rootString, v3Set, type V3Move, type V3Note, type V3Root, type V3Set, type V3Shape } from '@/lib/v3'

import { useNames } from '../names'
import { Segmented, Switch } from '../ui'
import { CGroup, Tonics } from './Controls'

type Setter = <K extends keyof Settings>(key: K) => (value: Settings[K]) => void

/* ── O diagrama ───────────────────────────────────────────────────────── */

const L = 24
const GAP = 16
const TOP = 20
const ROW = 20

interface DiagramProps {
  shape: V3Shape
  frame: { first: number; rows: number }
  /** A barra da pestana: a casa da fundamental, da corda-raiz até a 1ª. */
  barre?: { fret: number; from: number } | null
  /** As notas que mexeram em relação ao maior: anel na nova, tracejado na antiga. */
  moved?: V3Move[]
  /** Notas de fundo, apagadas: a pestana atrás do shell que pula corda. */
  under?: V3Note[]
  label: (n: V3Note) => string
}

function V3DiagramView({ shape, frame, barre, moved = [], under = [], label }: DiagramProps) {
  const { first, rows } = frame
  const W = L + GAP * 5 + 14
  const H = TOP + rows * ROW + 8
  const x = (s: number) => L + s * GAP
  const y = (f: number) => (f === 0 ? TOP - 10 : TOP + (f - first + 0.5) * ROW)
  const sounding = new Set(shape.notes.map((n) => n.s))
  const back = under.filter((u) => !shape.notes.some((n) => n.s === u.s && n.f === u.f))

  return (
    <svg className="v3-diagram" viewBox={`0 0 ${W} ${H}`} style={{ aspectRatio: `${W} / ${H}` }} aria-label={shape.tab}>
      {first === 1 ? (
        <rect x={x(0) - 1} y={TOP - 3} width={GAP * 5 + 2} height={4} rx={1.5} fill="#e9e4da" />
      ) : (
        <text x={L - 12} y={TOP + ROW / 2} className="stage-box-fret">
          {first}
        </text>
      )}
      {Array.from({ length: rows + 1 }, (_, i) => (
        <line key={`f${i}`} x1={x(0)} x2={x(5)} y1={TOP + i * ROW} y2={TOP + i * ROW} stroke="rgba(255,255,255,0.22)" strokeWidth={1} />
      ))}
      {Array.from({ length: 6 }, (_, s) => (
        <line key={`s${s}`} x1={x(s)} x2={x(s)} y1={TOP} y2={TOP + rows * ROW} stroke="rgba(236,231,224,0.5)" strokeWidth={s < 3 ? 1.3 : 0.9} />
      ))}
      {[0, 1, 2, 3, 4, 5]
        .filter((s) => !sounding.has(s))
        .map((s) => (
          <text key={`x${s}`} x={x(s)} y={TOP - 10} className="stage-box-mute">
            ×
          </text>
        ))}
      {barre && (
        <rect x={x(barre.from) - 8} y={y(barre.fret) - 8} width={x(5) - x(barre.from) + 16} height={16} rx={8} fill="rgba(236,231,224,0.16)" stroke="rgba(236,231,224,0.4)" strokeWidth={0.8} />
      )}
      {back.map((n) => (
        <g key={`u${n.s}-${n.f}`} transform={`translate(${x(n.s)} ${y(n.f)})`}>
          <circle r={7.6} fill="#1d1c1e" stroke="rgba(236,231,224,0.16)" strokeWidth={0.8} />
          <text className="stage-box-name stage-box-deg" fill="rgba(236,231,224,0.35)">
            {label(n)}
          </text>
        </g>
      ))}
      {moved.map((m) => (
        <g key={`m${m.s}`} className="v3-was">
          <line x1={x(m.s)} x2={x(m.s)} y1={y(m.from)} y2={y(m.to)} stroke={degreeColor(m.degFrom)} strokeWidth={1.2} strokeDasharray="2 2" opacity={0.7} />
          <circle cx={x(m.s)} cy={y(m.from)} r={7.2} fill="none" stroke={degreeColor(m.degFrom)} strokeWidth={1.1} strokeDasharray="2.2 1.8" opacity={0.85} />
        </g>
      ))}
      {shape.notes.map((n) => {
        const c = degreeColor(n.deg)
        const isMoved = moved.some((m) => m.s === n.s)
        return (
          <g key={`${n.s}-${n.f}-${n.deg}`} transform={`translate(${x(n.s)} ${y(n.f)})`}>
            <g className="stage-dot">
              {isMoved && <circle r={10.6} fill="none" stroke="var(--accent-2)" strokeWidth={1.5} />}
              <circle r={7.6} fill={c} />
              <text className="stage-box-name stage-box-deg" fill="#141212">
                {label(n)}
              </text>
            </g>
          </g>
        )
      })}
    </svg>
  )
}

const V3Diagram = memo(V3DiagramView)

/* ── A tela ───────────────────────────────────────────────────────────── */

export function ChordsV3({ settings, set }: { settings: Settings; set: Setter }) {
  const { rootPc, labelMode, v3Root, v3Diff } = settings
  const nn = useNames()
  const roots: V3Root[] = v3Root === 'both' ? [6, 5] : [Number(v3Root) as V3Root]
  const sets = roots.map((r) => v3Set(rootPc, r))
  const label = (n: V3Note) => (labelMode === 'note' ? nn(n.pc) : n.deg)
  const name = nn(rootPc)

  return (
    <main className="wrap screen v3">
      <div className="screen-head">
        <h1 className="screen-title">
          Acordes V3
          <small>as formas que estou decorando</small>
        </h1>
      </div>

      {/* ── Você mexe ───────────────────────────────────────────── */}
      <div className="controls card v3-controls">
        <span className="v3-part">você mexe</span>
        <Tonics rootPc={rootPc} minor={false} onRoot={set('rootPc')} />
        <CGroup label="Raiz">
          <Segmented<V3RootView>
            options={[
              { value: 'both', label: 'as duas' },
              { value: '6', label: '6ª corda' },
              { value: '5', label: '5ª corda' },
            ]}
            value={v3Root}
            onChange={set('v3Root')}
          />
        </CGroup>
        <Segmented
          options={[
            { value: 'degree', label: 'graus' },
            { value: 'note', label: 'notas' },
          ]}
          value={labelMode === 'note' ? 'note' : 'degree'}
          onChange={set('labelMode')}
        />
        <Switch label="o que mudou" on={v3Diff} onChange={() => set('v3Diff')(!v3Diff)} />
      </div>

      {/* ── Para olhar ──────────────────────────────────────────── */}
      <span className="v3-part">para olhar</span>

      {/* A 6ª e a 5ª corda lado a lado, na mesma linha de cada acorde: dá para comparar as
          duas raízes de relance. A tela rola para baixo. */}
      <section className="v3-grid card" aria-label="as formas" style={{ ['--v3-blocks' as string]: sets.length }}>
        <div className="v3-corner" style={{ gridRow: 'span 2' }}>
          {v3Diff && (
            <ul className="v3-legend">
              <li>
                <i className="v3-lg-ring" /> a nota que mudou
              </li>
              <li>
                <i className="v3-lg-was" /> onde ela estava no maior
              </li>
              <li>
                <i className="v3-lg-under" /> o resto da pestana
              </li>
            </ul>
          )}
        </div>
        {sets.map((S, i) => (
          <header key={S.root} className={`v3-blockhead${i > 0 ? ' v3-sep' : ''}`}>
            <b className="v3-block">Raiz na {S.root}ª corda</b>
            <small>
              forma {S.root === 6 ? 'E' : 'A'} · {name} na casa {S.r}
            </small>
          </header>
        ))}
        {sets.map((S, i) => (
          <ColumnHeads key={S.root} S={S} sep={i > 0} />
        ))}
        {V3_ROWS.map((row) => (
          <Row key={row.q} q={row.q} sets={sets} name={name} diff={v3Diff} label={label} />
        ))}
      </section>
    </main>
  )
}

function ColumnHeads({ S, sep }: { S: V3Set; sep: boolean }) {
  return (
    <>
      <header className={`v3-colhead${sep ? ' v3-sep' : ''}`}>
        <b>Pestana</b>
        <small>as 6 (ou 5) cordas · forma {S.root === 6 ? 'E' : 'A'}</small>
      </header>
      <header className="v3-colhead">
        <b>Tríade e shell</b>
        <small>3 notas · nas 7ªs, colada ou pulando corda</small>
      </header>
    </>
  )
}

function Row({ q, sets, name, diff, label }: { q: (typeof V3_ROWS)[number]['q']; sets: V3Set[]; name: string; diff: boolean; label: (n: V3Note) => string }) {
  const row = V3_ROWS.find((r) => r.q === q)!
  return (
    <>
      <div className="v3-rowhead">
        <b>{row.name}</b>
        <span className="v3-sym">
          {name}
          {row.sym}
          {row.jazz && row.jazz !== row.sym && <small> · {name}{row.jazz}</small>}
        </span>
        <small>{row.how}</small>
      </div>
      {sets.map((S, si) => {
        const barre = S.barre[q]
        const rs = rootString(S.root)
        return [
          <figure key={`${S.root}-b`} className={`v3-cell${si > 0 ? ' v3-sep' : ''}`}>
            <V3Diagram shape={barre} frame={S.frame} barre={{ fret: S.r, from: rs }} moved={diff && q !== 'maj' ? moves(S.barre.maj, barre) : []} label={label} />
            <figcaption className="mono">{barre.tab}</figcaption>
          </figure>,
          <div key={`${S.root}-t`} className="v3-cell v3-cell-pair">
            {S.triad[q].map((t, i) => (
              <figure key={i}>
                <V3Diagram
                  shape={t}
                  frame={S.frame}
                  /* A colada se compara com a tríade maior; a que pula corda mostra a pestana atrás. */
                  moved={diff && q !== 'maj' && i === 0 ? moves(S.triad.maj[0], t) : []}
                  under={diff && i === 1 ? barre.notes : []}
                  label={label}
                />
                <figcaption>
                  <span className="mono">{t.tab}</span>
                  {S.triad[q].length > 1 && <small>{TRIAD_VARIANT[i]}</small>}
                </figcaption>
              </figure>
            ))}
          </div>,
        ]
      })}
    </>
  )
}
