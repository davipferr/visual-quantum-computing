import {
  abs2,
  add,
  arg,
  complex,
  conj,
  expi,
  I,
  mul,
  neg,
  ONE,
  scale,
  sub,
  ZERO,
  type Complex,
} from './complex'

/**
 * Single-qubit gates are 2×2 unitary matrices, stored row-major:
 *
 *     [ m00  m01 ]      |0⟩ ↦ m00|0⟩ + m10|1⟩
 *     [ m10  m11 ]      |1⟩ ↦ m01|0⟩ + m11|1⟩
 *
 * Every such matrix is a rotation of the Bloch sphere (times a global phase),
 * which is what `toAxisAngle` recovers and what the playground animates.
 */
export type Matrix2 = readonly [Complex, Complex, Complex, Complex]

export type Vec3 = readonly [number, number, number]

export interface Gate {
  /** Short id used in circuits, e.g. 'H', 'Sdg'. */
  id: string
  /** What to print on the gate box, e.g. 'S†'. */
  label: string
  matrix: Matrix2
  description: string
}

const r = Math.SQRT1_2

export const matrix = (m00: Complex, m01: Complex, m10: Complex, m11: Complex): Matrix2 => [m00, m01, m10, m11]

export const IDENTITY = matrix(ONE, ZERO, ZERO, ONE)

/** Rotation by `theta` about a unit `axis`: R = cos(θ/2)·I − i·sin(θ/2)·(n·σ). */
export function rotation(axis: Vec3, theta: number): Matrix2 {
  const [x, y, z] = axis
  const c = Math.cos(theta / 2)
  const s = Math.sin(theta / 2)
  return matrix(complex(c, -s * z), complex(-s * y, -s * x), complex(s * y, -s * x), complex(c, s * z))
}

export const rx = (theta: number) => rotation([1, 0, 0], theta)
export const ry = (theta: number) => rotation([0, 1, 0], theta)
export const rz = (theta: number) => rotation([0, 0, 1], theta)
/** P(φ) = diag(1, e^{iφ}): adds a phase to |1⟩ only. */
export const phase = (phi: number) => matrix(ONE, ZERO, ZERO, expi(phi))

export const gates = {
  I: { id: 'I', label: 'I', matrix: IDENTITY, description: 'Identity: does nothing.' },
  X: {
    id: 'X',
    label: 'X',
    matrix: matrix(ZERO, ONE, ONE, ZERO),
    description: 'Bit flip (quantum NOT). Half a turn about the x axis.',
  },
  Y: {
    id: 'Y',
    label: 'Y',
    matrix: matrix(ZERO, neg(I), I, ZERO),
    description: 'Bit and phase flip. Half a turn about the y axis.',
  },
  Z: {
    id: 'Z',
    label: 'Z',
    matrix: matrix(ONE, ZERO, ZERO, complex(-1)),
    description: 'Phase flip: |1⟩ picks up a minus sign. Half a turn about the z axis.',
  },
  H: {
    id: 'H',
    label: 'H',
    matrix: matrix(complex(r), complex(r), complex(r), complex(-r)),
    description: 'Hadamard: swaps the z and x axes. Turns |0⟩ into the even superposition |+⟩.',
  },
  S: {
    id: 'S',
    label: 'S',
    matrix: phase(Math.PI / 2),
    description: 'Quarter turn about z: |1⟩ picks up a phase of i.',
  },
  Sdg: {
    id: 'Sdg',
    label: 'S†',
    matrix: phase(-Math.PI / 2),
    description: 'S undone: a quarter turn back about z.',
  },
  T: {
    id: 'T',
    label: 'T',
    matrix: phase(Math.PI / 4),
    description: 'Eighth of a turn about z: |1⟩ picks up e^{iπ/4}.',
  },
  Tdg: {
    id: 'Tdg',
    label: 'T†',
    matrix: phase(-Math.PI / 4),
    description: 'T undone: an eighth of a turn back about z.',
  },
  SX: {
    id: 'SX',
    label: '√X',
    matrix: matrix(complex(0.5, 0.5), complex(0.5, -0.5), complex(0.5, -0.5), complex(0.5, 0.5)),
    description: 'Square root of NOT: apply it twice and you get X. Quarter turn about x.',
  },
} satisfies Record<string, Gate>

export type GateId = keyof typeof gates

export const gateList: Gate[] = Object.values(gates)

// ---- Matrix algebra --------------------------------------------------------

/** a·b: apply b first, then a. */
export function multiply(a: Matrix2, b: Matrix2): Matrix2 {
  return matrix(
    add(mul(a[0], b[0]), mul(a[1], b[2])),
    add(mul(a[0], b[1]), mul(a[1], b[3])),
    add(mul(a[2], b[0]), mul(a[3], b[2])),
    add(mul(a[2], b[1]), mul(a[3], b[3])),
  )
}

/** The conjugate transpose U†, which undoes a unitary U. */
export const adjoint = (m: Matrix2): Matrix2 => matrix(conj(m[0]), conj(m[2]), conj(m[1]), conj(m[3]))

export const determinant = (m: Matrix2): Complex => sub(mul(m[0], m[3]), mul(m[1], m[2]))

export const scaleMatrix = (m: Matrix2, k: Complex): Matrix2 =>
  matrix(mul(m[0], k), mul(m[1], k), mul(m[2], k), mul(m[3], k))

/** Apply a gate to the amplitudes (α, β) of one qubit. */
export function applyMatrix(m: Matrix2, [alpha, beta]: readonly [Complex, Complex]): [Complex, Complex] {
  return [add(mul(m[0], alpha), mul(m[1], beta)), add(mul(m[2], alpha), mul(m[3], beta))]
}

/** Compose gates in time order: sequence(A, B) means "A, then B" (the matrix B·A). */
export function sequence(...ms: Matrix2[]): Matrix2 {
  return ms.reduce((acc, m) => multiply(m, acc), IDENTITY)
}

export function isUnitary(m: Matrix2, epsilon = 1e-9): boolean {
  const p = multiply(adjoint(m), m)
  return (
    Math.abs(p[0].re - 1) < epsilon &&
    Math.abs(p[3].re - 1) < epsilon &&
    abs2(p[1]) < epsilon &&
    abs2(p[2]) < epsilon &&
    Math.abs(p[0].im) < epsilon &&
    Math.abs(p[3].im) < epsilon
  )
}

/**
 * Two gates are physically the same if they differ only by a global phase
 * (e^{iγ}·U and U can't be told apart by any measurement).
 */
export function equalUpToPhase(a: Matrix2, b: Matrix2, epsilon = 1e-6): boolean {
  // ⟨a, b⟩ = tr(a†b); |tr(a†b)| = 2 exactly when b = e^{iγ}·a.
  const p = multiply(adjoint(a), b)
  return Math.abs(Math.hypot(p[0].re + p[3].re, p[0].im + p[3].im) - 2) < epsilon
}

// ---- Gates as rotations ----------------------------------------------------

export interface AxisAngle {
  /** Unit rotation axis on the Bloch sphere. */
  axis: Vec3
  /** Rotation angle in [0, π]: we always pick the short way round. */
  angle: number
  /** Global phase γ such that U = e^{iγ}·R_axis(angle). */
  phase: number
}

/**
 * Write any 2×2 unitary as e^{iγ}·R_n(θ). On the Bloch sphere the gate is
 * exactly "turn by θ about n"; γ is invisible there.
 */
export function toAxisAngle(m: Matrix2): AxisAngle {
  // det(e^{iγ}·R) = e^{2iγ}, because det R = 1.
  let gamma = arg(determinant(m)) / 2
  let v = scaleMatrix(m, expi(-gamma))
  // ±R describe the same rotation; choose the sign with cos(θ/2) ≥ 0 so θ ∈ [0, π].
  if (v[0].re < 0) {
    gamma += Math.PI
    v = scaleMatrix(v, complex(-1))
  }
  // R = [[c − i·s·z, −s·y − i·s·x], [s·y − i·s·x, c + i·s·z]]
  const c = v[0].re
  const sx = -v[2].im
  const sy = v[2].re
  const sz = -v[0].im
  const s = Math.hypot(sx, sy, sz)
  const angle = 2 * Math.atan2(s, c)
  const axis: Vec3 = s < 1e-12 ? [0, 0, 1] : [sx / s, sy / s, sz / s]
  return { axis, angle, phase: normalizeAngle(gamma) }
}

function normalizeAngle(a: number): number {
  const wrapped = ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI
  return Math.abs(wrapped + Math.PI) < 1e-12 ? Math.PI : wrapped
}

/**
 * "A fraction t of the gate": e^{iγt}·R_n(θ·t). At t = 0 it is the identity,
 * at t = 1 the gate itself, and in between the Bloch vector turns smoothly
 * about the gate's axis. Used to animate gates, including controlled ones
 * (where the global phase becomes a real, relative phase).
 */
export function fractionalGate(m: Matrix2, t: number): Matrix2 {
  if (t >= 1) return m
  const { axis, angle, phase: gamma } = toAxisAngle(m)
  return scaleMatrix(rotation(axis, angle * t), expi(gamma * t))
}

/** Rotate a Bloch vector about a unit axis (Rodrigues' formula). */
export function rotateVector(v: Vec3, axis: Vec3, theta: number): Vec3 {
  const [x, y, z] = v
  const [ax, ay, az] = axis
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  const dot = ax * x + ay * y + az * z
  return [
    x * c + (ay * z - az * y) * s + ax * dot * (1 - c),
    y * c + (az * x - ax * z) * s + ay * dot * (1 - c),
    z * c + (ax * y - ay * x) * s + az * dot * (1 - c),
  ]
}

/** Find a named gate equal to `m` up to global phase, if there is one. */
export function identifyGate(m: Matrix2): Gate | undefined {
  return gateList.find((g) => equalUpToPhase(g.matrix, m))
}

/** Scale a matrix by a real number (handy for tests and display). */
export const scaleReal = (m: Matrix2, k: number): Matrix2 =>
  matrix(scale(m[0], k), scale(m[1], k), scale(m[2], k), scale(m[3], k))
