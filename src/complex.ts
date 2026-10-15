/**
 * Complex numbers, the bare minimum.
 *
 * Amplitudes are complex: a magnitude (how likely) and a phase (an angle that
 * only shows up when amplitudes interfere). Values are plain immutable objects.
 */

export interface Complex {
  readonly re: number
  readonly im: number
}

export const complex = (re = 0, im = 0): Complex => ({ re, im })

export const ZERO = complex(0, 0)
export const ONE = complex(1, 0)
export const I = complex(0, 1)

export const add = (a: Complex, b: Complex): Complex => complex(a.re + b.re, a.im + b.im)
export const sub = (a: Complex, b: Complex): Complex => complex(a.re - b.re, a.im - b.im)
export const mul = (a: Complex, b: Complex): Complex =>
  complex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re)
export const scale = (a: Complex, k: number): Complex => complex(a.re * k, a.im * k)
export const conj = (a: Complex): Complex => complex(a.re, -a.im)
export const neg = (a: Complex): Complex => complex(-a.re, -a.im)

/** |a|², the probability carried by an amplitude. */
export const abs2 = (a: Complex): number => a.re * a.re + a.im * a.im
export const abs = (a: Complex): number => Math.hypot(a.re, a.im)
/** The phase angle in (−π, π]. */
export const arg = (a: Complex): number => Math.atan2(a.im, a.re)

/** e^{iθ} = cos θ + i·sin θ */
export const expi = (theta: number): Complex => complex(Math.cos(theta), Math.sin(theta))
export const fromPolar = (r: number, theta: number): Complex =>
  complex(r * Math.cos(theta), r * Math.sin(theta))

export const approxEqual = (a: Complex, b: Complex, epsilon = 1e-9) =>
  Math.abs(a.re - b.re) < epsilon && Math.abs(a.im - b.im) < epsilon

/** Human-friendly formatting: 0.707, −0.5i, 0.5 + 0.5i. */
export function formatComplex(a: Complex, digits = 3): string {
  const round = (v: number) => {
    const r = Number(v.toFixed(digits))
    return Object.is(r, -0) ? 0 : r
  }
  const re = round(a.re)
  const im = round(a.im)
  const num = (v: number) => `${Math.abs(v)}`.replace(/^0\./, '0.')
  if (im === 0) return `${re < 0 ? '−' : ''}${num(re)}`
  const imPart = `${Math.abs(im) === 1 ? '' : num(im)}i`
  if (re === 0) return `${im < 0 ? '−' : ''}${imPart}`
  return `${re < 0 ? '−' : ''}${num(re)} ${im < 0 ? '−' : '+'} ${imPart}`
}
