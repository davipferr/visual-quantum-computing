import { abs, arg, complex, expi, mul, sub, type Complex } from './complex'
import type { Vec3 } from './gates'
import { QuantumState } from './state'

/**
 * The Bloch sphere: every single-qubit state α|0⟩ + β|1⟩ (up to global phase) is
 * a point on a unit sphere,
 *
 *     α = cos(θ/2),   β = e^{iφ}·sin(θ/2)
 *
 * with θ measured down from |0⟩ at the north pole and φ around the equator.
 */

export interface Spherical {
  /** Polar angle from |0⟩, in [0, π]. */
  theta: number
  /** Azimuth around the z axis, in (−π, π]. */
  phi: number
}

export function blochVector(alpha: Complex, beta: Complex): Vec3 {
  // x + i·y = 2·conj(α)·β,  z = |α|² − |β|²
  const ab = mul(complex(alpha.re, -alpha.im), beta)
  return [2 * ab.re, 2 * ab.im, alpha.re ** 2 + alpha.im ** 2 - beta.re ** 2 - beta.im ** 2]
}

export function toSpherical([x, y, z]: Vec3): Spherical {
  const length = Math.hypot(x, y, z)
  const theta = length === 0 ? 0 : Math.acos(Math.max(-1, Math.min(1, z / length)))
  const phi = Math.hypot(x, y) < 1e-12 ? 0 : Math.atan2(y, x)
  return { theta, phi }
}

export function fromSpherical({ theta, phi }: Spherical): Vec3 {
  return [Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta)]
}

/** Canonical amplitudes for a Bloch direction: α real and ≥ 0. */
export function amplitudesFromSpherical({ theta, phi }: Spherical): [Complex, Complex] {
  const s = Math.sin(theta / 2)
  return [complex(Math.cos(theta / 2)), mul(complex(s), expi(phi))]
}

export function qubitFromBloch(v: Vec3): QuantumState {
  return QuantumState.fromAmplitudes(amplitudesFromSpherical(toSpherical(v)))
}

/** Remove the global phase so α is real and non-negative (handy for display). */
export function canonicalPhase(alpha: Complex, beta: Complex): [Complex, Complex] {
  const g = abs(alpha) > 1e-12 ? -arg(alpha) : -arg(beta)
  const k = expi(g)
  return [mul(alpha, k), mul(beta, k)]
}

// ---- Entanglement ------------------------------------------------------------

/**
 * Concurrence of a pure two-qubit state: C = 2·|a00·a11 − a01·a10|.
 * 0 for product states, 1 for Bell states.
 */
export function concurrence(state: QuantumState): number {
  if (state.n !== 2) throw new RangeError('concurrence is defined here for two qubits')
  const [a, b, c, d] = state.amplitudes()
  return Math.min(1, 2 * abs(sub(mul(a, d), mul(b, c))))
}

/** Purity of one qubit's reduced state, tr(ρ²) = (1 + |r|²)/2: 1 when pure, ½ when maximally mixed. */
export function purity(state: QuantumState, q: number): number {
  const [x, y, z] = state.bloch(q)
  return (1 + x * x + y * y + z * z) / 2
}

/**
 * Entanglement entropy (in bits) between qubit q and the rest, for a pure
 * overall state: 0 = not entangled, 1 = maximally entangled.
 */
export function entanglementEntropy(state: QuantumState, q: number): number {
  const [x, y, z] = state.bloch(q)
  const r = Math.min(1, Math.hypot(x, y, z))
  const p = (1 + r) / 2
  const h = (v: number) => (v <= 1e-12 ? 0 : -v * Math.log2(v))
  return h(p) + h(1 - p)
}

/** The four Bell states, a maximally entangled basis for two qubits. */
export const bellStates = {
  'Φ+': QuantumState.fromAmplitudes([complex(1), complex(0), complex(0), complex(1)]),
  'Φ−': QuantumState.fromAmplitudes([complex(1), complex(0), complex(0), complex(-1)]),
  'Ψ+': QuantumState.fromAmplitudes([complex(0), complex(1), complex(1), complex(0)]),
  'Ψ−': QuantumState.fromAmplitudes([complex(0), complex(1), complex(-1), complex(0)]),
} as const

export type BellState = keyof typeof bellStates
