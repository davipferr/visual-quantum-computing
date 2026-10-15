import { complex, type Complex } from './complex'
import type { Matrix2, Vec3 } from './gates'

/** A source of uniform random numbers in [0, 1). Pass a seeded one for repeatable runs. */
export type Random = () => number

/** Small, fast seeded PRNG (mulberry32). */
export function seededRandom(seed: number): Random {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * The state of n qubits: 2ⁿ complex amplitudes, one per basis state.
 *
 * Ordering: qubit 0 is the LEFTMOST symbol of the ket, so for 3 qubits the
 * index 6 = 0b110 is |110⟩ and means q0 = 1, q1 = 1, q2 = 0. (Textbook order;
 * Qiskit uses the opposite.)
 *
 * Gates mutate the state in place and return `this` so they chain.
 */
export class QuantumState {
  readonly n: number
  readonly re: Float64Array
  readonly im: Float64Array

  constructor(n: number) {
    if (!Number.isInteger(n) || n < 1 || n > 16) throw new RangeError(`qubit count must be 1–16, got ${n}`)
    this.n = n
    this.re = new Float64Array(1 << n)
    this.im = new Float64Array(1 << n)
    this.re[0] = 1
  }

  /** |00…0⟩ */
  static zero(n: number): QuantumState {
    return new QuantumState(n)
  }

  /** A single basis state |index⟩. */
  static basis(n: number, index: number): QuantumState {
    const s = new QuantumState(n)
    s.re[0] = 0
    s.re[index] = 1
    return s
  }

  /** Build from explicit amplitudes (normalized for you). */
  static fromAmplitudes(amplitudes: readonly Complex[]): QuantumState {
    const n = Math.log2(amplitudes.length)
    if (!Number.isInteger(n)) throw new RangeError('amplitude count must be a power of two')
    const s = new QuantumState(n)
    amplitudes.forEach((a, i) => {
      s.re[i] = a.re
      s.im[i] = a.im
    })
    return s.normalize()
  }

  get size(): number {
    return this.re.length
  }

  amplitude(index: number): Complex {
    return complex(this.re[index], this.im[index])
  }

  amplitudes(): Complex[] {
    return Array.from(this.re, (re, i) => complex(re, this.im[i]))
  }

  clone(): QuantumState {
    const s = new QuantumState(this.n)
    s.re.set(this.re)
    s.im.set(this.im)
    return s
  }

  /** Bit mask of qubit q inside a basis index. */
  mask(q: number): number {
    if (q < 0 || q >= this.n) throw new RangeError(`no qubit ${q} in a ${this.n}-qubit state`)
    return 1 << (this.n - 1 - q)
  }

  /** Value (0 or 1) of qubit q in basis state `index`. */
  bit(index: number, q: number): 0 | 1 {
    return index & this.mask(q) ? 1 : 0
  }

  /**
   * Apply a 2×2 gate to `target`, only where every qubit in `controls` is 1.
   *
   * The amplitudes pair up: each index with target = 0 meets its partner with
   * target = 1, and the gate mixes the pair exactly like it mixes (α, β) for
   * a lone qubit. That's the whole simulator.
   */
  apply(m: Matrix2, target: number, controls: readonly number[] = []): this {
    const t = this.mask(target)
    let controlMask = 0
    for (const c of controls) {
      if (c === target) throw new RangeError('a qubit cannot control itself')
      controlMask |= this.mask(c)
    }
    const [a, b, c, d] = m
    const { re, im } = this
    for (let i = 0; i < re.length; i++) {
      if (i & t || (i & controlMask) !== controlMask) continue
      const j = i | t
      const xr = re[i], xi = im[i], yr = re[j], yi = im[j]
      re[i] = a.re * xr - a.im * xi + b.re * yr - b.im * yi
      im[i] = a.re * xi + a.im * xr + b.re * yi + b.im * yr
      re[j] = c.re * xr - c.im * xi + d.re * yr - d.im * yi
      im[j] = c.re * xi + c.im * xr + d.re * yi + d.im * yr
    }
    return this
  }

  /**
   * Swap two qubits (optionally controlled). `t` < 1 applies SWAPᵗ, which
   * slides the amplitudes across smoothly; at t = 1 it's a plain swap.
   */
  swap(q1: number, q2: number, controls: readonly number[] = [], t = 1): this {
    const m1 = this.mask(q1)
    const m2 = this.mask(q2)
    let controlMask = 0
    for (const c of controls) controlMask |= this.mask(c)
    // SWAP has eigenvalue +1 on symmetric states and −1 on antisymmetric ones,
    // so SWAPᵗ = P_sym + e^{iπt}·P_anti.
    const er = Math.cos(Math.PI * t)
    const ei = Math.sin(Math.PI * t)
    const pr = (1 + er) / 2, pi = ei / 2 // (1 + e)/2
    const qr = (1 - er) / 2, qi = -ei / 2 // (1 − e)/2
    const { re, im } = this
    for (let i = 0; i < re.length; i++) {
      if (!(i & m1) || i & m2 || (i & controlMask) !== controlMask) continue
      const j = (i & ~m1) | m2
      const xr = re[i], xi = im[i], yr = re[j], yi = im[j]
      re[i] = pr * xr - pi * xi + qr * yr - qi * yi
      im[i] = pr * xi + pi * xr + qr * yi + qi * yr
      re[j] = qr * xr - qi * xi + pr * yr - pi * yi
      im[j] = qr * xi + qi * xr + pr * yi + pi * yr
    }
    return this
  }

  norm(): number {
    let sum = 0
    for (let i = 0; i < this.re.length; i++) sum += this.re[i] ** 2 + this.im[i] ** 2
    return Math.sqrt(sum)
  }

  normalize(): this {
    const k = this.norm()
    if (k === 0) throw new RangeError('cannot normalize the zero vector')
    for (let i = 0; i < this.re.length; i++) {
      this.re[i] /= k
      this.im[i] /= k
    }
    return this
  }

  /** Born rule: P(index) = |amplitude|². */
  probabilities(): number[] {
    return Array.from(this.re, (re, i) => re * re + this.im[i] * this.im[i])
  }

  /** Probability that measuring qubit q gives 1. */
  probabilityOne(q: number): number {
    const m = this.mask(q)
    let p = 0
    for (let i = 0; i < this.re.length; i++) if (i & m) p += this.re[i] ** 2 + this.im[i] ** 2
    return p
  }

  /** Measure one qubit: pick an outcome by the Born rule, then collapse onto it. */
  measureQubit(q: number, random: Random = Math.random): 0 | 1 {
    const outcome: 0 | 1 = random() < this.probabilityOne(q) ? 1 : 0
    this.project(q, outcome)
    return outcome
  }

  /** Keep only the part of the state where qubit q equals `outcome`, renormalized. */
  project(q: number, outcome: 0 | 1): this {
    const m = this.mask(q)
    for (let i = 0; i < this.re.length; i++) {
      if ((i & m ? 1 : 0) !== outcome) {
        this.re[i] = 0
        this.im[i] = 0
      }
    }
    return this.normalize()
  }

  /** Measure every qubit at once; the state collapses to one basis state. */
  measureAll(random: Random = Math.random): number {
    const index = sampleIndex(this.probabilities(), random())
    this.re.fill(0)
    this.im.fill(0)
    this.re[index] = 1
    return index
  }

  /** Simulate `shots` fresh runs and count each outcome (the state is untouched). */
  sample(shots: number, random: Random = Math.random): number[] {
    const probabilities = this.probabilities()
    const counts = new Array<number>(probabilities.length).fill(0)
    for (let s = 0; s < shots; s++) counts[sampleIndex(probabilities, random())]++
    return counts
  }

  /**
   * Bloch vector of qubit q on its own (its reduced state).
   *
   * For a lone qubit this is a point on the sphere. When q is entangled with
   * others, the vector shrinks inside the sphere: its length is 1 for a pure
   * state and 0 for a maximally entangled qubit.
   */
  bloch(q: number): Vec3 {
    const m = this.mask(q)
    let p0 = 0, p1 = 0, cr = 0, ci = 0
    for (let i = 0; i < this.re.length; i++) {
      if (i & m) continue
      const j = i | m
      p0 += this.re[i] ** 2 + this.im[i] ** 2
      p1 += this.re[j] ** 2 + this.im[j] ** 2
      // ρ01 += a_i · conj(a_j)
      cr += this.re[i] * this.re[j] + this.im[i] * this.im[j]
      ci += this.im[i] * this.re[j] - this.re[i] * this.im[j]
    }
    // ρ = (I + x·X + y·Y + z·Z)/2  ⇒  ρ01 = (x − i·y)/2
    return [2 * cr, -2 * ci, p0 - p1]
  }

  /** |⟨this|other⟩|²: 1 for the same physical state, 0 for orthogonal ones. */
  fidelity(other: QuantumState): number {
    let r = 0, i = 0
    for (let k = 0; k < this.re.length; k++) {
      r += this.re[k] * other.re[k] + this.im[k] * other.im[k]
      i += this.re[k] * other.im[k] - this.im[k] * other.re[k]
    }
    return r * r + i * i
  }
}

function sampleIndex(probabilities: readonly number[], u: number): number {
  let acc = 0
  for (let i = 0; i < probabilities.length; i++) {
    acc += probabilities[i]
    if (u < acc) return i
  }
  // Rounding left a sliver above the last bucket: return the last likely outcome.
  for (let i = probabilities.length - 1; i >= 0; i--) if (probabilities[i] > 0) return i
  return 0
}

/** '|011⟩' style label for a basis index. */
export function ketLabel(index: number, n: number): string {
  return `|${index.toString(2).padStart(n, '0')}⟩`
}

/**
 * Straight-line blend of two states' amplitudes (not normalized). Good for
 * animating bar charts where the in-between frames only need to look right.
 */
export function lerpStates(a: QuantumState, b: QuantumState, t: number): QuantumState {
  const s = a.clone()
  for (let i = 0; i < s.re.length; i++) {
    s.re[i] += (b.re[i] - a.re[i]) * t
    s.im[i] += (b.im[i] - a.im[i]) * t
  }
  return s
}
