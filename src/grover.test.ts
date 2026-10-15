import { describe, expect, it } from 'vitest'
import {
  applyGroverStage,
  grover,
  groverPlane,
  groverStages,
  optimalIterations,
  successProbability,
} from './grover'
import { QuantumState } from './state'

describe("Grover's search", () => {
  it('finds the marked item among 4 in one step, with certainty', () => {
    const p = grover(2, [2], 1).probabilities()
    expect(p[2]).toBeCloseTo(1)
  })

  it('matches sin²((2k + 1)θ) after every iteration', () => {
    const marked = [5]
    for (let k = 0; k <= 6; k++) {
      const p = grover(4, marked, k).probabilities()
      expect(p[5]).toBeCloseTo(successProbability(16, 1, k))
    }
  })

  it('picks a good iteration count', () => {
    expect(optimalIterations(4, 1)).toBe(1)
    expect(optimalIterations(16, 1)).toBe(3)
    expect(optimalIterations(64, 1)).toBe(6)
    expect(successProbability(64, 1, optimalIterations(64, 1))).toBeGreaterThan(0.99)
  })

  it('overshoots when you keep going', () => {
    const best = successProbability(16, 1, 3)
    expect(successProbability(16, 1, 5)).toBeLessThan(best)
  })

  it('handles several marked items', () => {
    const marked = [1, 6, 11]
    const k = optimalIterations(16, marked.length)
    const p = grover(4, marked, k).probabilities()
    const found = marked.reduce((sum, i) => sum + p[i], 0)
    expect(found).toBeCloseTo(successProbability(16, 3, k))
  })

  it('stays in the plane spanned by |w⟩ and |s′⟩', () => {
    const marked = new Set([3])
    const state = QuantumState.zero(3)
    for (const stage of groverStages(2)) {
      applyGroverStage(state, stage, marked)
      if (stage.kind === 'start') continue
      const [s, w] = groverPlane(state, marked)
      expect(Math.hypot(s, w)).toBeCloseTo(1)
    }
  })
})
