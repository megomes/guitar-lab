'use client'

/* O tocador em React: começa, para, e recomeça quando o exercício ou o BPM muda.
 * A nota que está soando volta como estado, para a tab e o braço acenderem. */
import { useCallback, useEffect, useRef, useState } from 'react'

import { Player, buildSeq, type SeqEvent } from '@/lib/practice/audio'
import type { Bar } from '@/lib/practice/session'

export interface NowPlaying {
  key: string
  pins: { string: number; fret: number }[]
}

export function usePlayer(bars: Bar[], cols: number, bpm: number, click: boolean, onEvent?: (e: SeqEvent) => void) {
  const player = useRef<Player | null>(null)
  const [playing, setPlaying] = useState(false)
  const [now, setNow] = useState<NowPlaying | null>(null)
  const handler = useRef(onEvent)

  useEffect(() => {
    handler.current = onEvent
  }, [onEvent])

  const get = () => {
    if (!player.current) {
      player.current = new Player()
    }
    return player.current
  }

  /* Uma assinatura dos compassos: mudar o acorde em foco não mexe no que soa, então não recomeça. */
  const signature = JSON.stringify(bars.map((b) => b.events.map((e) => [e.col, e.notes.map((n) => [n.s, n.f])])))

  const start = useCallback(() => {
    const p = get()
    p.click = click
    p.onEvent = (e) => {
      setNow({ key: `${e.bi}:${e.col}`, pins: e.notes.map((n) => ({ string: n.s, fret: n.f })) })
      handler.current?.(e)
    }
    p.start(buildSeq(bars, cols), bpm)
    setPlaying(p.playing)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, cols, bpm])

  const stop = useCallback(() => {
    player.current?.stop()
    setPlaying(false)
    setNow(null)
  }, [])

  const toggle = useCallback(() => (player.current?.playing ? stop() : start()), [start, stop])

  /* Exercício ou andamento novo com o som ligado: recomeça do início. */
  useEffect(() => {
    if (player.current?.playing) start()
  }, [start])

  useEffect(() => {
    if (player.current) player.current.click = click
  }, [click])

  useEffect(() => () => player.current?.stop(), [])

  return { playing, now, toggle, stop }
}
