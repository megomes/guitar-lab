'use client'

/* Guitar Lab — o Fretlab e o CAGED Lab num app só.
 *
 * Consulta (Escalas, Acordes, Notas) e Treino (Prática, Reunião, Plano) olham
 * para a mesma tônica e a mesma forma CAGED, desenham o mesmo braço com as
 * mesmas cores e escrevem as notas do mesmo jeito. Trocar a forma numa tela
 * troca nas outras; os botões de ponte levam de uma metade para a outra sem
 * perder o lugar.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'

import { chordIntervals } from '@/lib/chords'
import { SCALES, shapeLabel } from '@/lib/fretboard'
import { INSTRUMENT_NAME, MODES, instrumentOf, type Instrument, type ModeId } from '@/lib/modes'
import { PROG_BY } from '@/lib/practice/caged'
import { computePractice, modeName, tonicName } from '@/lib/practice/session'
import { DEFAULTS, STORAGE_KEY, loadSettings, type Settings } from '@/lib/settings'
import { isMinorish, namesForScale, namesForTonic, sharpNames } from '@/lib/spelling'

import { ChordsV3 } from './consult/ChordsV3'
import { ConsultView } from './consult/ConsultView'
import { NamesContext } from './names'
import { PianoGame } from './piano/PianoGame'
import { PianoView } from './piano/PianoView'
import { MeetingView } from './practice/MeetingView'
import { PlanView } from './practice/PlanView'
import { PracticeView } from './practice/PracticeView'
import { QuizView } from './quiz/QuizView'
import { SolosView } from './solos/SolosView'
import { Nav, TabBar } from './Shell'

export function GuitarLab() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [loaded, setLoaded] = useState(false)

  /* O servidor não sabe o que ficou salvo no navegador: a primeira pintura sai
     com o padrão e a escolha salva entra logo depois. */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(loadSettings())
    setLoaded(true)
  }, [])

  /* Instalado, o navegador deixa travar deitado (o manifest pede o mesmo, mas só
     vale depois de reinstalar). Na aba ele recusa, e o CSS gira o app no lugar. */
  useEffect(() => {
    try {
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
      o.lock?.('landscape').catch(() => {})
    } catch {
      // Sem a API: o CSS gira.
    }
  }, [])

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // Sem armazenamento (aba anônima, cota): a escolha só não sobrevive.
    }
  }, [settings, loaded])

  const set = useCallback(
    <K extends keyof Settings>(key: K) =>
      (value: Settings[K]) =>
        setSettings((s) => ({ ...s, [key]: value })),
    [],
  )
  const patch = useCallback((p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p })), [])

  const goTop = () => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      window.scrollTo(0, 0)
    }
  }

  const setMode = useCallback((mode: ModeId) => {
    setSettings((s) => ({ ...s, mode }))
    goTop()
  }, [])

  const { mode, rootPc, shape, scaleId, quality, tonality, prog } = settings
  const instrument = instrumentOf(mode)

  /* O seletor do topo: volta para a tela onde o outro instrumento ficou. */
  const setInstrument = useCallback((i: Instrument) => {
    setSettings((s) => (instrumentOf(s.mode) === i ? s : { ...s, mode: s.otherMode, otherMode: s.mode }))
    goTop()
  }, [])

  /* O nome da aba segue o instrumento. Os metadados do Next escrevem "Guitar Lab"
     depois da hidratação, então o título é reaplicado quando muda por fora. */
  useEffect(() => {
    const name = INSTRUMENT_NAME[instrument]
    const apply = () => {
      if (document.title !== name) document.title = name
    }
    apply()
    const obs = new MutationObserver(apply)
    obs.observe(document.head, { childList: true, subtree: true, characterData: true })
    return () => obs.disconnect()
  }, [instrument])

  const group = MODES.find((m) => m.id === mode)?.group ?? 'consulta'
  const scale = useMemo(() => SCALES.find((s) => s.id === scaleId) ?? SCALES[0], [scaleId])
  const pScale = useMemo(() => SCALES.find((s) => s.id === settings.pScaleId) ?? SCALES[0], [settings.pScaleId])

  /* A posição do treino: calculada uma vez e dividida pelas três telas. */
  const P = useMemo(
    () => computePractice(rootPc, tonality, prog, shape, settings.shapeOct, settings.diagString),
    [rootPc, tonality, prog, shape, settings.shapeOct, settings.diagString],
  )

  const names = useMemo(() => {
    if (mode === 'scales') return namesForScale(rootPc, scale.intervals)
    if (mode === 'chords') return namesForTonic(rootPc, isMinorish(chordIntervals(quality)))
    /* As oito formas misturam maiores e menores: a grafia é a da tônica como tom maior. */
    if (mode === 'chords3') return namesForTonic(rootPc, false)
    if (mode === 'notes') return sharpNames
    if (mode === 'pChords') return namesForTonic(rootPc, isMinorish(chordIntervals(settings.pQuality)))
    if (mode === 'pScales') return namesForScale(rootPc, pScale.intervals)
    /* O jogo escolhe a grafia sozinho, pelo tom ou pelo acorde sorteado. */
    if (mode === 'pGame') return sharpNames
    return P.names
  }, [mode, rootPc, scale, quality, P, settings.pQuality, pScale])

  /* Da escala para o treino: a tônica e a forma ficam; menor ou maior sai da escala. */
  const toPractice = useCallback(() => {
    setSettings((s) => {
      const sc = SCALES.find((x) => x.id === s.scaleId) ?? SCALES[0]
      const t = s.mode === 'scales' ? (isMinorish(sc.intervals) ? 'min' : 'maj') : s.tonality
      const p = PROG_BY[t].some((x) => x.id === s.prog) ? s.prog : PROG_BY[t][0].id
      /* Vendo a diagonal na consulta, o treino abre no exercício dela. */
      const penta = s.scaleId === 'pentaMinor' || s.scaleId === 'pentaMajor'
      const exercise = s.mode === 'scales' && penta && s.scaleView === 'diag' ? 'diag' : s.exercise
      return { ...s, mode: 'practice', tonality: t, prog: p, exercise }
    })
    goTop()
  }, [])

  /* Do treino para a consulta: a pentatônica do tom, na mesma forma. */
  const toConsult = useCallback(() => {
    setSettings((s) => ({ ...s, mode: 'scales', scaleId: s.tonality === 'min' ? 'pentaMinor' : 'pentaMajor', lookup: null }))
    goTop()
  }, [])

  /* Do mapa de notas para o jogo, com as mesmas notas — e de volta. */
  const toQuiz = useCallback(() => {
    setSettings((s) => ({ ...s, mode: 'quiz', quizPcs: s.mode === 'notes' && s.notePcs.length ? s.notePcs : s.quizPcs }))
    goTop()
  }, [])
  const toNotes = useCallback(() => {
    setSettings((s) => ({ ...s, mode: 'notes', notePcs: s.quizPcs }))
    goTop()
  }, [])

  const context =
    mode === 'pChords'
      ? `${names(rootPc)} · acordes`
      : mode === 'pScales'
      ? `${names(rootPc)} ${pScale.name.toLowerCase()}`
      : mode === 'pGame'
      ? 'Jogo de acordes'
      : mode === 'solos'
      ? 'Solo e improvisação'
      : mode === 'quiz'
      ? `${settings.quizPcs.length} notas · ${settings.quizStrings.length} cordas`
      : group === 'treino'
      ? `${tonicName(P)} ${modeName(P)} · forma ${P.pos.label}`
      : mode === 'chords3'
        ? `${names(rootPc)} · formas para decorar`
      : mode === 'notes'
        ? `${settings.notePcs.length} notas`
        : `${names(rootPc)} · forma ${shapeLabel(shape, isMinorish(mode === 'scales' ? scale.intervals : chordIntervals(quality)))}`

  const cta =
    instrument === 'piano'
      ? undefined
      : mode === 'notes'
      ? { label: 'Jogar', onPress: toQuiz }
      : mode === 'quiz'
        ? { label: 'Ver as notas', onPress: toNotes }
        : group === 'consulta'
          ? { label: 'Praticar', onPress: toPractice }
          : { label: 'Consultar', onPress: toConsult }

  return (
    <NamesContext.Provider value={names}>
      <div className="app" data-inst={instrument}>
        <div className="backdrop" aria-hidden />
        <Nav
          mode={mode}
          onMode={setMode}
          context={context}
          cta={cta}
          onInstrument={setInstrument}
        />

        {mode === 'chords3' && <ChordsV3 settings={settings} set={set} />}
        {group === 'consulta' && mode !== 'chords3' && <ConsultView settings={settings} set={set} patch={patch} onPractice={toPractice} onQuiz={toQuiz} />}
        {mode === 'quiz' && <QuizView settings={settings} set={set} patch={patch} />}
        {mode === 'solos' && <SolosView />}
        {mode === 'pChords' && <PianoView view="chords" settings={settings} set={set} patch={patch} />}
        {mode === 'pScales' && <PianoView view="scales" settings={settings} set={set} patch={patch} />}
        {mode === 'pGame' && <PianoGame settings={settings} set={set} />}
        {mode === 'practice' && <PracticeView P={P} settings={settings} set={set} patch={patch} onConsult={toConsult} />}
        {mode === 'meeting' && <MeetingView P={P} settings={settings} set={set} patch={patch} />}
        {mode === 'plan' && (
          <PlanView
            P={P}
            onExercise={(exercise) => {
              patch({ exercise, mode: 'practice' })
              goTop()
            }}
            onPosition={(s) => {
              patch({ shape: s, mode: 'practice' })
              goTop()
            }}
            onLoad={(load) => {
              patch({ tonality: load.tonality, prog: load.prog, rootPc: load.tonicPc, chordSel: 0, mode: 'practice' })
              goTop()
            }}
          />
        )}

        <TabBar mode={mode} onMode={setMode} cta={cta} onInstrument={setInstrument} />
      </div>
    </NamesContext.Provider>
  )
}
