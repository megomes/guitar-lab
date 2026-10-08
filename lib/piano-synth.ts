/* O som do Piano Lab: um piano elétrico sintetizado, simples.
 *
 * Do ChordLab veio a ideia (o controlador MIDI quase nunca tem som próprio, então o
 * app precisa soar). O timbre é outro: o ataque com um pouco de brilho e um
 * decaimento longo, como corda de piano, em vez do órgão sustentado de lá.
 */
const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

interface Voice {
  gain: GainNode
  oscs: OscillatorNode[]
}

type AC = typeof AudioContext

export class PianoSynth {
  private ctx: AudioContext | null = null
  private bus: GainNode | null = null
  private voices = new Map<number, Voice>()
  private timers: ReturnType<typeof setTimeout>[] = []
  enabled = true

  private ensure() {
    if (!this.ctx) {
      const Ctor: AC | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext
      if (!Ctor) return null
      const ctx = new Ctor()
      const bus = ctx.createGain()
      bus.gain.value = 0.8
      const comp = ctx.createDynamicsCompressor()
      bus.connect(comp)
      comp.connect(ctx.destination)
      this.ctx = ctx
      this.bus = bus
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  noteOn(midi: number, velocity = 96) {
    if (!this.enabled) return
    const ctx = this.ensure()
    if (!ctx || !this.bus) return
    this.kill(midi, 0.03)
    const now = ctx.currentTime
    const f = freq(midi)
    const peak = Math.min(1, velocity / 127) * 0.16

    /* O brilho fecha com o tempo: o ataque tem harmônicos, a cauda é quase seno. */
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.Q.value = 0.4
    filter.frequency.setValueAtTime(Math.min(9000, f * 9), now)
    filter.frequency.exponentialRampToValueAtTime(Math.max(400, f * 2.2), now + 1.4)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.006)
    gain.gain.exponentialRampToValueAtTime(peak * 0.45, now + 0.4)
    /* Nota grave dura mais, como no piano. */
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2 + Math.max(0, (72 - midi) / 24))

    const partials: [OscillatorType, number, number, number][] = [
      ['triangle', 1, 0, 1],
      ['sine', 2, 3, 0.35],
      ['sine', 1, -4, 0.4],
    ]
    const oscs = partials.map(([type, mult, detune, level]) => {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.value = f * mult
      o.detune.value = detune
      const g = ctx.createGain()
      g.gain.value = level
      o.connect(g).connect(filter)
      o.start(now)
      o.stop(now + 4)
      return o
    })
    filter.connect(gain).connect(this.bus)
    this.voices.set(midi, { gain, oscs })
  }

  noteOff(midi: number) {
    this.kill(midi, 0.25)
  }

  private kill(midi: number, release: number) {
    const v = this.voices.get(midi)
    const ctx = this.ctx
    if (!v || !ctx) return
    this.voices.delete(midi)
    const now = ctx.currentTime
    try {
      v.gain.gain.cancelScheduledValues(now)
      v.gain.gain.setValueAtTime(Math.max(v.gain.gain.value, 0.0001), now)
      v.gain.gain.exponentialRampToValueAtTime(0.0001, now + release)
      v.oscs.forEach((o) => o.stop(now + release + 0.05))
    } catch {
      // A voz já tinha parado.
    }
  }

  /** Uma nota que se solta sozinha. */
  tap(midi: number, hold = 900) {
    this.noteOn(midi)
    this.timers.push(setTimeout(() => this.noteOff(midi), hold))
  }

  /**
   * Notas em sequência (escala, arpejo) ou juntas (gap 0). `onStep` diz qual está
   * soando, para a tecla acender junto; recebe null no fim.
   */
  play(notes: number[], { gap = 0, hold, onStep }: { gap?: number; hold?: number; onStep?: (midi: number | null) => void } = {}) {
    this.stop()
    if (!this.ensure()) return
    /* Sem `hold`, cada nota da sequência dura até perto da próxima. */
    const len = hold ?? (gap ? Math.max(gap * 1.6, 200) : 900)
    notes.forEach((m, i) =>
      this.timers.push(
        setTimeout(() => {
          this.noteOn(m)
          onStep?.(m)
          this.timers.push(setTimeout(() => this.noteOff(m), len))
        }, i * gap),
      ),
    )
    this.timers.push(setTimeout(() => onStep?.(null), hold !== undefined ? (notes.length - 1) * gap + hold : notes.length * gap + (gap || len)))
  }

  stop() {
    this.timers.forEach(clearTimeout)
    this.timers = []
  }

  dispose() {
    this.stop()
    void this.ctx?.close()
    this.ctx = null
    this.voices.clear()
  }
}
