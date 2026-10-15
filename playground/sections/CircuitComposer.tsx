import {
  QuantumState,
  applyColumn,
  circuitFromRows,
  columnWarning,
  gates,
  runCircuit,
  type Cell,
  type Circuit,
} from 'visual-quantum-computing'
import { useRef, useState } from 'react'
import { drawAmplitudeGrid } from '../amplitudes'
import { useTween } from '../animation'
import { fmt, useCanvas } from '../canvas'
import { drawBlochSphere, useBlochCanvas } from '../sphere'
import { KetSum, PhaseLegend, SectionHead } from '../ui'

const STEPS = 12
const MAX_QUBITS = 5

type Tool = Exclude<Cell, null> | 'erase'

const palette: { tool: Tool; label: string; title: string }[] = [
  ...(['H', 'X', 'Y', 'Z', 'S', 'Sdg', 'T', 'Tdg', 'SX'] as const).map((id) => ({
    tool: id,
    label: gates[id].label,
    title: gates[id].description,
  })),
  { tool: 'control', label: '●', title: 'Control: the other gates in this column only act where this qubit is 1.' },
  { tool: 'swap', label: '×', title: 'Swap: put two in one column to exchange those qubits.' },
  { tool: 'erase', label: '⌫', title: 'Eraser' },
]

const presets: Record<string, { rows: string[]; note: string }> = {
  'Bell pair': { rows: ['H ●', '- X'], note: 'H puts A in superposition, CNOT copies the "which" into B: (|00⟩ + |11⟩)/√2.' },
  GHZ: { rows: ['H ● -', '- X ●', '- - X'], note: 'Three-way entanglement: all 0 or all 1, nothing in between.' },
  Superposition: { rows: ['H', 'H', 'H'], note: 'H on every qubit: all 8 outcomes equally likely. This is how Grover starts.' },
  'Phase kickback': {
    rows: ['- H ● H', 'X H X -'],
    note: 'B is |−⟩, which X only multiplies by −1. That sign "kicks back" onto A and H turns it into a 1.',
  },
  'Toffoli (AND)': { rows: ['X ●', 'X ●', '- X'], note: 'Two controls: C flips only when A AND B are 1. Reversible logic.' },
  Teleportation: {
    rows: ['H T - - ● H - ●', '- - H ● X - ● -', '- - - X - - X Z'],
    note: 'The state made on q0 (H then T) ends up on q2. Compare the first and last spheres at the end.',
  },
  'QFT of |101⟩': {
    rows: ['X H S T - - - ×', '- - ● - H S - -', 'X - - ● - ● H ×'],
    note: 'The quantum Fourier transform: equal magnitudes, with the input encoded in the phases.',
  },
  'Grover, 4 items': {
    rows: ['H ● H X ● X H', 'H Z H X Z X H'],
    note: 'One Grover iteration finds the marked item |11⟩ among four with certainty. See section 7.',
  },
}

function padded(rows: string[]): Circuit {
  const c = circuitFromRows(rows)
  while (c.columns.length < STEPS) c.columns.push(new Array<Cell>(c.qubits).fill(null))
  return c
}

function resize(circuit: Circuit, qubits: number): Circuit {
  return {
    qubits,
    columns: circuit.columns.map((col) => Array.from({ length: qubits }, (_, q) => col[q] ?? null)),
  }
}

function MiniSphere({ state, q }: { state: QuantumState; q: number }) {
  const v = state.bloch(q)
  const sphere = useBlochCanvas((frame, view) =>
    drawBlochSphere(frame, view, { compact: true, vectors: [{ v, color: frame.color('--accent') }] }),
  )
  const p1 = state.probabilityOne(q)
  return (
    <div className="mini-sphere">
      <canvas ref={sphere.ref} className="canvas canvas-mini draggable" aria-label={`Qubit ${q} Bloch sphere`} {...sphere.handlers} />
      <span className="mono small">q{q}</span>
      <div className="prob-track" title="P(1)">
        <div className="prob-fill" style={{ width: `${p1 * 100}%` }} />
      </div>
      <span className="muted small">P(1) {fmt(p1 * 100, 0)}%</span>
    </div>
  )
}

function CellView({ cell, column }: { cell: Cell; column: readonly Cell[] }) {
  if (cell === null) return null
  if (cell === 'control') return <span className="c-control" />
  if (cell === 'swap') return <span className="c-swap">×</span>
  if (cell === 'X' && column.includes('control')) return <span className="c-target">⊕</span>
  return <span className="c-gate">{gates[cell].label}</span>
}

export function CircuitComposer() {
  const tween = useTween()
  const [circuit, setCircuit] = useState(() => padded(presets['Bell pair'].rows))
  const [step, setStep] = useState(0)
  const [display, setDisplay] = useState(() => QuantumState.zero(2))
  const [tool, setTool] = useState<Tool>('H')
  const [note, setNote] = useState<string | null>(presets['Bell pair'].note)
  const generation = useRef(0)

  const last = circuit.columns.reduce((acc, col, i) => (col.some((c) => c !== null) ? i + 1 : acc), 0)

  const show = (c: Circuit, s: number) => {
    generation.current++
    tween.finish()
    setStep(s)
    setDisplay(runCircuit(c, s))
  }

  const edit = (q: number, col: number) => {
    const next: Circuit = { qubits: circuit.qubits, columns: circuit.columns.map((c) => [...c]) }
    const current = next.columns[col][q]
    next.columns[col][q] = tool === 'erase' || current === tool ? null : tool
    setCircuit(next)
    setNote(null)
    show(next, Math.max(step, Math.min(col + 1, STEPS)))
  }

  /** Animate one column forwards (or backwards). Resolves when done. */
  const animateStep = (from: number, to: number) => {
    const forward = to > from
    const column = circuit.columns[forward ? from : to]
    const base = runCircuit(circuit, Math.min(from, to))
    setStep(to)
    const empty = column.every((c) => c === null)
    return tween.play(empty ? 120 : 650, (t) => setDisplay(applyColumn(base.clone(), column, forward ? t : 1 - t)))
  }

  const go = (to: number) => {
    generation.current++
    tween.finish()
    if (Math.abs(to - step) === 1) void animateStep(step, to)
    else show(circuit, to)
  }

  const play = async () => {
    const run = ++generation.current
    tween.finish()
    let s = step >= last ? 0 : step
    if (s === 0) {
      setStep(0)
      setDisplay(QuantumState.zero(circuit.qubits))
    }
    while (s < last && generation.current === run) {
      await animateStep(s, s + 1)
      s++
    }
  }

  const loadPreset = (name: string) => {
    const c = padded(presets[name].rows)
    setCircuit(c)
    setNote(presets[name].note)
    show(c, 0)
  }

  const setQubits = (n: number) => {
    const c = resize(circuit, n)
    setCircuit(c)
    setNote(null)
    show(c, Math.min(step, STEPS))
  }

  const amplitudes = useCanvas((frame) => drawAmplitudeGrid(frame, display))

  return (
    <section className="card">
      <SectionHead step={6} id="circuits" title="Circuit composer">
        <p>
          Build any circuit on up to {MAX_QUBITS} qubits and step through it one column at a time.
          Pick a tool, click the grid to place it, click again to remove it. A ● makes the other gates
          in its column <em>controlled</em>, so ● with X is a CNOT.
        </p>
      </SectionHead>

      <div className="row">
        <span className="small">Qubits</span>
        {Array.from({ length: MAX_QUBITS }, (_, i) => i + 1).map((n) => (
          <button key={n} className={`chip ${circuit.qubits === n ? 'active' : ''}`} onClick={() => setQubits(n)}>
            {n}
          </button>
        ))}
        <span className="spacer" />
        <span className="small">Examples</span>
        <select value="" onChange={(e) => e.target.value && loadPreset(e.target.value)}>
          <option value="">choose…</option>
          {Object.keys(presets).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="palette">
        {palette.map((p) => (
          <button
            key={p.tool}
            title={p.title}
            className={`gate ${tool === p.tool ? 'active' : ''}`}
            onClick={() => setTool(p.tool)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="circuit-scroll">
        <div className="circuit" style={{ ['--qubits' as string]: circuit.qubits }}>
          <div className="circuit-labels">
            <span className="circuit-head" />
            {Array.from({ length: circuit.qubits }, (_, q) => (
              <span key={q} className="circuit-label mono">
                q{q} |0⟩
              </span>
            ))}
          </div>
          {circuit.columns.map((column, c) => {
            const used = column.map((cell, q) => (cell ? q : -1)).filter((q) => q >= 0)
            const linked = used.length > 1 && (column.includes('control') || column.filter((x) => x === 'swap').length === 2)
            const warning = columnWarning(column)
            return (
              <div
                key={c}
                className={`circuit-col ${c < step ? 'done' : ''} ${c === step ? 'next' : ''} ${warning ? 'warn' : ''}`}
                title={warning ?? undefined}
              >
                <button className="circuit-head mono" onClick={() => go(c + 1)} title={`Run up to column ${c + 1}`}>
                  {c + 1}
                </button>
                {linked && (
                  <span
                    className="link-line"
                    style={{
                      top: `calc(var(--head) + (${Math.min(...used)} + 0.5) * var(--cell))`,
                      height: `calc(${Math.max(...used) - Math.min(...used)} * var(--cell))`,
                    }}
                  />
                )}
                {column.map((cell, q) => (
                  <button key={q} className="circuit-cell" onClick={() => edit(q, c)} aria-label={`qubit ${q}, column ${c + 1}`}>
                    <CellView cell={cell} column={column} />
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      <div className="row">
        <button onClick={() => go(0)} disabled={step === 0}>
          ⏮
        </button>
        <button onClick={() => go(step - 1)} disabled={step === 0}>
          ◀ Back
        </button>
        <button className="primary" onClick={() => go(step + 1)} disabled={step >= STEPS}>
          Step ▶
        </button>
        <button onClick={() => void play()}>▶ Play all</button>
        <button onClick={() => go(last)}>⏭</button>
        <span className="muted small">
          after column {step} of {last}
        </span>
        <span className="spacer" />
        <button className="link" onClick={() => {
          const c = padded(Array.from({ length: circuit.qubits }, () => '-'))
          setCircuit(c)
          setNote(null)
          show(c, 0)
        }}>
          clear circuit
        </button>
      </div>
      {note && <p className="callout">{note}</p>}

      <div className="mono state-line">
        |ψ⟩ = <KetSum amplitudes={display.amplitudes()} n={display.n} />
      </div>

      <canvas
        ref={amplitudes.ref}
        className="canvas"
        style={{ height: [150, 150, 170, 280, 300][display.n - 1] }}
        aria-label="Amplitudes of every basis state"
      />
      <div className="legend">
        <PhaseLegend />
        <span>disc area = probability, hand = phase</span>
      </div>
      <div className="mini-spheres">
        {Array.from({ length: display.n }, (_, q) => (
          <MiniSphere key={q} state={display} q={q} />
        ))}
      </div>
      <p className="hint">
        The small spheres show each qubit on its own. When qubits are entangled their arrows shrink:
        the information lives in the correlations, which only the amplitude grid shows. That grid
        doubles with every qubit, and that doubling is why classical computers struggle to simulate
        quantum ones.
      </p>
    </section>
  )
}
