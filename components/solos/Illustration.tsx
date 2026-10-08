'use client'

/* A metáfora do topo de cada lição, desenhada e animada em SVG.
 *
 * Nada aqui é decorativo à toa: "respiração" é a frase que acende nota a nota e
 * para — e a pausa é o que brilha; "gravidade" são notas soltas caindo nos três
 * poços do acorde (tônica, terça, quinta), nas cores que o braço usa. Quem pediu
 * menos movimento no sistema vê o desenho parado.
 */
import { ROLE_COLOR } from '@/lib/roles'
import type { Illustration as Kind } from '@/lib/solos/types'

const A = ROLE_COLOR.root
const T = ROLE_COLOR.third
const F = ROLE_COLOR.fifth
const W = ROLE_COLOR.other

/** Uma frase: notas que acendem em sequência, e depois o silêncio que respira. */
function Breath() {
  const phrase = [
    { x: 40, y: 70 },
    { x: 78, y: 52 },
    { x: 116, y: 60 },
    { x: 154, y: 42 },
  ]
  const answer = [
    { x: 330, y: 50 },
    { x: 368, y: 64 },
    { x: 406, y: 74 },
  ]
  return (
    <svg viewBox="0 0 460 140" className="ill" role="img" aria-label="uma frase, uma pausa que respira, e a resposta">
      <path d="M20 100 H440" className="ill-staff" />
      <path d="M40 70 L78 52 L116 60 L154 42" className="ill-line ill-line-a" />
      {phrase.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="7" fill={i === 3 ? A : W} className="ill-note" style={{ animationDelay: `${i * 0.35}s` }} />
      ))}
      {/* A pausa: o espaço entre as frases é o que pulsa. */}
      <g className="ill-breath">
        <circle cx="242" cy="62" r="26" fill="none" stroke={T} strokeOpacity="0.5" />
        <circle cx="242" cy="62" r="40" fill="none" stroke={T} strokeOpacity="0.22" />
        <text x="242" y="122" textAnchor="middle" className="ill-cap">
          respira
        </text>
      </g>
      <path d="M330 50 L368 64 L406 74" className="ill-line ill-line-b" />
      {answer.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="7" fill={i === 2 ? A : W} className="ill-note" style={{ animationDelay: `${2.4 + i * 0.35}s` }} />
      ))}
    </svg>
  )
}

/** Notas soltas que caem nos poços do acorde: repouso é chegar numa nota do acorde. */
function Gravity() {
  const wells = [
    { x: 110, c: A, l: '1' },
    { x: 230, c: T, l: '3' },
    { x: 350, c: F, l: '5' },
  ]
  const drops = [
    { x: 70, to: 110, d: 0 },
    { x: 200, to: 230, d: 0.9 },
    { x: 390, to: 350, d: 1.8 },
    { x: 150, to: 110, d: 2.7 },
    { x: 280, to: 230, d: 3.6 },
  ]
  return (
    <svg viewBox="0 0 460 150" className="ill" role="img" aria-label="notas caindo nas notas do acorde: tônica, terça e quinta">
      {wells.map((w) => (
        <g key={w.l}>
          <ellipse cx={w.x} cy="122" rx="44" ry="10" fill={w.c} opacity="0.13" className="ill-well" />
          <ellipse cx={w.x} cy="122" rx="20" ry="5" fill={w.c} opacity="0.55" />
          <text x={w.x} y="146" textAnchor="middle" className="ill-cap" fill={w.c}>
            {w.l}
          </text>
        </g>
      ))}
      {drops.map((p, i) => (
        <circle
          key={i}
          r="6"
          fill={W}
          className="ill-drop"
          style={{ ['--x0' as string]: `${p.x}px`, ['--x1' as string]: `${p.to}px`, animationDelay: `${p.d}s` }}
        />
      ))}
    </svg>
  )
}

/** Pergunta e resposta: dois balões que se alternam. */
function Talk() {
  return (
    <svg viewBox="0 0 460 140" className="ill" role="img" aria-label="pergunta e resposta">
      <g className="ill-bubble" style={{ animationDelay: '0s' }}>
        <rect x="30" y="24" width="170" height="54" rx="18" fill="none" stroke={W} strokeOpacity="0.5" />
        {[60, 92, 124, 156].map((x, i) => (
          <circle key={x} cx={x} cy={51 - (i % 2) * 8} r="6" fill={W} />
        ))}
      </g>
      <g className="ill-bubble" style={{ animationDelay: '1.6s' }}>
        <rect x="260" y="62" width="170" height="54" rx="18" fill="none" stroke={A} strokeOpacity="0.6" />
        {[290, 322, 354, 386].map((x, i) => (
          <circle key={x} cx={x} cy={89 + (i % 2) * 6} r="6" fill={i === 3 ? A : W} />
        ))}
      </g>
    </svg>
  )
}

/** Um pedaço de braço que se acende por regiões. */
function NeckMap() {
  return (
    <svg viewBox="0 0 460 140" className="ill" role="img" aria-label="regiões do braço se acendendo">
      {[0, 1, 2, 3, 4, 5].map((s) => (
        <line key={s} x1="20" x2="440" y1={22 + s * 19} y2={22 + s * 19} className="ill-staff" />
      ))}
      {[80, 160, 240, 320, 400].map((x) => (
        <line key={x} x1={x} x2={x} y1="16" y2="124" stroke="rgba(255,255,255,0.12)" />
      ))}
      {[0, 1, 2].map((k) => (
        <rect key={k} x={60 + k * 120} y="14" width="110" height="112" rx="10" fill={[A, T, F][k]} opacity="0.08" className="ill-zone" style={{ animationDelay: `${k * 1.1}s` }} />
      ))}
    </svg>
  )
}

/** Ondas de dinâmica: forte, fraco, forte. */
function Waves() {
  return (
    <svg viewBox="0 0 460 140" className="ill" role="img" aria-label="ondas de intensidade">
      <path d="M20 70 C 80 10, 140 130, 200 70 S 320 10, 440 70" className="ill-line ill-wave" />
      <path d="M20 70 C 80 40, 140 100, 200 70 S 320 40, 440 70" className="ill-line ill-wave ill-wave-2" />
    </svg>
  )
}

/** Degraus: do simples ao avançado. */
function Steps() {
  return (
    <svg viewBox="0 0 460 140" className="ill" role="img" aria-label="degraus de uma escada">
      {[0, 1, 2, 3, 4].map((k) => (
        <rect key={k} x={40 + k * 80} y={110 - k * 20} width="70" height={10 + k * 20} rx="6" fill={k === 4 ? A : W} opacity={0.15 + k * 0.12} className="ill-step" style={{ animationDelay: `${k * 0.3}s` }} />
      ))}
    </svg>
  )
}

const BY: Record<Kind, () => React.ReactNode> = {
  respiracao: Breath,
  gravidade: Gravity,
  conversa: Talk,
  mapa: NeckMap,
  ondas: Waves,
  degraus: Steps,
}

export function Illustration({ kind }: { kind: Kind }) {
  const Draw = BY[kind] ?? Steps
  return <Draw />
}
