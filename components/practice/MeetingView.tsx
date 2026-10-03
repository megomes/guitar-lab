'use client'

/* Reunião — drills silenciosos de mão esquerda, do CAGED Lab. */
import { AudioWaveform, Bug, Check, Eye, Layers, MoveHorizontal, MoveUpRight, TrendingUp } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import type { SeqEvent } from '@/lib/practice/audio'
import { DRILLS, drillData, type DrillIcon } from '@/lib/practice/drills'
import type { Practice } from '@/lib/practice/session'
import type { Settings } from '@/lib/settings'

import { Neck, ROLE_LEGEND } from '../Neck'
import { Tab } from '../Tab'
import { Chip, Eyebrow, HowDialog, type HowContent } from '../ui'
import { PlayerBar, VisSwitch } from './PlayerBar'
import { usePlayer } from './usePlayer'
import { useSpaceToPlay } from './useSpaceToPlay'

type Setter = <K extends keyof Settings>(key: K) => (value: Settings[K]) => void

const ICONS: Record<DrillIcon, React.ReactNode> = {
  ladder: <TrendingUp size={17} strokeWidth={1.6} />,
  layers: <Layers size={17} strokeWidth={1.6} />,
  move: <MoveHorizontal size={17} strokeWidth={1.6} />,
  spider: <Bug size={17} strokeWidth={1.6} />,
  wave: <AudioWaveform size={17} strokeWidth={1.6} />,
  diag: <MoveUpRight size={17} strokeWidth={1.6} />,
  eye: <Eye size={17} strokeWidth={1.6} />,
}

const TIPS = [
  'Guitarra desplugada, mão direita abafando as cordas.',
  'Microfone no mudo: hammer-on faz barulho.',
  'Decore o padrão e tire o olho da tela.',
  'Se a reunião pedir atenção, pare.',
]

export function MeetingView({ P, settings, set, patch }: { P: Practice; settings: Settings; set: Setter; patch: (p: Partial<Settings>) => void }) {
  const { drill, drillVis, bpm, click, labelMode, showOutside } = settings
  const d = DRILLS.find((x) => x.id === drill) ?? DRILLS[0]
  const [how, setHow] = useState<HowContent | null>(null)

  const data = useMemo(
    () => drillData(d.id, P, settings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d.id, P, settings.cagedSel, settings.accSel, settings.invSet, settings.perm, settings.box, settings.diag, settings.rootSel],
  )

  /* A escada e os acordes acompanham o som: a forma que soa é a que o braço mostra. */
  const follow = useCallback(
    (e: SeqEvent) => {
      if (e.follow) patch({ [e.follow.k]: e.follow.v })
    },
    [patch],
  )
  const player = usePlayer(data.bars, data.cols, bpm, click, follow)
  useSpaceToPlay(player.toggle)

  return (
    <main className="wrap stack">
      <section className="intro">
        <Eyebrow group="Treino · Reunião">{` · ${P.tonicChord.name}, posição ${P.pos.id}`}</Eyebrow>
        <h1 className="headline">
          Mão esquerda <em>no automático</em>
        </h1>
        <p className="lede">Desplugado e sem som. Circuito de {DRILLS.reduce((a, x) => a + x.min, 0)} min, na ordem dos cards.</p>
      </section>

      <div className="dchips">
        {DRILLS.map((x, i) => (
          <button key={x.id} type="button" className={`dchip${x.id === d.id ? ' dchip-on' : ''}`} aria-pressed={x.id === d.id} onClick={() => set('drill')(x.id)}>
            <span className="icon-tile">{ICONS[x.icon]}</span>
            <span>
              <b>{x.name}</b>
              <small>{x.min} min</small>
            </span>
            <span className="n">{i + 1}</span>
          </button>
        ))}
      </div>

      <div className="card practice">
        <div className="player">
          <VisSwitch value={drillVis} onChange={set('drillVis')} />
          <div className="chips chips-scroll" style={{ flex: 1 }}>
            {data.opts.items.map((it) => (
              <Chip key={String(it.v)} label={it.label} on={it.v === data.opts.value} onPress={() => patch({ [data.opts.key]: it.v })} />
            ))}
          </div>
        </div>
        <PlayerBar
          playing={player.playing}
          bpm={bpm}
          click={click}
          onToggle={player.toggle}
          onBpm={set('bpm')}
          onClick={() => set('click')(!click)}
          onHow={() => setHow({ title: d.name, how: d.why, steps: d.steps })}
        />
        {drillVis !== 'neck' && <Tab bars={data.bars} cols={data.cols} now={player.now?.key ?? null} />}
        {drillVis !== 'tab' && (
          <Neck
            marks={data.marks}
            windows={data.windows}
            focus={data.focus}
            shifts={data.shifts}
            frets={data.frets}
            now={player.now?.pins}
            legend={data.legend.length ? data.legend : ROLE_LEGEND}
            labelMode={labelMode}
            showOutside={showOutside}
            outsideLabel={null}
            onLabelMode={set('labelMode')}
            onShowOutside={set('showOutside')}
          />
        )}
      </div>

      <div className="card tips">
        {TIPS.map((t) => (
          <span key={t}>
            <Check size={15} strokeWidth={2} />
            {t}
          </span>
        ))}
      </div>

      <HowDialog content={how} onClose={() => setHow(null)} />
    </main>
  )
}
