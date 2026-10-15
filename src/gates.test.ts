import { describe, expect, it } from 'vitest'
import { complex } from './complex'
import {
  applyMatrix,
  equalUpToPhase,
  fractionalGate,
  gateList,
  gates,
  identifyGate,
  isUnitary,
  multiply,
  rotateVector,
  rx,
  ry,
  rz,
  sequence,
  toAxisAngle,
  type Vec3,
} from './gates'
import { blochVector } from './bloch'

const close = (a: Vec3, b: Vec3) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 9))

describe('gates', () => {
  it('are all unitary', () => {
    for (const gate of gateList) expect(isUnitary(gate.matrix), gate.id).toBe(true)
  })

  it('satisfy the textbook identities', () => {
    const { H, X, Y, Z, S, T, SX } = gates
    expect(equalUpToPhase(sequence(H.matrix, Z.matrix, H.matrix), X.matrix)).toBe(true)
    expect(equalUpToPhase(sequence(H.matrix, X.matrix, H.matrix), Z.matrix)).toBe(true)
    expect(equalUpToPhase(multiply(S.matrix, S.matrix), Z.matrix)).toBe(true)
    expect(equalUpToPhase(multiply(T.matrix, T.matrix), S.matrix)).toBe(true)
    expect(equalUpToPhase(multiply(SX.matrix, SX.matrix), X.matrix)).toBe(true)
    expect(equalUpToPhase(sequence(X.matrix, Y.matrix), Z.matrix)).toBe(true)
    expect(equalUpToPhase(H.matrix, X.matrix)).toBe(false)
  })

  it('names a product when it matches a known gate', () => {
    expect(identifyGate(sequence(gates.H.matrix, gates.Z.matrix, gates.H.matrix))?.id).toBe('X')
  })
})

describe('gates as rotations', () => {
  it('finds the axis and angle of the named gates', () => {
    const x = toAxisAngle(gates.X.matrix)
    close(x.axis, [1, 0, 0])
    expect(x.angle).toBeCloseTo(Math.PI)

    const h = toAxisAngle(gates.H.matrix)
    close(h.axis, [Math.SQRT1_2, 0, Math.SQRT1_2])
    expect(h.angle).toBeCloseTo(Math.PI)

    const s = toAxisAngle(gates.S.matrix)
    close(s.axis, [0, 0, 1])
    expect(s.angle).toBeCloseTo(Math.PI / 2)

    const t = toAxisAngle(gates.T.matrix)
    expect(t.angle).toBeCloseTo(Math.PI / 4)
  })

  it('round-trips rotation matrices', () => {
    const r = ry(1.2)
    const { axis, angle } = toAxisAngle(r)
    close(axis, [0, 1, 0])
    expect(angle).toBeCloseTo(1.2)
  })

  it('moves the Bloch vector exactly like a rotation of the sphere', () => {
    const start = [complex(0.6), complex(0, 0.8)] as const
    const v = blochVector(...start)
    for (const gate of [...gateList, rx(0.7), rz(-2), ry(2.5)]) {
      const m = 'matrix' in gate ? gate.matrix : gate
      const { axis, angle } = toAxisAngle(m)
      close(blochVector(...applyMatrix(m, start)), rotateVector(v, axis, angle))
    }
  })

  it('fractional gates go from identity to the gate', () => {
    for (const gate of gateList) {
      expect(equalUpToPhase(fractionalGate(gate.matrix, 0), gates.I.matrix)).toBe(true)
      expect(fractionalGate(gate.matrix, 0.999999).every((c, i) => Math.abs(c.re - gate.matrix[i].re) < 1e-4)).toBe(
        true,
      )
      // Two half-steps make a whole step, phase included.
      const half = fractionalGate(gate.matrix, 0.5)
      const whole = multiply(half, half)
      whole.forEach((c, i) => {
        expect(c.re).toBeCloseTo(gate.matrix[i].re, 9)
        expect(c.im).toBeCloseTo(gate.matrix[i].im, 9)
      })
    }
  })
})
