'use client'

/* Uma lição da aba Solos, de cima para baixo: por que importa, o conceito em
 * blocos curtos (cada um com o seu braço ou tab), os trechos de vídeo que valem a
 * pena — no minuto exato, aqui dentro —, os exercícios com som e o resumo.
 *
 * Os exercícios marcados como feitos ficam no navegador; a barra do topo mostra
 * quanto falta. Os blocos entram na tela devagar, uma vez só.
 */
import { ArrowLeft, ArrowRight, Check, Clock, ExternalLink, FileText, Lightbulb, Play, Quote, TriangleAlert, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import type { LabelMode } from '@/components/Fretboard'
import { Segmented } from '@/components/ui'
import type { LSource, Lesson } from '@/lib/solos/types'

import { Illustration } from './Illustration'
import { Visual } from './Visual'

const DONE_KEY = 'guitarlab-solos-feitos'
const NIVEL: Record<string, string> = { iniciante: 'iniciante', intermediario: 'intermediário', avancado: 'avançado' }

const LABEL_OPTIONS: { value: LabelMode; label: string }[] = [
  { value: 'degree', label: 'graus' },
  { value: 'note', label: 'notas' },
  { value: 'both', label: 'notas + graus' },
]

function loadDone(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

/** Entra na tela uma vez, subindo um pouco. */
function Reveal({ children, className = '', as: Tag = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  const ref = useRef<HTMLElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <Tag ref={ref as never} className={`sl-reveal${shown ? ' sl-in' : ''} ${className}`}>
      {children}
    </Tag>
  )
}

const fmt = (s: LSource) => s.momento ?? ''
const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`

/** O trecho do vídeo, aqui dentro, já no minuto em que o professor fala. */
function VideoDialog({ src, onClose }: { src: LSource | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (src && !d.open) d.showModal()
    if (!src && d.open) d.close()
  }, [src])
  return (
    <dialog ref={ref} className="dlg sl-video" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      {src?.video && (
        <div className="sl-video-in">
          <div className="dlg-h">
            <h3>
              {src.autor} <small>· {src.titulo}</small>
            </h3>
            <button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose}>
              <X size={16} strokeWidth={1.8} />
            </button>
          </div>
          <div className="sl-video-frame">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${src.video}?start=${src.inicio ?? 0}&autoplay=1&rel=0`}
              title={src.titulo}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
          <a className="sl-video-out" href={src.url} target="_blank" rel="noreferrer">
            Abrir no YouTube <ExternalLink size={13} strokeWidth={1.8} />
          </a>
        </div>
      )}
    </dialog>
  )
}

function SourceCard({ s, why, onPlay }: { s: LSource; why: string; onPlay: (s: LSource) => void }) {
  if (!s.video) {
    return (
      <a className="sl-src sl-src-doc" href={s.url} target="_blank" rel="noreferrer">
        <span className="sl-src-doc-ico">
          <FileText size={22} strokeWidth={1.5} />
        </span>
        <span className="sl-src-body">
          <b>{s.autor || 'Artigo'}</b>
          <small>{s.titulo}</small>
          <span className="sl-src-why">{why}</span>
        </span>
      </a>
    )
  }
  return (
    <button type="button" className="sl-src" onClick={() => onPlay(s)}>
      <span className="sl-src-thumb" style={{ backgroundImage: `url(${thumb(s.video)})` }}>
        <span className="sl-src-play">
          <Play size={14} fill="currentColor" strokeWidth={0} />
          {fmt(s)}
        </span>
      </span>
      <span className="sl-src-body">
        <b>{s.autor}</b>
        <small>{s.titulo}</small>
        <span className="sl-src-why">{why}</span>
      </span>
    </button>
  )
}

/** "inspirado em": as fontes do exercício, cada uma abre no minuto certo. */
function SourceChips({ list, onPlay }: { list: LSource[]; onPlay: (s: LSource) => void }) {
  if (!list.length) return null
  return (
    <div className="sl-insp">
      <span>inspirado em</span>
      {list.map((s) =>
        s.video ? (
          <button key={s.id} type="button" className="sl-insp-chip" onClick={() => onPlay(s)} title={s.ideia}>
            <Play size={10} fill="currentColor" strokeWidth={0} />
            {s.autor} {s.momento && <em>{s.momento}</em>}
          </button>
        ) : (
          <a key={s.id} className="sl-insp-chip" href={s.url} target="_blank" rel="noreferrer" title={s.ideia}>
            {s.autor || s.titulo}
          </a>
        ),
      )}
    </div>
  )
}

export function LessonView({ lesson, onBack, next }: { lesson: Lesson; onBack: () => void; next?: { title: string; onGo: () => void } | null }) {
  const id = lesson._meta.subcategoria
  const [labelMode, setLabelMode] = useState<LabelMode>('degree')
  const [video, setVideo] = useState<LSource | null>(null)
  const [done, setDone] = useState<Set<string>>(() => new Set())
  const [openEx, setOpenEx] = useState(0)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDone(loadDone())
  }, [])

  const toggleDone = useCallback(
    (i: number) => {
      setDone((prev) => {
        const nx = new Set(prev)
        const k = `${id}:${i}`
        if (nx.has(k)) nx.delete(k)
        else nx.add(k)
        try {
          localStorage.setItem(DONE_KEY, JSON.stringify([...nx]))
        } catch {
          // Sem armazenamento: vale só nesta visita.
        }
        return nx
      })
      setOpenEx(i + 1)
    },
    [id],
  )

  const total = lesson.exercicios.length
  const feitos = lesson.exercicios.filter((_, i) => done.has(`${id}:${i}`)).length
  const [first, ...rest] = lesson.titulo.split(' ')

  return (
    <main className="wrap screen sl">
      <div className="sl-top">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          <ArrowLeft size={14} strokeWidth={1.8} />
          Trilha
        </button>
        <span className="eyebrow">
          <i />
          <b>{lesson._meta.modulo.nome}</b> · {lesson._meta.subcategoria}
        </span>
        <span className="spacer" />
        <div className="sl-progress" title="exercícios feitos">
          <span>
            {feitos}/{total} exercícios
          </span>
          <span className="sl-progress-bar">
            <i style={{ width: `${total ? (feitos / total) * 100 : 0}%` }} />
          </span>
        </div>
      </div>

      <header className="sl-hero card">
        <div className="sl-hero-text">
          <h1 className="sl-title">
            {first} <em>{rest.join(' ')}</em>
          </h1>
          <p className="sl-hook">{lesson.gancho}</p>
          <p className="lede">{lesson.porque_importa}</p>
          <nav className="sl-anchors" aria-label="nesta lição">
            <a href="#conceito">Conceito</a>
            <a href="#fontes">Com quem aprender</a>
            <a href="#exercicios">Exercícios</a>
            <a href="#resumo">Resumo</a>
          </nav>
        </div>
        <div className="sl-hero-art">
          <Illustration kind={lesson.ilustracao} />
        </div>
      </header>

      <div className="sl-labels">
        <span>No braço:</span>
        <Segmented options={LABEL_OPTIONS} value={labelMode} onChange={setLabelMode} />
      </div>

      <h2 className="sl-h2" id="conceito">
        O <em>conceito</em>
      </h2>
      {lesson.conceito.map((c, i) => (
        <Reveal key={i} className="sl-concept card">
          <div className="sl-concept-head">
            <span className="sl-num">{i + 1}</span>
            <h3>{c.titulo}</h3>
          </div>
          <p className="sl-text">{c.texto}</p>
          {c.destaque && (
            <blockquote className="sl-quote">
              <Quote size={16} strokeWidth={1.6} />
              {c.destaque}
            </blockquote>
          )}
          <Visual v={c.visual} labelMode={labelMode} />
        </Reveal>
      ))}

      {lesson.fontes_destaque.length > 0 && (
        <Reveal>
          <h2 className="sl-h2" id="fontes">
            Com quem <em>aprender</em>
          </h2>
          <p className="lede sl-lede">Os trechos que mais valem a pena. Abrem aqui, no minuto em que a ideia aparece.</p>
          <div className="sl-srcs">
            {lesson.fontes_destaque.map((f) => (
              <SourceCard key={f.fonte.id} s={f.fonte} why={f.porque} onPlay={setVideo} />
            ))}
          </div>
        </Reveal>
      )}

      <h2 className="sl-h2" id="exercicios">
        Mãos à <em>obra</em>
      </h2>
      <div className="sl-exs">
        {lesson.exercicios.map((ex, i) => {
          const isDone = done.has(`${id}:${i}`)
          const isOpen = openEx === i
          return (
            <Reveal key={i} as="article" className={`sl-ex card${isOpen ? ' sl-ex-open' : ''}${isDone ? ' sl-ex-done' : ''}`}>
              <button type="button" className="sl-ex-head" aria-expanded={isOpen} onClick={() => setOpenEx(isOpen ? -1 : i)}>
                <span className="sl-ex-num">{isDone ? <Check size={15} strokeWidth={2.4} /> : i + 1}</span>
                <span className="sl-ex-title">
                  <b>{ex.titulo}</b>
                  <small>{ex.objetivo}</small>
                </span>
                <span className={`sl-tag sl-tag-${ex.nivel}`}>{NIVEL[ex.nivel]}</span>
                <span className="sl-ex-min">
                  <Clock size={12} strokeWidth={1.8} />
                  {ex.minutos} min
                </span>
              </button>
              {isOpen && (
                <div className="sl-ex-body">
                  <Visual v={ex.visual} labelMode={labelMode} />
                  <ol className="sl-steps">
                    {ex.passos.map((p, k) => (
                      <li key={k}>{p}</li>
                    ))}
                  </ol>
                  {ex.cuidado && (
                    <div className="sl-careful">
                      <TriangleAlert size={15} strokeWidth={1.8} />
                      <span>{ex.cuidado}</span>
                    </div>
                  )}
                  {ex.variacoes.length > 0 && (
                    <div className="sl-vars">
                      <b>Quando ficar fácil</b>
                      <ul>
                        {ex.variacoes.map((v, k) => (
                          <li key={k}>{v}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="sl-ex-foot">
                    <SourceChips list={ex.inspirado_em} onPlay={setVideo} />
                    <span className="spacer" />
                    <button type="button" className={`btn ${isDone ? 'btn-on' : 'btn-primary'}`} onClick={() => toggleDone(i)}>
                      <Check size={14} strokeWidth={2.2} />
                      {isDone ? 'Feito' : 'Marcar como feito'}
                    </button>
                  </div>
                </div>
              )}
            </Reveal>
          )
        })}
      </div>

      <div className="sl-end" id="resumo">
        <Reveal className="card sl-sum">
          <h2 className="sl-h3">
            <Lightbulb size={16} strokeWidth={1.7} />
            Para levar
          </h2>
          <ul>
            {lesson.resumo.map((r, k) => (
              <li key={k}>{r}</li>
            ))}
          </ul>
        </Reveal>
        <Reveal className="card sl-errs">
          <h2 className="sl-h3">
            <TriangleAlert size={16} strokeWidth={1.7} />
            Erros comuns
          </h2>
          <ul>
            {lesson.erros_comuns.map((r, k) => (
              <li key={k}>{r}</li>
            ))}
          </ul>
        </Reveal>
      </div>

      <Reveal className="sl-next card glass">
        <div>
          <small>Próximos passos</small>
          <p>{lesson.proximos_passos}</p>
        </div>
        {next && (
          <button type="button" className="btn btn-ghost sl-next-btn" onClick={next.onGo}>
            {next.title}
            <ArrowRight size={14} strokeWidth={1.8} />
          </button>
        )}
      </Reveal>

      <VideoDialog src={video} onClose={() => setVideo(null)} />
    </main>
  )
}
