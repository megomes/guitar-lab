'use client'

/* O palco do piano: o espaço entre os controles e o teclado, como na guitarra.
 *
 * A roda é a mesma (o desenho do acorde ou da escala nas doze notas). Ao lado,
 * no acorde, as inversões em teclados pequenos — tocar numa leva o teclado grande
 * para ela; na escala, o campo harmônico, que leva para a tela de acordes.
 */
import { memo } from 'react'

import { QUALITIES, chordSymbol, type QualityId } from '@/lib/chords'
import type { Scale } from '@/lib/fretboard'
import { harmonicField } from '@/lib/harmony'
import { INVERSION_NAMES, PIANO_SCALES, TRIADS, isBlack, pianoChord, pianoVoicing, specBass, specDegrees, specIntervals, specSize, type ChordSpec, type PianoNote } from '@/lib/piano'
import { degreeColor } from '@/lib/roles'

import { Wheel } from '../consult/Stage'
import { useNames } from '../names'

const mod12 = (x: number) => ((x % 12) + 12) % 12

/** O acorde num teclado pequeno, a partir do dó de baixo, em SVG: só as bolinhas. */
function MiniKeysView({ notes }: { notes: PianoNote[] }) {
  const lo = Math.floor(Math.min(...notes.map((n) => n.midi)) / 12) * 12
  /* Duas oitavas, ou três quando a nona passa por cima. */
  const hi = Math.max(lo + 24, Math.ceil((Math.max(...notes.map((n) => n.midi)) + 1) / 12) * 12)
  const W = 10
  const H = 46
  const whites: number[] = []
  for (let m = lo; m < hi; m++) if (!isBlack(m)) whites.push(m)
  const xOf = new Map<number, number>()
  whites.forEach((m, i) => xOf.set(m, i * W))
  const blacks: number[] = []
  for (let m = lo; m < hi; m++) if (isBlack(m)) blacks.push(m)
  const bx = (m: number) => (xOf.get(m - 1) ?? 0) + W * 0.68
  const at = new Map(notes.map((n) => [n.midi, n]))
  return (
    <svg viewBox={`-1 -1 ${whites.length * W + 2} ${H + 2}`} aria-hidden>
      {whites.map((m) => (
        <rect key={m} x={xOf.get(m)} y={0} width={W} height={H} rx={1.5} fill="#ece7e0" stroke="#0b0b0c" strokeWidth={0.8} />
      ))}
      {blacks.map((m) => (
        <rect key={m} x={bx(m)} y={0} width={W * 0.64} height={H * 0.6} rx={1} fill="#1b1b1e" stroke="#000" strokeWidth={0.6} />
      ))}
      {notes.map((n) => {
        const black = isBlack(n.midi)
        const cx = black ? bx(n.midi) + W * 0.32 : (xOf.get(n.midi) ?? 0) + W / 2
        const color = degreeColor(at.get(n.midi)?.degree ?? '')
        return <circle key={n.midi} cx={cx} cy={black ? H * 0.48 : H - 7} r={3.3} fill={color} stroke="rgba(0,0,0,0.45)" strokeWidth={0.6} />
      })}
    </svg>
  )
}

const MiniKeys = memo(MiniKeysView)

export function PianoChordStage({
  spec,
  symbol,
  inversion,
  onRoot,
  onInversion,
  onTriad,
}: {
  spec: ChordSpec
  /** A cifra sem a barra do baixo: o centro da roda. */
  symbol: string
  inversion: number
  onRoot: (pc: number) => void
  onInversion: (i: number) => void
  onTriad: (q: QualityId) => void
}) {
  const nn = useNames()
  const degrees = specDegrees(spec)
  const lit = new Map(specIntervals(spec).map((iv, i) => [mod12(spec.root + iv), degrees[i]]))
  return (
    <section className="stage card" aria-label="o acorde de outros ângulos">
      <div className="stage-in">
        <Wheel top={spec.root} lit={lit} center={symbol} sub={QUALITIES[spec.triad].name} onPress={onRoot} pressHint="virar a fundamental" />
        <div className="stage-side">
          <div className="stage-boxes piano-boxes">
            {Array.from({ length: specSize(spec) }, (_, i) => (
              <button key={i} type="button" className={`stage-box${i === inversion ? ' stage-box-on' : ''}`} onClick={() => onInversion(i)}>
                <MiniKeys notes={pianoVoicing(spec, i)} />
                <span className="stage-box-title">
                  {INVERSION_NAMES[i]}
                  <small>{i === 0 ? 'fundamental no baixo' : `${nn(specBass(spec, i))} no baixo`}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="stage-field" role="radiogroup" aria-label="tríade">
            {TRIADS.map((q) => (
              <button key={q} type="button" role="radio" aria-checked={q === spec.triad} className={`stage-chord${q === spec.triad ? ' stage-chord-on' : ''}`} onClick={() => onTriad(q)} title={QUALITIES[q].name}>
                {QUALITIES[q].symbol || 'maior'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export function PianoScaleStage({
  rootPc,
  scale,
  playing,
  onRoot,
  onScale,
  onChord,
}: {
  rootPc: number
  scale: Scale
  /** O grau do campo que está soando agora. */
  playing: number | null
  onRoot: (pc: number) => void
  onScale: (id: string) => void
  onChord: (degree: number, root: number, quality: QualityId) => void
}) {
  const nn = useNames()
  const lit = new Map(scale.intervals.map((iv, i) => [mod12(rootPc + iv), scale.degrees[i]]))
  const field = harmonicField(rootPc, scale)
  return (
    <section className="stage card" aria-label="a escala de outros ângulos">
      <div className="stage-in">
        <Wheel top={rootPc} lit={lit} center={nn(rootPc)} sub={`${scale.intervals.length} notas`} onPress={onRoot} pressHint="virar a tônica" />
        <div className="stage-side">
          {field.length > 0 ? (
            <>
              <div className="stage-boxes piano-boxes piano-field">
                {field.map((d, i) => (
                  <button key={d.numeral} type="button" className={`stage-box${playing === i ? ' stage-box-on' : ''}`} onClick={() => onChord(i, d.root, d.quality)} title="ouvir o acorde">
                    <MiniKeys notes={pianoChord(d.root, d.quality, 0)} />
                    <span className="stage-box-title">
                      {chordSymbol(d.root, d.quality, nn)}
                      <small className="serif">{d.numeral}</small>
                    </span>
                  </button>
                ))}
              </div>
              <span className="stage-label piano-field-label">Campo harmônico · toque num acorde para ouvir</span>
            </>
          ) : (
            <p className="stage-empty">Com {scale.intervals.length} notas a escala não empilha terças: o campo harmônico aparece na maior e na menor.</p>
          )}
          <div className="stage-field" role="radiogroup" aria-label="escala">
            {PIANO_SCALES.map((s) => (
              <button key={s.id} type="button" role="radio" aria-checked={s.id === scale.id} className={`stage-chord${s.id === scale.id ? ' stage-chord-on' : ''}`} onClick={() => onScale(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
