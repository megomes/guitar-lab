'use client'

/* As notas tocadas, de onde vierem: controlador MIDI, teclado do computador ou o
 * dedo na tela. Do ChordLab, sem o login nem o resto. */
import { useCallback, useEffect, useRef, useState } from 'react'

import { HIGH_NOTE, LOW_NOTE } from '@/lib/piano'

export type MidiStatus = 'idle' | 'connecting' | 'connected' | 'empty' | 'denied' | 'unsupported'

/** O teclado do computador vira duas oitavas e pouco: Z…M e Q…P, com as pretas em cima. */
const PC_KEYMAP: Record<string, number> = {
  z: 48, s: 49, x: 50, d: 51, c: 52, v: 53, g: 54, b: 55, h: 56, n: 57, j: 58, m: 59,
  q: 60, '2': 61, w: 62, '3': 63, e: 64, r: 65, '5': 66, t: 67, '6': 68, y: 69, '7': 70, u: 71,
  i: 72, '9': 73, o: 74, '0': 75, p: 76,
}

interface Handlers {
  onNoteOn?: (midi: number, velocity: number) => void
  onNoteOff?: (midi: number) => void
}

export function useNoteInput({ onNoteOn, onNoteOff }: Handlers = {}) {
  const [pressed, setPressed] = useState<number[]>([])
  const [status, setStatus] = useState<MidiStatus>('idle')
  const [devices, setDevices] = useState<string[]>([])

  const handlers = useRef<Handlers>({ onNoteOn, onNoteOff })
  useEffect(() => {
    handlers.current = { onNoteOn, onNoteOff }
  })
  const held = useRef(new Set<number>())

  const noteOn = useCallback((midi: number, velocity = 96) => {
    if (midi < LOW_NOTE - 24 || midi > HIGH_NOTE + 24 || held.current.has(midi)) return
    held.current.add(midi)
    setPressed([...held.current].sort((a, b) => a - b))
    handlers.current.onNoteOn?.(midi, velocity)
  }, [])

  const noteOff = useCallback((midi: number) => {
    if (!held.current.has(midi)) return
    held.current.delete(midi)
    setPressed([...held.current].sort((a, b) => a - b))
    handlers.current.onNoteOff?.(midi)
  }, [])

  const releaseAll = useCallback(() => {
    for (const midi of Array.from(held.current)) noteOff(midi)
  }, [noteOff])

  /* ── Web MIDI ───────────────────────────────────────────────────────── */
  const access = useRef<MIDIAccess | null>(null)

  const bind = useCallback(() => {
    const a = access.current
    if (!a) return
    const names: string[] = []
    a.inputs.forEach((input) => {
      input.onmidimessage = (event: MIDIMessageEvent) => {
        const d = event.data
        if (!d) return
        const cmd = d[0] & 0xf0
        if (cmd === 0x90 && d[2] > 0) noteOn(d[1], d[2])
        else if (cmd === 0x80 || (cmd === 0x90 && d[2] === 0)) noteOff(d[1])
        else if (cmd === 0xb0 && (d[1] === 123 || d[1] === 120)) releaseAll()
      }
      names.push(input.name ?? 'MIDI')
    })
    setDevices(names)
    setStatus(names.length ? 'connected' : 'empty')
  }, [noteOn, noteOff, releaseAll])

  const connectMidi = useCallback(async () => {
    if (!navigator.requestMIDIAccess) {
      setStatus('unsupported')
      return
    }
    setStatus('connecting')
    try {
      const a = await navigator.requestMIDIAccess({ sysex: false })
      access.current = a
      a.onstatechange = bind
      bind()
    } catch {
      setStatus('denied')
    }
  }, [bind])

  /* Se o navegador já guardou a permissão, conecta sozinho. */
  useEffect(() => {
    if (!navigator.requestMIDIAccess) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('unsupported')
      return
    }
    navigator.permissions
      ?.query({ name: 'midi' as PermissionName })
      .then((r) => {
        if (r.state === 'granted') void connectMidi()
      })
      .catch(() => {})
    return () => {
      access.current?.inputs.forEach((input) => (input.onmidimessage = null))
    }
  }, [connectMidi])

  /* ── Teclado do computador ──────────────────────────────────────────── */
  useEffect(() => {
    const down = new Set<string>()
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')
    }
    const onDown = (e: KeyboardEvent) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      const key = e.key.toLowerCase()
      const midi = PC_KEYMAP[key]
      if (midi === undefined || down.has(key)) return
      down.add(key)
      e.preventDefault()
      noteOn(midi)
    }
    const onUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      const midi = PC_KEYMAP[key]
      if (midi === undefined) return
      down.delete(key)
      noteOff(midi)
    }
    const onBlur = () => {
      down.clear()
      releaseAll()
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [noteOn, noteOff, releaseAll])

  return { pressed, noteOn, noteOff, releaseAll, status, devices, connectMidi }
}
