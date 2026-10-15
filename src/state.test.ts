import { describe, expect, it } from 'vitest'
import { bellStates, concurrence, entanglementEntropy } from './bloch'
import { circuitFromRows, runCircuit } from './circuit'
import { complex } from './complex'
import { gates, ry } from './gates'
import { QuantumState, ketLabel, seededRandom } from './state'

const { H, X, Z } = gates

describe('QuantumState', () => {
  it('starts in |0…0⟩ and labels kets with qubit 0 on the left', () => {
    const s = QuantumState.zero(3)
    expect(s.probabilities()[0]).toBe(1)
    s.apply(X.matrix, 0)
    expect(s.probabilities()[0b100]).toBe(1)
    expect(ketLabel(0b100, 3)).toBe('|100⟩')
  })

  it('Hadamard makes an even superposition', () => {
    const s = QuantumState.zero(1).apply(H.matrix, 0)
    expect(s.probabilities()[0]).toBeCloseTo(0.5)
    expect(s.bloch(0)[0]).toBeCloseTo(1)
  })

  it('H then CNOT makes the Bell state Φ+', () => {
    const s = QuantumState.zero(2).apply(H.matrix, 0).apply(X.matrix, 1, [0])
    expect(s.fidelity(bellStates['Φ+'])).toBeCloseTo(1)
    expect(concurrence(s)).toBeCloseTo(1)
    expect(entanglementEntropy(s, 0)).toBeCloseTo(1)
    // Each qubit alone is maximally mixed: its Bloch vector has length 0.
    expect(Math.hypot(...s.bloch(1))).toBeCloseTo(0)
  })

  it('product states have no entanglement', () => {
    const s = QuantumState.zero(2).apply(H.matrix, 0).apply(ry(1), 1)
    expect(concurrence(s)).toBeCloseTo(0)
    expect(entanglementEntropy(s, 1)).toBeCloseTo(0)
    expect(Math.hypot(...s.bloch(1))).toBeCloseTo(1)
  })

  it('swaps qubits, and two half swaps make a swap', () => {
    const s = QuantumState.zero(2).apply(X.matrix, 0)
    expect(s.clone().swap(0, 1).probabilities()[0b01]).toBeCloseTo(1)
    const halves = s.clone().swap(0, 1, [], 0.5).swap(0, 1, [], 0.5)
    expect(halves.probabilities()[0b01]).toBeCloseTo(1)
    expect(halves.norm()).toBeCloseTo(1)
  })

  it('measuring one half of a Bell pair collapses the other', () => {
    const random = seededRandom(7)
    for (let run = 0; run < 20; run++) {
      const s = bellStates['Φ+'].clone()
      const a = s.measureQubit(0, random)
      expect(s.probabilityOne(1)).toBeCloseTo(a)
    }
  })

  it('sampling follows the Born rule', () => {
    const s = QuantumState.fromAmplitudes([complex(Math.sqrt(0.2)), complex(Math.sqrt(0.8))])
    const counts = s.sample(20000, seededRandom(1))
    expect(counts[1] / 20000).toBeCloseTo(0.8, 1)
  })

  it('phase kickback: a controlled-Z is symmetric', () => {
    const a = QuantumState.zero(2).apply(H.matrix, 0).apply(H.matrix, 1).apply(Z.matrix, 1, [0])
    const b = QuantumState.zero(2).apply(H.matrix, 0).apply(H.matrix, 1).apply(Z.matrix, 0, [1])
    expect(a.fidelity(b)).toBeCloseTo(1)
  })
})

describe('Bell correlations', () => {
  it('E(a, b) = cos(a − b) for Φ+ measured in the x–z plane', () => {
    for (const [a, b] of [[0, Math.PI / 4], [Math.PI / 2, -Math.PI / 4], [0.3, 1.9]]) {
      const s = bellStates['Φ+'].clone().apply(ry(-a), 0).apply(ry(-b), 1)
      const [p00, p01, p10, p11] = s.probabilities()
      expect(p00 + p11 - p01 - p10).toBeCloseTo(Math.cos(a - b))
    }
  })
})

describe('circuits', () => {
  it('builds GHZ from text rows', () => {
    const circuit = circuitFromRows(['H ● -', '- X ●', '- - X'])
    const p = runCircuit(circuit).probabilities()
    expect(p[0b000]).toBeCloseTo(0.5)
    expect(p[0b111]).toBeCloseTo(0.5)
  })

  it('teleports a state (deferred measurement)', () => {
    // q0 holds the message T·H|0⟩; q1, q2 share a Bell pair; corrections are controlled gates.
    const circuit = circuitFromRows([
      'H T - - ● H - ●',
      '- - H ● X - ● -',
      '- - - X - - X Z',
    ])
    const out = runCircuit(circuit)
    const message = QuantumState.zero(1).apply(H.matrix, 0).apply(gates.T.matrix, 0)
    const [x, y, z] = message.bloch(0)
    const [x2, y2, z2] = out.bloch(2)
    expect(x2).toBeCloseTo(x)
    expect(y2).toBeCloseTo(y)
    expect(z2).toBeCloseTo(z)
  })
})
