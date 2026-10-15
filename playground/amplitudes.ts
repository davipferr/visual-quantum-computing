import type { QuantumState } from 'visual-quantum-computing'
import type { Frame } from './canvas'
import { phaseColor } from './ui'

/**
 * Amplitude circles, in the style of the Quirk simulator: one cell per basis
 * state. The filled disc's radius is |amplitude| (so its area is the
 * probability), its colour and the hand show the phase.
 */
export function drawAmplitudeGrid(
  frame: Frame,
  state: QuantumState,
  options: { highlight?: ReadonlySet<number>; counts?: readonly number[] } = {},
) {
  const { ctx, width, height, color } = frame
  const size = state.size
  const labelHeight = 30
  // Pick the column count that gives the biggest cells.
  let best = { cols: 1, cell: 0 }
  for (let cols = 1; cols <= size; cols++) {
    const rows = Math.ceil(size / cols)
    const cell = Math.min(width / cols, height / rows - labelHeight, 92)
    if (cell > best.cell) best = { cols, cell }
  }
  const { cols, cell } = best
  const rows = Math.ceil(size / cols)
  const cellW = width / cols
  const cellH = height / rows
  const radius = Math.max(4, cell / 2 - 6)
  const totalShots = options.counts?.reduce((a, b) => a + b, 0) ?? 0

  for (let i = 0; i < size; i++) {
    const cx = (i % cols) * cellW + cellW / 2
    const cy = Math.floor(i / cols) * cellH + (cellH - labelHeight) / 2
    const re = state.re[i]
    const im = state.im[i]
    const magnitude = Math.min(1, Math.hypot(re, im))
    const phase = Math.atan2(im, re)

    ctx.strokeStyle = options.highlight?.has(i) ? color('--marked') : color('--border-strong')
    ctx.lineWidth = options.highlight?.has(i) ? 2.5 : 1
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.stroke()

    if (magnitude > 1e-3) {
      ctx.fillStyle = phaseColor(phase)
      ctx.beginPath()
      ctx.arc(cx, cy, radius * magnitude, 0, Math.PI * 2)
      ctx.fill()
      // The phase hand, drawn to the outer ring.
      ctx.strokeStyle = color('--text')
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(phase) * radius * magnitude, cy - Math.sin(phase) * radius * magnitude)
      ctx.stroke()
    }

    ctx.textAlign = 'center'
    ctx.fillStyle = color('--text')
    ctx.font = `${radius < 16 ? 10 : 12}px ui-monospace, Menlo, Consolas, monospace`
    ctx.fillText(`|${i.toString(2).padStart(state.n, '0')}⟩`, cx, cy + radius + 14)
    ctx.fillStyle = color('--muted')
    ctx.font = '10.5px ui-sans-serif, system-ui, sans-serif'
    const p = magnitude * magnitude
    const shots = options.counts && totalShots > 0 ? ` · ${options.counts[i]}` : ''
    ctx.fillText(`${(p * 100).toFixed(p > 0 && p < 0.1 ? 1 : 0)}%${shots}`, cx, cy + radius + 26)
  }
}
