'use client'

/* Reunião — drills silenciosos de mão esquerda, do CAGED Lab, numa tela só. */
import { AudioWaveform, Bug, Eye, Layers, MoveHorizontal, MoveUpRight, TrendingUp } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import type { SeqEvent } from '@/lib/practice/audio'
import { DRILLS, drillData, type DrillIcon } from '@/lib/practice/drills'
import type { Practice } from '@/lib/practice/session'
import type { Settings } from '@/lib/settings'

import { Neck, ROLE_LEGEND } from '../Neck'
import { Tab } from '../Tab'
import { Chip, HowDialog, type HowContent } from '../ui'
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

  const circuit = DRILLS.reduce((a, x) => a + x.min, 0)
  const openHow = () =>
    setHow({ title: d.name, how: d.why, steps: d.steps, notes: [`Circuito de ${circuit} min, na ordem dos cards.`, ...TIPS] })

  return (
    <main className="wrap screen">
      <div className="dchips" role="group" aria-label="Drills">
        {DRILLS.map((x) => (
          <button key={x.id} type="button" className={`dchip${x.id === d.id ? ' dchip-on' : ''}`} aria-pressed={x.id === d.id} onClick={() => set('drill')(x.id)}>
            <span className="icon-tile">{ICONS[x.icon]}</span>
            <span>
              <b>{x.name}</b>
              <small>{x.min} min</small>
            </span>
          </button>
        ))}
      </div>

      <div className="card practice screen-fill">
        <PlayerBar
          playing={player.playing}
          bpm={bpm}
          click={click}
          onToggle={player.toggle}
          onBpm={set('bpm')}
          onClick={() => set('click')(!click)}
          onHow={openHow}
        >
          <VisSwitch value={drillVis} onChange={set('drillVis')} />
        </PlayerBar>
        <div className="chips">
          {data.opts.items.map((it) => (
            <Chip key={String(it.v)} label={it.label} on={it.v === data.opts.value} onPress={() => patch({ [data.opts.key]: it.v })} />
          ))}
        </div>
        {drillVis !== 'neck' && <Tab bars={data.bars} cols={data.cols} now={player.now?.key ?? null} strip={drillVis === 'both'} />}
        {drillVis !== 'tab' && (
          <Neck
            marks={data.marks}
            windows={data.windows}
            focus={data.focus}
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

      <HowDialog content={how} onClose={() => setHow(null)} />
    </main>
  )
}
