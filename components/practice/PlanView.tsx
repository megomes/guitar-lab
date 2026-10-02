'use client'

/* Plano — 30 minutos por noite, do CAGED Lab: os cinco blocos, a rotação das
 * posições e o critério para avançar, com as evoluções do tom em uso. */
import { ArrowUpRight } from 'lucide-react'

import { BLOCKS, blockRanges, evolutions, type Evolution } from '@/lib/practice/plan'
import { shapeOf, type ExerciseId, type Practice } from '@/lib/practice/session'
import type { ShapeId } from '@/lib/fretboard'

import { Eyebrow } from '../ui'

interface Props {
  P: Practice
  onExercise: (ex: ExerciseId) => void
  onPosition: (shape: ShapeId) => void
  onLoad: (load: Evolution['load']) => void
}

export function PlanView({ P, onExercise, onPosition, onLoad }: Props) {
  const ranges = blockRanges()
  const evos = evolutions(P)

  return (
    <main className="wrap stack">
      <section className="intro">
        <Eyebrow group="Treino · Plano">{` · ${P.tonicChord.name}`}</Eyebrow>
        <h1 className="headline">
          30 minutos, <em>toda noite</em>
        </h1>
        <p className="lede">Cinco blocos, uma posição por noite, critério claro para avançar.</p>
      </section>

      <div className="card blocks">
        {BLOCKS.map((b, i) => (
          <div key={b.ex} className="blk">
            <span className="num">{i + 1}</span>
            <div>
              <b>{b.name}</b>
              <p>{b.txt}</p>
              <button type="button" className="lnk" onClick={() => onExercise(b.ex)}>
                abrir
                <ArrowUpRight size={13} strokeWidth={1.8} />
              </button>
            </div>
            <span className="when">
              {ranges[i][0]} a {ranges[i][1]} min
            </span>
          </div>
        ))}
      </div>

      <div className="card pad">
        <h3>
          Rotação da semana: <em>uma posição por noite</em>
        </h3>
        <div className="week">
          {P.positions.map((p) => (
            <button key={p.id} type="button" className={`wk${p.id === P.pos.id ? ' wk-on' : ''}`} onClick={() => onPosition(shapeOf(p))}>
              <b>Noite {p.id}</b>
              <small>forma {p.label}</small>
              <small>
                casas {p.lo} a {p.hi}
              </small>
            </button>
          ))}
          <div className="wk">
            <b>Fim de semana</b>
            <small>jam livre</small>
            <small>trocando de posição</small>
          </div>
        </div>
      </div>

      <div className="card pad">
        <div className="rule">
          <b>Para avançar:</b> 80 BPM sem parar, caindo no alvo em 9 de cada 10 trocas, nas 5 posições. Bateu? Escolha uma evolução:
        </div>
        <div className="evo">
          {evos.map((e, i) => (
            <button key={e.title} type="button" className={i === 1 ? 'glass' : undefined} onClick={() => onLoad(e.load)}>
              <b>{e.title}</b>
              <span>{e.text}</span>
              <span className="evo-go">
                carregar na Prática
                <ArrowUpRight size={13} strokeWidth={1.8} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
