/* O som do treino: violão sintetizado (Karplus-Strong), em loop, com clique.
 *
 * Do CAGED Lab. A nota dura até a próxima e é abafada em 60 ms, como a mão faz
 * no violão — senão as colcheias embolam. O agendamento olha 150 ms à frente a
 * cada 25 ms, e a tela acende o que está soando quando o relógio do áudio chega lá.
 */
import { OPEN } from './caged'
import type { Bar, TabEvent } from './session'

export interface SeqEvent {
  beat: number
  /** Índice do compasso e coluna: a chave da casa acesa na tab. */
  bi: number
  col: number
  notes: TabEvent['notes']
  ci: number | null
  follow?: TabEvent['follow']
  dur: number
}

export interface Seq {
  evs: SeqEvent[]
  len: number
}

export function buildSeq(bars: Bar[], cols: number): Seq {
  const per = 4 / cols
  const evs: SeqEvent[] = []
  bars.forEach((b, bi) =>
    b.events.forEach((e) => evs.push({ beat: bi * 4 + e.col * per, bi, col: e.col, notes: e.notes, ci: b.ci, follow: e.follow, dur: 0 })),
  )
  evs.sort((a, b) => a.beat - b.beat)
  const len = bars.length * 4
  evs.forEach((e, i) => {
    const nx = i + 1 < evs.length ? evs[i + 1].beat : len + evs[0].beat
    e.dur = Math.max(0.25, nx - e.beat)
  })
  return { evs, len }
}

type AC = typeof AudioContext

export class Player {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private cache = new Map<number, AudioBuffer>()
  private timer: ReturnType<typeof setInterval> | null = null
  private raf = 0
  private seq: Seq = { evs: [], len: 0 }
  private i = 0
  private loop = 0
  private t0 = 0
  private beatN = 0
  private q: { t: number; e: SeqEvent }[] = []
  private bpm = 70
  playing = false
  click = false
  onEvent: (e: SeqEvent) => void = () => {}

  private ensure() {
    if (!this.ctx) {
      const Ctor: AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: AC }).webkitAudioContext
      const ctx = new Ctor()
      const master = ctx.createGain()
      master.gain.value = 0.9
      const body = ctx.createBiquadFilter()
      body.type = 'peaking'
      body.frequency.value = 190
      body.Q.value = 0.9
      body.gain.value = 5
      const air = ctx.createBiquadFilter()
      air.type = 'lowpass'
      air.frequency.value = 4500
      const comp = ctx.createDynamicsCompressor()
      master.connect(body)
      body.connect(air)
      air.connect(comp)
      comp.connect(ctx.destination)
      this.ctx = ctx
      this.master = master
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  private pluckBuf(midi: number): AudioBuffer {
    const hit = this.cache.get(midi)
    if (hit) return hit
    const ctx = this.ctx!
    const sr = ctx.sampleRate
    const f = 440 * Math.pow(2, (midi - 69) / 12)
    const N = Math.max(2, Math.round(sr / f))
    const len = Math.floor(sr * 1.6)
    const buf = ctx.createBuffer(1, len, sr)
    const d = buf.getChannelData(0)
    const ring = new Float32Array(N)
    let lp = 0
    for (let i = 0; i < N; i++) {
      lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4
      ring[i] = lp * 1.6
    }
    const T60 = midi < 50 ? 2.0 : midi < 62 ? 1.6 : 1.3
    const decay = Math.pow(10, -3 / (f * T60))
    let p = 0
    for (let i = 0; i < len; i++) {
      const a = ring[p]
      const b = ring[(p + 1) % N]
      d[i] = a
      ring[p] = (a + b) * 0.5 * decay
      p = (p + 1) % N
    }
    const fade = Math.floor(sr * 0.08)
    for (let i = len - fade; i < len; i++) d[i] *= (len - i) / fade
    this.cache.set(midi, buf)
    return buf
  }

  /** A nota dura até a próxima e é abafada em 60 ms. */
  private pluck(midi: number, t: number, vel: number, dur: number) {
    const ctx = this.ctx!
    const s = ctx.createBufferSource()
    s.buffer = this.pluckBuf(midi)
    const g = ctx.createGain()
    g.gain.setValueAtTime(vel, t)
    g.gain.setValueAtTime(vel, t + dur)
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.06)
    s.connect(g).connect(this.master!)
    s.start(t)
    s.stop(t + dur + 0.08)
  }

  private tick(t: number, acc: boolean) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'square'
    o.frequency.value = acc ? 1600 : 1100
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(acc ? 0.12 : 0.07, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
    o.connect(g).connect(this.master!)
    o.start(t)
    o.stop(t + 0.07)
  }

  private sched() {
    const ctx = this.ctx!
    const spb = 60 / this.bpm
    const h = ctx.currentTime + 0.15
    const sq = this.seq
    while (sq.evs.length) {
      const e = sq.evs[this.i]
      const t = this.t0 + (this.loop * sq.len + e.beat) * spb
      if (t > h) break
      const chord = e.notes.length > 2
      const dur = Math.min(e.dur, 2) * spb + 0.02
      e.notes
        .slice()
        .sort((a, b) => a.s - b.s)
        .forEach((n, k) => this.pluck(OPEN[n.s] + n.f, t + (chord ? k * 0.014 : 0), chord ? 0.32 : 0.55, dur - (chord ? k * 0.014 : 0)))
      this.q.push({ t, e })
      this.i++
      if (this.i >= sq.evs.length) {
        this.i = 0
        this.loop++
      }
    }
    while (this.t0 + this.beatN * spb <= h) {
      if (this.click) this.tick(this.t0 + this.beatN * spb, this.beatN % 4 === 0)
      this.beatN++
    }
  }

  private drain() {
    if (!this.playing || !this.ctx) return
    const now = this.ctx.currentTime
    let last: { t: number; e: SeqEvent } | null = null
    while (this.q.length && this.q[0].t <= now) last = this.q.shift()!
    if (last) this.onEvent(last.e)
  }

  /** Uma nota avulsa, agora: a casa que o dedo tocou no jogo. */
  pluckNow(midi: number, vel = 0.6) {
    const ctx = this.ensure()
    this.pluck(midi, ctx.currentTime + 0.01, vel, 1.2)
  }

  /** Um bipe curto e grave: errou. */
  buzz() {
    const ctx = this.ensure()
    const t = ctx.currentTime + 0.01
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'triangle'
    o.frequency.setValueAtTime(180, t)
    o.frequency.exponentialRampToValueAtTime(110, t + 0.18)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
    o.connect(g).connect(this.master!)
    o.start(t)
    o.stop(t + 0.25)
  }

  start(seq: Seq, bpm: number) {
    this.stop()
    if (!seq.evs.length) return
    const ctx = this.ensure()
    this.seq = seq
    this.bpm = bpm
    this.i = 0
    this.loop = 0
    this.beatN = 0
    this.q = []
    this.t0 = ctx.currentTime + 0.12
    this.playing = true
    this.timer = setInterval(() => {
      this.sched()
      this.drain()
    }, 25)
    this.sched()
    const frame = () => {
      if (!this.playing) return
      this.drain()
      this.raf = requestAnimationFrame(frame)
    }
    this.raf = requestAnimationFrame(frame)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    cancelAnimationFrame(this.raf)
    this.playing = false
    this.q = []
  }
}
