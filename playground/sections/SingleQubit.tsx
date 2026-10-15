import {
  QuantumState,
  arg,
  fractionalGate,
  gateList,
  qubitFromBloch,
  rx,
  ry,
  rz,
  toAxisAngle,
  toSpherical,
  type Matrix2,
  type Vec3,
} from 'visual-quantum-computing'
import { useRef, useState } from 'react'
import { useTween } from '../animation'
import { fmt } from '../canvas'
import { drawBlochSphere, useBlochCanvas } from '../sphere'
import { KetSum, SectionHead, Slider, deg, rad } from '../ui'

const presets: { label: string; v: Vec3 }[] = [
  { label: '|0⟩', v: [0, 0, 1] },
  { label: '|1⟩', v: [0, 0, -1] },
  { label: '|+⟩', v: [1, 0, 0] },
  { label: '|−⟩', v: [-1, 0, 0] },
  { label: '|+i⟩', v: [0, 1, 0] },
  { label: '|−i⟩', v: [0, -1, 0] },
]

const axisName = ([x, y, z]: Vec3) => {
  const named: [Vec3, string][] = [
    [[1, 0, 0], 'x'],
    [[0, 1, 0], 'y'],
    [[0, 0, 1], 'z'],
    [[Math.SQRT1_2, 0, Math.SQRT1_2], '(x + z)/√2'],
  ]
  for (const [v, name] of named) {
    if (Math.hypot(v[0] - x, v[1] - y, v[2] - z) < 1e-6) return name
    if (Math.hypot(v[0] + x, v[1] + y, v[2] + z) < 1e-6) return `−${name}`
  }
  return `(${fmt(x, 2)}, ${fmt(y, 2)}, ${fmt(z, 2)})`
}

interface LastGate {
  label: string
  description: string
  axis: Vec3
  angle: number
  trail: Vec3[]
}

export function SingleQubit() {
  const tween = useTween()
  const committed = useRef(QuantumState.zero(1))
  const [state, setState] = useState(() => QuantumState.zero(1))
  const [last, setLast] = useState<LastGate | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [angle, setAngle] = useState(90)

  const apply = (label: string, m: Matrix2, description: string) => {
    tween.finish()
    const from = committed.current
    const to = from.clone().apply(m, 0)
    committed.current = to
    setHistory((h) => [...h, label].slice(-14))
    const { axis, angle } = toAxisAngle(m)
    const trail: Vec3[] = []
    const info = { label, description, axis, angle }
    if (angle < 1e-9) {
      setState(to)
      setLast({ ...info, trail })
      return
    }
    void tween.play(450 + (650 * angle) / Math.PI, (t) => {
      const s = t >= 1 ? to : from.clone().apply(fractionalGate(m, t), 0)
      trail.push(s.bloch(0))
      setState(s)
      setLast({ ...info, trail: [...trail] })
    })
  }

  const setDirect = (v: Vec3, keepHistory = false) => {
    tween.finish()
    const s = qubitFromBloch(v)
    committed.current = s
    setState(s)
    setLast(null)
    if (!keepHistory) setHistory([])
  }

  const sphere = useBlochCanvas(
    (frame, view) =>
      drawBlochSphere(frame, view, {
        vectors: [{ v: state.bloch(0), color: frame.color('--accent') }],
        axis: last && last.angle > 1e-9 ? { v: last.axis, color: frame.color('--axis') } : undefined,
        trails: last ? [{ points: last.trail, color: frame.color('--trail'), width: 3 }] : [],
      }),
    {
      grab: () => committed.current.bloch(0),
      onDrag: (v) => setDirect(v, true),
      onDragEnd: () => setHistory([]),
    },
  )

  const [alpha, beta] = state.amplitudes()
  const v = state.bloch(0)
  const { theta, phi } = toSpherical(v)
  const p0 = alpha.re ** 2 + alpha.im ** 2
  const globalPhase = Math.hypot(alpha.re, alpha.im) > 1e-6 ? arg(alpha) : arg(beta)

  return (
    <section className="card">
      <SectionHead step={1} id="bloch" title="One qubit on the Bloch sphere">
        <p>
          A qubit is <var>α</var>|0⟩ + <var>β</var>|1⟩ with complex <var>α</var>, <var>β</var> and
          |<var>α</var>|² + |<var>β</var>|² = 1. Ignore the global phase and two angles remain, so
          every state is a point on a sphere: |0⟩ on top, |1⟩ at the bottom, superpositions in
          between. <strong>Drag the arrow</strong> to set a state, drag elsewhere to turn the sphere,
          and click gates to watch them rotate it.
        </p>
      </SectionHead>

      <div className="split">
        <div className="stack">
          <canvas ref={sphere.ref} className="canvas canvas-sphere draggable" aria-label="Bloch sphere" {...sphere.handlers} />
          <div className="row">
            {presets.map((p) => (
              <button key={p.label} className="chip" onClick={() => setDirect(p.v)}>
                {p.label}
              </button>
            ))}
            <button
              className="chip"
              onClick={() => {
                const z = Math.random() * 2 - 1
                const a = Math.random() * 2 * Math.PI
                const r = Math.sqrt(1 - z * z)
                setDirect([r * Math.cos(a), r * Math.sin(a), z])
              }}
            >
              random
            </button>
            <button className="link" onClick={sphere.resetView}>
              reset view
            </button>
          </div>
        </div>

        <div className="stack">
          <div>
            <h3>Gates</h3>
            <div className="gate-row">
              {gateList
                .filter((g) => g.id !== 'I')
                .map((g) => (
                  <button key={g.id} className="gate" title={g.description} onClick={() => apply(g.label, g.matrix, g.description)}>
                    {g.label}
                  </button>
                ))}
            </div>
          </div>
          <div className="rotation-gates">
            <Slider label="Rotation angle θ" value={angle} min={-180} max={180} step={5} unit="°" onChange={setAngle} />
            <div className="gate-row">
              {(
                [
                  ['Rx', rx, 'x'],
                  ['Ry', ry, 'y'],
                  ['Rz', rz, 'z'],
                ] as const
              ).map(([name, make, axis]) => (
                <button
                  key={name}
                  className="gate gate-wide"
                  onClick={() => apply(`${name}(${angle}°)`, make(rad(angle)), `Turn by ${angle}° about the ${axis} axis.`)}
                >
                  {name}({angle}°)
                </button>
              ))}
            </div>
          </div>

          <div className="callout">
            {last ? (
              <>
                <b>{last.label}</b>: {last.description}
                <br />
                <span className="muted small">
                  On the sphere: a turn of {fmt(deg(last.angle), 0)}° about the{' '}
                  <span style={{ color: 'var(--axis)' }}>{axisName(last.axis)}</span> axis.
                </span>
              </>
            ) : (
              <span className="muted">Every gate is a rotation. Click one to see its axis.</span>
            )}
          </div>

          <div className="state-readout">
            <div className="mono big">
              |ψ⟩ = <KetSum amplitudes={[alpha, beta]} n={1} />
            </div>
            <div className="prob-bars">
              {[
                ['|0⟩', p0],
                ['|1⟩', 1 - p0],
              ].map(([label, p]) => (
                <div key={label as string} className="prob-row">
                  <span className="mono">P{label as string}</span>
                  <div className="prob-track">
                    <div className="prob-fill" style={{ width: `${(p as number) * 100}%` }} />
                  </div>
                  <span className="mono">{fmt((p as number) * 100, 1)}%</span>
                </div>
              ))}
            </div>
            <dl className="stats">
              <div>
                <dt>Polar angle θ (from |0⟩)</dt>
                <dd>{fmt(deg(theta), 1)}°</dd>
              </div>
              <div>
                <dt>Azimuth φ (relative phase)</dt>
                <dd>{fmt(deg(phi), 1)}°</dd>
              </div>
              <div>
                <dt>Bloch vector (x, y, z)</dt>
                <dd className="mono">
                  ({fmt(v[0], 2)}, {fmt(v[1], 2)}, {fmt(v[2], 2)})
                </dd>
              </div>
              <div>
                <dt>Global phase (invisible)</dt>
                <dd>{fmt(deg(globalPhase), 0)}°</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <div className="history">
        <span className="muted small">Circuit so far:</span>
        <span className="wire">
          <span className="mono">|ψ₀⟩</span>
          {history.map((h, i) => (
            <span key={i} className="gate-mini">
              {h}
            </span>
          ))}
        </span>
      </div>
      <p className="hint">
        Try X then Y: you land back on |0⟩, but the amplitudes say <code>−i|0⟩</code>. That factor is a
        global phase. No measurement can detect it, which is why the sphere ignores it. A{' '}
        <em>relative</em> phase between |0⟩ and |1⟩ is real, though: it's the angle φ around the
        equator, and the Z, S and T gates change only that.
      </p>
    </section>
  )
}
