import { fractionalGate, gates, type GateId, type Matrix2 } from './gates'
import { QuantumState } from './state'

/**
 * A circuit is a grid: one row per qubit, one column per time step.
 *
 * Each cell is empty, a gate, a control dot, or one end of a swap. Like in
 * Quirk, a control dot controls every gate in its column, so a column with
 * ● on q0 and X on q1 is a CNOT, and ● ● X is a Toffoli.
 */
export type Cell = GateId | 'control' | 'swap' | null

export interface Circuit {
  qubits: number
  /** columns[step][qubit] */
  columns: Cell[][]
}

export type Operation =
  | { kind: 'gate'; gate: GateId; matrix: Matrix2; target: number; controls: number[] }
  | { kind: 'swap'; a: number; b: number; controls: number[] }

export function emptyCircuit(qubits: number, steps: number): Circuit {
  return { qubits, columns: Array.from({ length: steps }, () => new Array<Cell>(qubits).fill(null)) }
}

/** Turn one column into the operations it performs. */
export function columnOperations(column: readonly Cell[]): Operation[] {
  const controls: number[] = []
  const swaps: number[] = []
  column.forEach((cell, q) => {
    if (cell === 'control') controls.push(q)
    else if (cell === 'swap') swaps.push(q)
  })
  const ops: Operation[] = []
  column.forEach((cell, q) => {
    if (cell && cell !== 'control' && cell !== 'swap' && cell !== 'I') {
      ops.push({ kind: 'gate', gate: cell, matrix: gates[cell].matrix, target: q, controls })
    }
  })
  if (swaps.length === 2) ops.push({ kind: 'swap', a: swaps[0], b: swaps[1], controls })
  return ops
}

/** Problems that make a column do nothing useful (shown in the editor). */
export function columnWarning(column: readonly Cell[]): string | null {
  const swaps = column.filter((c) => c === 'swap').length
  if (swaps !== 0 && swaps !== 2) return 'A swap needs exactly two × in its column.'
  const hasControl = column.includes('control')
  const hasTarget = column.some((c) => c && c !== 'control')
  if (hasControl && !hasTarget) return 'A control dot needs a gate in the same column.'
  return null
}

/**
 * Apply a column. With `t` < 1 each gate is applied fractionally (a partial
 * rotation), which the playground uses to animate a step.
 */
export function applyColumn(state: QuantumState, column: readonly Cell[], t = 1): QuantumState {
  for (const op of columnOperations(column)) {
    if (op.kind === 'gate') state.apply(fractionalGate(op.matrix, t), op.target, op.controls)
    else state.swap(op.a, op.b, op.controls, t)
  }
  return state
}

/** Run the first `steps` columns, starting from |00…0⟩ (or `initial`). */
export function runCircuit(circuit: Circuit, steps = circuit.columns.length, initial?: QuantumState): QuantumState {
  const state = initial ? initial.clone() : QuantumState.zero(circuit.qubits)
  for (let c = 0; c < Math.min(steps, circuit.columns.length); c++) applyColumn(state, circuit.columns[c])
  return state
}

/** Build a circuit from a compact text form, one string per qubit: 'H●..' etc. (see `parseRow`). */
export function circuitFromRows(rows: readonly string[]): Circuit {
  const parsed = rows.map(parseRow)
  const steps = Math.max(...parsed.map((r) => r.length))
  const circuit = emptyCircuit(rows.length, steps)
  parsed.forEach((row, q) => row.forEach((cell, c) => (circuit.columns[c][q] = cell)))
  return circuit
}

/**
 * Space-separated tokens: a gate id, '●' (control), '×' (swap) or '-' (empty).
 * Example: 'H ● - ×'.
 */
export function parseRow(row: string): Cell[] {
  return row
    .trim()
    .split(/\s+/)
    .map((token): Cell => {
      if (token === '-' || token === '.') return null
      if (token === '●' || token === '@') return 'control'
      if (token === '×' || token === 'x') return 'swap'
      if (token in gates) return token as GateId
      throw new SyntaxError(`unknown circuit token "${token}"`)
    })
}
