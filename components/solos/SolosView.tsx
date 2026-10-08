'use client'

/* A aba Solos: a trilha (do fundamento ao avançado, módulo por módulo) e o
 * catálogo (todas as lições por tema, para ir direto ao que se quer melhorar).
 *
 * As lições vêm de ~300 vídeos e artigos, consolidadas e reescritas — o número de
 * fontes de cada uma fica à vista. As que ainda não foram escritas aparecem
 * apagadas, para a trilha mostrar o caminho inteiro desde já.
 */
import { ArrowRight, BookOpen, LayoutGrid, Route } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Chip, Segmented } from '@/components/ui'
import { LESSONS, MODULES } from '@/lib/solos'

import { LessonView } from './LessonView'

const LAST_KEY = 'guitarlab-solos-licao'
const NIVEL: Record<string, string> = { iniciante: 'iniciante', intermediario: 'intermediário', avancado: 'avançado', misto: 'misto' }
type View = 'trilha' | 'catalogo'

const ALL = MODULES.flatMap((m) => m.licoes.map((l) => ({ ...l, modulo: m })))

export function SolosView() {
  const [open, setOpen] = useState<string | null>(null)
  const [view, setView] = useState<View>('trilha')
  const [nivel, setNivel] = useState<string | null>(null)

  useEffect(() => {
    try {
      const last = localStorage.getItem(LAST_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (last && LESSONS[last]) setOpen(last)
    } catch {
      // Sem armazenamento: abre na trilha.
    }
  }, [])

  const go = useCallback((id: string | null) => {
    setOpen(id)
    try {
      if (id) localStorage.setItem(LAST_KEY, id)
      else localStorage.removeItem(LAST_KEY)
    } catch {
      // Sem armazenamento: só não lembra na próxima visita.
    }
    /* Quem rola é a própria tela (o app fica preso na janela), não a página. */
    requestAnimationFrame(() => document.querySelector('.screen.sl')?.scrollTo({ top: 0 }))
  }, [])

  const available = useMemo(() => ALL.filter((l) => LESSONS[l.id]), [])

  if (open && LESSONS[open]) {
    const idx = available.findIndex((l) => l.id === open)
    const nx = available[idx + 1]
    return <LessonView key={open} lesson={LESSONS[open]} onBack={() => go(null)} next={nx ? { title: nx.nome, onGo: () => go(nx.id) } : null} />
  }

  const totalFontes = 299

  return (
    <main className="wrap screen sl sl-home">
      <header className="sl-home-hero">
        <span className="eyebrow">
          <i />
          <b>{ALL.length} lições</b> · {MODULES.length} módulos · {totalFontes} vídeos e artigos
        </span>
        <h1 className="sl-title">
          Solo e <em>improvisação</em>
        </h1>
        <p className="lede">
          O que dezenas de professores ensinam sobre solar, reunido, conferido e reescrito em lições com exercícios que tocam. Siga a trilha ou vá direto ao que quer melhorar.
        </p>
        <div className="sl-home-bar">
          <Segmented
            options={[
              { value: 'trilha', label: 'Trilha', icon: <Route size={14} strokeWidth={1.7} /> },
              { value: 'catalogo', label: 'Catálogo', icon: <LayoutGrid size={14} strokeWidth={1.7} /> },
            ]}
            value={view}
            onChange={setView}
          />
          {available.length > 0 && (
            <button type="button" className="btn btn-primary" onClick={() => go(available[0].id)}>
              <BookOpen size={14} strokeWidth={1.8} />
              Abrir uma lição
            </button>
          )}
        </div>
      </header>

      {view === 'trilha' ? (
        <ol className="sl-trail">
          {MODULES.map((m, mi) => {
            const ready = m.licoes.filter((l) => LESSONS[l.id]).length
            return (
              <li key={m.id} className={`sl-mod${ready ? ' sl-mod-on' : ''}`} style={{ ['--i' as string]: mi }}>
                <span className="sl-mod-node">{mi + 1}</span>
                <div className="sl-mod-body">
                  <div className="sl-mod-head">
                    <h2>{m.nome}</h2>
                    <small>{ready ? `${ready} de ${m.licoes.length} prontas` : `${m.licoes.length} lições`}</small>
                  </div>
                  <p>{m.descricao}</p>
                  <div className="sl-mod-lessons">
                    {m.licoes.map((l) =>
                      LESSONS[l.id] ? (
                        <button key={l.id} type="button" className="sl-pill sl-pill-on" onClick={() => go(l.id)}>
                          {l.nome}
                          <ArrowRight size={13} strokeWidth={1.8} />
                        </button>
                      ) : (
                        <span key={l.id} className="sl-pill" title="em breve">
                          {l.nome}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <>
          <div className="chips sl-filter">
            <Chip label="todos os níveis" on={nivel === null} onPress={() => setNivel(null)} />
            {['iniciante', 'intermediario', 'avancado'].map((n) => (
              <Chip key={n} label={NIVEL[n]} on={nivel === n} onPress={() => setNivel(nivel === n ? null : n)} />
            ))}
          </div>
          <div className="sl-cat">
            {ALL.filter((l) => !nivel || l.nivel === nivel).map((l) => {
              const ready = !!LESSONS[l.id]
              return (
                <button key={l.id} type="button" className={`sl-card card${ready ? ' sl-card-on' : ''}`} disabled={!ready} onClick={() => go(l.id)}>
                  <small className="sl-card-mod">{l.modulo.nome}</small>
                  <b>{l.nome}</b>
                  <span className="sl-card-desc">{l.descricao}</span>
                  <span className="sl-card-foot">
                    <span className={`sl-tag sl-tag-${l.nivel}`}>{NIVEL[l.nivel] ?? l.nivel}</span>
                    <span>{l.fontes} fontes</span>
                    {ready ? <span className="sl-card-go">abrir</span> : <span className="sl-card-soon">em breve</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </main>
  )
}
