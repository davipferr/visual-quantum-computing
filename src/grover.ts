import { gates } from './gates'
import { QuantumState } from './state'

/**
 * Grover's search finds one of M "marked" items among N = 2ⁿ in about
 * (π/4)·√(N/M) steps, where a classical search needs about N/(2M) guesses.
 *
 * Each iteration is two reflections:
 *   1. the oracle flips the sign of every marked amplitude;
 *   2. the diffusion operator 2|s⟩⟨s| − I reflects every amplitude about the mean.
 * Together they rotate the state by 2θ towards the marked items, where
 * sin θ = √(M/N).
 */

/** H on every qubit: |00…0⟩ becomes the even superposition |s⟩. */
export function hadamardAll(state: QuantumState): QuantumState {
  for (let q = 0; q < state.n; q++) state.apply(gates.H.matrix, q)
  return state
}

/** The phase oracle: amplitude → −amplitude for each marked basis state. */
export function oracle(state: QuantumState, marked: Iterable<number>): QuantumState {
  for (const i of marked) {
    state.re[i] = -state.re[i]
    state.im[i] = -state.im[i]
  }
  return state
}

/** The mean amplitude (complex). */
export function meanAmplitude(state: QuantumState): { re: number; im: number } {
  let re = 0, im = 0
  for (let i = 0; i < state.size; i++) {
    re += state.re[i]
    im += state.im[i]
  }
  return { re: re / state.size, im: im / state.size }
}

/** Inversion about the mean: amplitude → 2·mean − amplitude. */
export function diffusion(state: QuantumState): QuantumState {
  const mean = meanAmplitude(state)
  for (let i = 0; i < state.size; i++) {
    state.re[i] = 2 * mean.re - state.re[i]
    state.im[i] = 2 * mean.im - state.im[i]
  }
  return state
}

/** Half the angle each iteration turns: sin θ = √(M/N). */
export function groverAngle(N: number, M: number): number {
  return Math.asin(Math.sqrt(M / N))
}

/** Probability of measuring a marked item after k iterations: sin²((2k + 1)·θ). */
export function successProbability(N: number, M: number, k: number): number {
  return Math.sin((2 * k + 1) * groverAngle(N, M)) ** 2
}

/** The iteration count that lands closest to the marked items. */
export function optimalIterations(N: number, M: number): number {
  if (M <= 0 || M >= N) return 0
  return Math.max(0, Math.round(Math.PI / (4 * groverAngle(N, M)) - 0.5))
}

export type GroverStageKind = 'start' | 'hadamard' | 'oracle' | 'diffusion'

export interface GroverStage {
  kind: GroverStageKind
  /** Which Grover iteration this stage belongs to (0 before the first one). */
  iteration: number
}

/** The stage list for `iterations` rounds: start, H⊗ⁿ, then oracle/diffusion pairs. */
export function groverStages(iterations: number): GroverStage[] {
  const stages: GroverStage[] = [
    { kind: 'start', iteration: 0 },
    { kind: 'hadamard', iteration: 0 },
  ]
  for (let k = 1; k <= iterations; k++) {
    stages.push({ kind: 'oracle', iteration: k }, { kind: 'diffusion', iteration: k })
  }
  return stages
}

/** Apply one stage to a state in place. */
export function applyGroverStage(state: QuantumState, stage: GroverStage, marked: Iterable<number>): QuantumState {
  switch (stage.kind) {
    case 'start':
      return state
    case 'hadamard':
      return hadamardAll(state)
    case 'oracle':
      return oracle(state, marked)
    case 'diffusion':
      return diffusion(state)
  }
}

/** Run Grover's algorithm for `iterations` rounds and return the final state. */
export function grover(n: number, marked: readonly number[], iterations = optimalIterations(2 ** n, marked.length)) {
  const state = hadamardAll(QuantumState.zero(n))
  for (let k = 0; k < iterations; k++) diffusion(oracle(state, marked))
  return state
}

/**
 * The 2-D picture: Grover's state always lives in the plane spanned by
 * |w⟩ (even superposition of marked items) and |s′⟩ (of unmarked ones).
 * Returns the state's coordinates in that plane, [along s′, along w].
 */
export function groverPlane(state: QuantumState, marked: ReadonlySet<number>): [number, number] {
  const N = state.size
  const M = marked.size
  let w = 0, s = 0
  for (let i = 0; i < N; i++) {
    if (marked.has(i)) w += state.re[i]
    else s += state.re[i]
  }
  return [M < N ? s / Math.sqrt(N - M) : 0, M > 0 ? w / Math.sqrt(M) : 0]
}
