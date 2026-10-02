/* A cor de cada nota diz o papel dela, e é a mesma em todas as telas — consulta,
 * prática, reunião. Tônica laranja (a cor da marca), terça âmbar, quinta azul,
 * o resto em branco quente: presente, mas sem disputar com o esqueleto do
 * acorde. Numa escala isso desenha a tríade da tônica dentro dela; num exercício,
 * mostra a nota-alvo sem precisar de legenda nova.
 */
export type Role = 'root' | 'third' | 'fifth' | 'other'

/** O papel pelo nome do grau: "1", "♭3", "3", "♯5"… Aceita também o "b3" ASCII. */
export function roleOf(degree: string): Role {
  if (degree === '1' || degree === 'R') return 'root'
  const digits = degree.replace(/[♭♯b#]/g, '')
  if (digits === '3') return 'third'
  if (digits === '5') return 'fifth'
  return 'other'
}

export const ROLE_COLOR: Record<Role, string> = {
  root: '#FF5B24',
  third: '#FFC56B',
  fifth: '#7CC8FF',
  other: '#ECE7E0',
}

export const ROLE_NAME: Record<Role, string> = {
  root: 'tônica',
  third: 'terça',
  fifth: 'quinta',
  other: 'outras',
}

export const ROLES: Role[] = ['root', 'third', 'fifth', 'other']

export const degreeColor = (degree: string) => ROLE_COLOR[roleOf(degree)]

/* A identidade de cada acorde numa progressão: ponto no cabeçalho do compasso e
 * na ficha do acorde. Fica fora da paleta dos papéis para não confundir "este é
 * o acorde V" com "esta é a quinta". O I divide a cor com a tônica de propósito. */
export const CHORD_COLOR = {
  I: '#FF5B24',
  V: '#F29BD0',
  vi: '#6EDBC5',
  IV: '#A9A4FF',
} as const

/** A nota que mostra a troca: a terça que não está na pentatônica. */
export const OUTSIDE_COLOR = '#FF4D6D'

/** Mistura duas cores hex. Serve para tirar o brilho e a sombra de cada esfera. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ch = (p: number, s: number) => (p >> s) & 255
  const out = [16, 8, 0].map((s) => Math.round(ch(pa, s) * (1 - t) + ch(pb, s) * t))
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
