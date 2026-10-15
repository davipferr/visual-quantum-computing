import {
  IDENTITY,
  formatComplex,
  gateList,
  gates,
  identifyGate,
  rotateVector,
  rx,
  ry,
  rz,
  sequence,
  toAxisAngle,
  type Matrix2,
  type Vec3,
} from 'visual-quantum-computing'
import { useMemo, useRef, useState } from 'react'
import { useTween } from '../animation'
import { fmt } from '../canvas'
import { drawBlochSphere, useBlochCanvas } from '../sphere'
import { SectionHead, Slider, deg, rad } from '../ui'

/** The six cardinal states, each with its own colour, so you can follow where they go. */
const cardinal: { label: string; v: Vec3; color: string }[] = [
  { label: '|0⟩', v: [0, 0, 1], color: '--c0' },
  { label: '|1⟩', v: [0, 0, -1], color: '--c1' },
  { label: '|+⟩', v: [1, 0, 0], color: '--c2' },
  { label: '|−⟩', v: [-1, 0, 0], color: '--c3' },
  { label: '|+i⟩', v: [0, 1, 0], color: '--c4' },
  { label: '|−i⟩', v: [0, -1, 0], color: '--c5' },
]

interface Choice {
  label: string
  matrix: Matrix2
  description: string
}

const identities = ['H Z H', 'H X H', 'S S', 'T T', 'SX SX', 'X Y', 'H S H', 'H T H T']

const aliases: Record<string, string> = { 'S†': 'Sdg', 'T†': 'Tdg', '√X': 'SX', SDG: 'Sdg', TDG: 'Tdg' }

function parseSequence(text: string): { gates: Choice[]; error: string | null } {
  const result: Choice[] = []
  for (const raw of text.trim().split(/[\s,·]+/).filter(Boolean)) {
    const id = aliases[raw] ?? aliases[raw.toUpperCase()] ?? raw.toUpperCase()
    const gate = gateList.find((g) => g.id.toUpperCase() === id.toUpperCase())
    if (!gate) return { gates: result, error: `Unknown gate "${raw}". Use H, X, Y, Z, S, S†, T, T†, √X.` }
    result.push({ label: gate.label, matrix: gate.matrix, description: gate.description })
  }
  return { gates: result, error: null }
}

function MatrixView({ m }: { m: Matrix2 }) {
  return (
    <div className="matrix">
      {m.map((c, i) => (
        <span key={i}>{formatComplex(c, 3)}</span>
      ))}
    </div>
  )
}

function describeRotation(m: Matrix2) {
  const { axis, angle, phase } = toAxisAngle(m)
  if (angle < 1e-6) return 'no rotation at all (the identity)'
  return `a ${fmt(deg(angle), 0)}° turn about (${axis.map((a) => fmt(a, 2)).join(', ')})${
    Math.abs(phase) > 1e-6 ? `, global phase ${fmt(deg(phase), 0)}°` : ''
  }`
}

export function GatesAsRotations() {
  const tween = useTween()
  const [selected, setSelected] = useState<Choice>({ ...gates.H })
  const [angle, setAngle] = useState(45)
  const [points, setPoints] = useState<Vec3[]>(() => cardinal.map((c) => c.v))
  const [trails, setTrails] = useState<Vec3[][]>([])
  const [axis, setAxis] = useState<Vec3 | null>(null)
  const [text, setText] = useState('H Z H')
  const [playingIndex, setPlayingIndex] = useState<number | null>(null)
  const committed = useRef<Vec3[]>(cardinal.map((c) => c.v))
  const generation = useRef(0)

  const turn = (m: Matrix2) => {
    const { axis, angle } = toAxisAngle(m)
    const from = committed.current
    const to = from.map((v) => rotateVector(v, axis, angle))
    committed.current = to
    setAxis(angle > 1e-9 ? axis : null)
    const paths: Vec3[][] = from.map(() => [])
    return tween.play(500 + (700 * angle) / Math.PI, (t) => {
      const now = from.map((v) => rotateVector(v, axis, angle * t))
      now.forEach((v, i) => paths[i].push(v))
      setPoints(t >= 1 ? to : now)
      setTrails(paths.map((p) => [...p]))
    })
  }

  const parsed = useMemo(() => parseSequence(text), [text])
  const product = useMemo(() => sequence(...parsed.gates.map((g) => g.matrix)), [parsed])
  const named = identifyGate(product)

  const playSequence = async () => {
    const run = ++generation.current
    tween.finish()
    for (let i = 0; i < parsed.gates.length; i++) {
      if (generation.current !== run) return
      setPlayingIndex(i)
      await turn(parsed.gates[i].matrix)
    }
    if (generation.current === run) setPlayingIndex(null)
  }

  const reset = () => {
    generation.current++
    tween.finish()
    committed.current = cardinal.map((c) => c.v)
    setPoints(committed.current)
    setTrails([])
    setAxis(null)
    setPlayingIndex(null)
  }

  const sphere = useBlochCanvas((frame, view) =>
    drawBlochSphere(frame, view, {
      axis: axis ? { v: axis, color: frame.color('--axis') } : undefined,
      trails: trails.map((points, i) => ({ points, color: frame.color(cardinal[i].color), width: 2 })),
      points: points.map((v, i) => ({
        v,
        color: frame.color(cardinal[i].color),
        radius: 6,
        label: `${cardinal[i].label}`,
      })),
    }),
  )

  const choices: Choice[] = [
    ...gateList,
    { label: `Rx(${angle}°)`, matrix: rx(rad(angle)), description: `Turn by ${angle}° about x.` },
    { label: `Ry(${angle}°)`, matrix: ry(rad(angle)), description: `Turn by ${angle}° about y.` },
    { label: `Rz(${angle}°)`, matrix: rz(rad(angle)), description: `Turn by ${angle}° about z.` },
  ]

  return (
    <section className="card">
      <SectionHead step={2} id="rotations" title="Gates are rotations">
        <p>
          A single-qubit gate is a 2×2 unitary matrix, and every one of them turns the whole sphere
          rigidly about some axis. The coloured dots mark where the six special states end up, so you
          can see the whole rotation, not just one arrow. Composing gates is composing rotations,
          which explains identities like <var>HZH</var> = <var>X</var>.
        </p>
      </SectionHead>

      <div className="split">
        <div className="stack">
          <canvas ref={sphere.ref} className="canvas canvas-sphere draggable" aria-label="Rotating Bloch sphere" {...sphere.handlers} />
          <div className="row">
            <button className="chip" onClick={reset}>
              reset sphere
            </button>
            <span className="muted small">dashed line = rotation axis</span>
          </div>
        </div>

        <div className="stack">
          <div>
            <h3>Pick a gate</h3>
            <div className="gate-row">
              {choices
                .filter((c) => c.label !== 'I')
                .map((c) => (
                  <button
                    key={c.label}
                    className={`gate ${c.label.startsWith('R') ? 'gate-wide' : ''} ${selected.label === c.label ? 'active' : ''}`}
                    onClick={() => setSelected(c)}
                  >
                    {c.label}
                  </button>
                ))}
            </div>
          </div>
          <Slider label="Angle for Rx, Ry, Rz" value={angle} min={-180} max={180} step={15} unit="°" onChange={(a) => {
            setAngle(a)
            if (selected.label.startsWith('R')) {
              const make = { x: rx, y: ry, z: rz }[selected.label[1] as 'x' | 'y' | 'z']
              setSelected({ label: `${selected.label.slice(0, 2)}(${a}°)`, matrix: make(rad(a)), description: `Turn by ${a}° about ${selected.label[1]}.` })
            }
          }} />

          <div className="gate-detail">
            <div className="matrix-wrap">
              <span className="mono big">{selected.label} =</span>
              <MatrixView m={selected.matrix} />
            </div>
            <p className="small">{selected.description}</p>
            <p className="small muted">As a rotation: {describeRotation(selected.matrix)}.</p>
            <button
              className="primary"
              onClick={() => {
                generation.current++
                setPlayingIndex(null)
                void turn(selected.matrix)
              }}
            >
              Apply {selected.label} to the sphere
            </button>
          </div>

          <div className="gate-detail">
            <h3>Compose a sequence</h3>
            <p className="small muted">Gates in time order, left to right. The matrix of “A then B” is B·A.</p>
            <input className="text-input mono" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
            <div className="presets">
              {identities.map((s) => (
                <button key={s} className="chip mono" onClick={() => setText(s)}>
                  {s}
                </button>
              ))}
            </div>
            {parsed.error ? (
              <p className="error small">{parsed.error}</p>
            ) : (
              <>
                <div className="sequence">
                  {parsed.gates.map((g, i) => (
                    <span key={i} className={`gate-mini ${playingIndex === i ? 'active' : ''}`}>
                      {g.label}
                    </span>
                  ))}
                  <span className="mono">=</span>
                  <MatrixView m={parsed.gates.length ? product : IDENTITY} />
                </div>
                <p className="small">
                  {named ? (
                    <>
                      Same as <b className="accent">{named.label}</b>
                      {named.id !== 'I' && ' (up to a global phase)'}.{' '}
                    </>
                  ) : null}
                  <span className="muted">Net effect: {describeRotation(product)}.</span>
                </p>
                <div className="row">
                  <button className="primary" disabled={!parsed.gates.length} onClick={() => void playSequence()}>
                    Play sequence
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <p className="hint">
        H is a half turn about the diagonal between x and z, so it swaps those two axes. Sandwiching a
        z-turn between two H's therefore gives an x-turn. T·T = S and S·S = Z because they are all
        turns about z by 45°, 90° and 180°.
      </p>
    </section>
  )
}
