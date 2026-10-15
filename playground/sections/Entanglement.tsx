import {
  QuantumState,
  bellStates,
  concurrence,
  entanglementEntropy,
  fractionalGate,
  gates,
  lerpStates,
  ry,
  type BellState,
  type Matrix2,
} from 'visual-quantum-computing'
import { useRef, useState } from 'react'
import { drawAmplitudeGrid } from '../amplitudes'
import { useTween } from '../animation'
import { fmt, useCanvas } from '../canvas'
import { drawBlochSphere, useBlochCanvas } from '../sphere'
import { KetSum, PhaseLegend, SectionHead, Slider, rad } from '../ui'

type Step =
  | { kind: 'gate'; label: string; matrix: Matrix2; target: number; controls: number[] }
  | { kind: 'swap'; label: string }

const QUBIT_NAMES = ['A', 'B']

/** Normalized straight-line blend, for animating resets and collapses. */
function blend(a: QuantumState, b: QuantumState, t: number): QuantumState {
  const s = lerpStates(a, b, t)
  return s.norm() > 1e-6 ? s.normalize() : b.clone()
}

function ReducedSphere({ state, q }: { state: QuantumState; q: number }) {
  const v = state.bloch(q)
  const length = Math.hypot(...v)
  const sphere = useBlochCanvas((frame, view) =>
    drawBlochSphere(frame, view, {
      vectors: [{ v, color: frame.color(q === 0 ? '--qa' : '--qb') }],
      points: length < 0.999 ? [{ v, color: frame.color(q === 0 ? '--qa' : '--qb'), radius: 3 }] : [],
    }),
  )
  return (
    <div className="stack tight">
      <canvas ref={sphere.ref} className="canvas canvas-sphere-small draggable" aria-label={`Qubit ${QUBIT_NAMES[q]} alone`} {...sphere.handlers} />
      <div className="sphere-caption">
        <b style={{ color: q === 0 ? 'var(--qa)' : 'var(--qb)' }}>Qubit {QUBIT_NAMES[q]}</b>
        <span className="muted small">
          arrow length {fmt(length, 2)} {length < 0.02 ? '· no direction at all' : length < 0.995 ? '· partly mixed' : '· pure'}
        </span>
      </div>
    </div>
  )
}

export function Entanglement() {
  const tween = useTween()
  const committed = useRef(QuantumState.zero(2))
  const [state, setState] = useState(() => QuantumState.zero(2))
  const [history, setHistory] = useState<string[]>([])
  const [angle, setAngle] = useState(60)
  const [message, setMessage] = useState<string | null>(null)
  const [shots, setShots] = useState<number[] | null>(null)

  const animateTo = (to: QuantumState, frameAt: (t: number) => QuantumState, ms = 700) => {
    committed.current = to
    void tween.play(ms, (t) => setState(t >= 1 ? to : frameAt(t)))
  }

  const run = (step: Step) => {
    tween.finish()
    setMessage(null)
    setShots(null)
    const from = committed.current
    if (step.kind === 'swap') {
      const to = from.clone().swap(0, 1)
      animateTo(to, (t) => from.clone().swap(0, 1, [], t))
    } else {
      const to = from.clone().apply(step.matrix, step.target, step.controls)
      animateTo(to, (t) => from.clone().apply(fractionalGate(step.matrix, t), step.target, step.controls))
    }
    setHistory((h) => [...h, step.label].slice(-16))
  }

  const reset = (to: QuantumState, label: string | null) => {
    tween.finish()
    setMessage(null)
    setShots(null)
    const from = committed.current
    animateTo(to.clone(), (t) => blend(from, to, t), 500)
    setHistory(label ? [label] : [])
  }

  const measure = (q: number) => {
    tween.finish()
    setShots(null)
    const from = committed.current
    const before = from.probabilityOne(1 - q)
    const to = from.clone()
    const outcome = to.measureQubit(q)
    const after = to.probabilityOne(1 - q)
    animateTo(to, (t) => blend(from, to, t), 600)
    setHistory((h) => [...h, `measure ${QUBIT_NAMES[q]} → ${outcome}`].slice(-16))
    const other = QUBIT_NAMES[1 - q]
    setMessage(
      `${QUBIT_NAMES[q]} gave ${outcome}. P(${other} = 1) went from ${fmt(before * 100, 0)}% to ${fmt(after * 100, 0)}%` +
        (Math.abs(before - after) > 1e-6 ? ' without touching it.' : ': unchanged, so the qubits were not entangled.'),
    )
  }

  const amplitudes = useCanvas((frame) => drawAmplitudeGrid(frame, state, { counts: shots ?? undefined }))

  const singleGates: { label: string; matrix: Matrix2 }[] = [
    gates.H,
    gates.X,
    gates.Z,
    gates.S,
    gates.T,
    { label: `Ry(${angle}°)`, matrix: ry(rad(angle)) },
  ]

  const c = concurrence(state)
  const entropy = entanglementEntropy(state, 0)

  return (
    <section className="card">
      <SectionHead step={4} id="entanglement" title="Two qubits and entanglement">
        <p>
          Two qubits have four amplitudes, one for each of |00⟩, |01⟩, |10⟩, |11⟩. Most such states
          can't be split into “a state of A” times “a state of B”: they are <strong>entangled</strong>.
          Then neither qubit has a direction of its own, and its arrow shrinks into the sphere. Make a
          Bell pair with <b>H on A</b>, then <b>CNOT A→B</b>.
        </p>
      </SectionHead>

      <div className="entangle-grid">
        <ReducedSphere state={state} q={0} />
        <ReducedSphere state={state} q={1} />
        <div className="stack">
          <canvas ref={amplitudes.ref} className="canvas canvas-amps" aria-label="Two-qubit amplitudes" />
          <div className="legend">
            <PhaseLegend />
            <span>disc area = probability</span>
          </div>
        </div>
      </div>

      <div className="mono big state-line">
        |ψ⟩ = <KetSum amplitudes={state.amplitudes()} n={2} />
      </div>

      <div className="entangle-controls">
        {[0, 1].map((q) => (
          <div key={q} className="gate-group">
            <span className="small" style={{ color: q === 0 ? 'var(--qa)' : 'var(--qb)' }}>
              On {QUBIT_NAMES[q]}
            </span>
            <div className="gate-row">
              {singleGates.map((g) => (
                <button
                  key={g.label}
                  className={`gate ${g.label.length > 2 ? 'gate-wide' : ''}`}
                  onClick={() => run({ kind: 'gate', label: `${g.label}(${QUBIT_NAMES[q]})`, matrix: g.matrix, target: q, controls: [] })}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="gate-group">
          <span className="small">Both</span>
          <div className="gate-row">
            <button className="gate gate-wide" onClick={() => run({ kind: 'gate', label: 'CNOT A→B', matrix: gates.X.matrix, target: 1, controls: [0] })}>
              CNOT A→B
            </button>
            <button className="gate gate-wide" onClick={() => run({ kind: 'gate', label: 'CNOT B→A', matrix: gates.X.matrix, target: 0, controls: [1] })}>
              CNOT B→A
            </button>
            <button className="gate gate-wide" onClick={() => run({ kind: 'gate', label: 'CZ', matrix: gates.Z.matrix, target: 1, controls: [0] })}>
              CZ
            </button>
            <button className="gate gate-wide" onClick={() => run({ kind: 'swap', label: 'SWAP' })}>
              SWAP
            </button>
          </div>
        </div>
        <div className="gate-group">
          <Slider label="Ry angle" value={angle} min={0} max={180} step={5} unit="°" onChange={setAngle} />
        </div>
      </div>

      <div className="row">
        <span className="small">Start from</span>
        <button className="chip" onClick={() => reset(QuantumState.zero(2), null)}>
          |00⟩
        </button>
        {(Object.keys(bellStates) as BellState[]).map((name) => (
          <button key={name} className="chip" onClick={() => reset(bellStates[name], `Bell ${name}`)}>
            Bell |{name}⟩
          </button>
        ))}
        <span className="spacer" />
        <button onClick={() => measure(0)}>Measure A</button>
        <button onClick={() => measure(1)}>Measure B</button>
        <button onClick={() => setShots(committed.current.sample(1000))}>Sample 1000 runs</button>
      </div>

      {message && <p className="callout">{message}</p>}

      <dl className="stats stats-4">
        <div>
          <dt>Concurrence (0 = separate, 1 = Bell pair)</dt>
          <dd>{fmt(c, 3)}</dd>
        </div>
        <div>
          <dt>Entanglement entropy</dt>
          <dd>{fmt(entropy, 3)} bits</dd>
        </div>
        <div>
          <dt>P(A = 1) · P(B = 1)</dt>
          <dd>
            {fmt(state.probabilityOne(0) * 100, 0)}% · {fmt(state.probabilityOne(1) * 100, 0)}%
          </dd>
        </div>
        <div>
          <dt>Verdict</dt>
          <dd className={c > 1e-3 ? 'accent' : ''}>{c > 0.999 ? 'maximally entangled' : c > 1e-3 ? 'entangled' : 'product state'}</dd>
        </div>
      </dl>

      <div className="history">
        <span className="muted small">History:</span>
        <span className="wire">
          <span className="mono">|00⟩</span>
          {history.map((h, i) => (
            <span key={i} className="gate-mini">
              {h}
            </span>
          ))}
        </span>
      </div>
      <p className="hint">
        In a Bell pair each qubit alone is a perfect coin flip, yet the two always agree. Measure A and
        B's arrow jumps to the matching pole instantly. That can't send a message: before you compare
        notes, B's results still look like coin flips. Try Ry on A at a smaller angle before the CNOT
        for a partially entangled state, where the arrows only shrink part way.
      </p>
    </section>
  )
}
