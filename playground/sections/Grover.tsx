import {
  QuantumState,
  applyGroverStage,
  groverAngle,
  groverPlane,
  groverStages,
  ketLabel,
  lerpStates,
  meanAmplitude,
  optimalIterations,
  successProbability,
  type GroverStage,
} from 'visual-quantum-computing'
import { useMemo, useRef, useState, type MouseEvent } from 'react'
import { useTween } from '../animation'
import { arrow, clip, fmt, grid, plotArea, polyline, useCanvas } from '../canvas'
import { SectionHead, deg } from '../ui'

const explain: Record<GroverStage['kind'], (N: number, M: number) => string> = {
  start: () => 'Every qubit starts in |0⟩, so the register holds the single item |00…0⟩.',
  hadamard: (N, M) =>
    `H on every qubit: all ${N} items now share the same amplitude 1/√${N} ≈ ${fmt(1 / Math.sqrt(N), 3)}. Measuring now finds a marked item with probability ${M}/${N}, no better than a blind guess.`,
  oracle: () =>
    'The oracle recognises the marked items and flips the sign of their amplitudes. Probabilities don’t change at all: only the phase does, so this step alone reveals nothing.',
  diffusion: () =>
    'Inversion about the mean: every amplitude a becomes 2·mean − a. The marked amplitudes sit far below the mean, so they bounce high above it. The others shrink a little.',
}

function stateAt(n: number, stages: GroverStage[], index: number, marked: ReadonlySet<number>): QuantumState {
  const s = QuantumState.zero(n)
  for (let i = 0; i <= index; i++) applyGroverStage(s, stages[i], marked)
  return s
}

const randomItem = (N: number) => Math.floor(Math.random() * N)

export function Grover() {
  const tween = useTween()
  const [n, setN] = useState(4)
  const [marked, setMarked] = useState<ReadonlySet<number>>(() => new Set([11]))
  const [stage, setStage] = useState(1)
  const [display, setDisplay] = useState(() => stateAt(4, groverStages(1), 1, new Set([11])))
  const [measured, setMeasured] = useState<number | null>(null)
  const generation = useRef(0)

  const N = 2 ** n
  const M = marked.size
  const theta = groverAngle(N, M)
  const optimal = optimalIterations(N, M)
  const maxIterations = Math.max(4, 2 * optimal + 2)
  const stages = useMemo(() => groverStages(maxIterations), [maxIterations])
  const current = stages[Math.min(stage, stages.length - 1)]
  const iterationsDone = stages.slice(0, stage + 1).filter((s) => s.kind === 'diffusion').length

  /** Snap to a stage with no animation, after a change of n or marked items. */
  const jump = (nextN: number, nextMarked: ReadonlySet<number>, nextStage: number) => {
    generation.current++
    tween.finish()
    setMeasured(null)
    const N2 = 2 ** nextN
    const st = groverStages(Math.max(4, 2 * optimalIterations(N2, nextMarked.size) + 2))
    const s = Math.min(nextStage, st.length - 1)
    setStage(s)
    setDisplay(stateAt(nextN, st, s, nextMarked))
  }

  const animateTo = (to: number) => {
    const from = stateAt(n, stages, stage, marked)
    const target = stateAt(n, stages, to, marked)
    setStage(to)
    setMeasured(null)
    return tween.play(Math.abs(to - stage) === 1 ? 900 : 500, (t) => setDisplay(t >= 1 ? target : lerpStates(from, target, t)))
  }

  const go = (to: number) => {
    generation.current++
    tween.finish()
    if (to < 0 || to >= stages.length) return
    void animateTo(to)
  }

  const playTo = async (end: number) => {
    const run = ++generation.current
    tween.finish()
    let s = stage >= end ? 0 : stage
    if (s !== stage) {
      setStage(s)
      setDisplay(stateAt(n, stages, s, marked))
    }
    while (s < end && generation.current === run) {
      const from = stateAt(n, stages, s, marked)
      const target = stateAt(n, stages, s + 1, marked)
      s++
      setStage(s)
      await tween.play(750, (t) => setDisplay(t >= 1 ? target : lerpStates(from, target, t)))
    }
  }

  const toggleMarked = (index: number) => {
    const next = new Set(marked)
    if (next.has(index)) {
      if (next.size === 1) return
      next.delete(index)
    } else {
      if (next.size >= N - 1) return
      next.add(index)
    }
    setMarked(next)
    jump(n, next, stage)
  }

  const changeN = (nextN: number) => {
    const next = new Set([randomItem(2 ** nextN)])
    setN(nextN)
    setMarked(next)
    jump(nextN, next, 1)
  }

  const measure = () => {
    const committed = stateAt(n, stages, stage, marked)
    setMeasured(committed.clone().measureAll())
  }

  // ---- Amplitude bars ------------------------------------------------------
  const barGeometry = (width: number) => {
    const left = 40
    const right = 10
    const bw = (width - left - right) / N
    return { left, bw }
  }

  const bars = useCanvas((frame) => {
    const { ctx, width, height, color } = frame
    const { left, bw } = barGeometry(width)
    const top = 16
    const bottom = N <= 32 ? 34 : 18
    const mid = top + (height - top - bottom) / 2
    const half = (height - top - bottom) / 2
    const y = (a: number) => mid - a * half

    // Axis and gridlines at ±0.5, ±1
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'right'
    for (const v of [-1, -0.5, 0, 0.5, 1]) {
      ctx.strokeStyle = v === 0 ? color('--target') : color('--grid')
      ctx.lineWidth = 1
      polyline(ctx, [
        [left, y(v)],
        [width - 10, y(v)],
      ])
      ctx.fillStyle = color('--muted')
      ctx.fillText(`${v}`, left - 6, y(v) + 4)
    }

    const gap = bw > 8 ? Math.min(4, bw * 0.2) : bw > 3 ? 1 : 0
    for (let i = 0; i < N; i++) {
      const a = display.re[i]
      const x = left + i * bw
      ctx.fillStyle = marked.has(i) ? color('--marked') : color('--accent')
      ctx.globalAlpha = measured === null || measured === i ? 1 : 0.35
      const y0 = y(0)
      const y1 = y(a)
      ctx.fillRect(x + gap / 2, Math.min(y0, y1), Math.max(1, bw - gap), Math.max(1, Math.abs(y1 - y0)))
      ctx.globalAlpha = 1
      if (N <= 32) {
        ctx.save()
        ctx.translate(x + bw / 2, height - bottom + 6)
        ctx.fillStyle = marked.has(i) ? color('--marked') : color('--muted')
        ctx.font = `${N <= 16 ? 11 : 9}px ui-monospace, Menlo, Consolas, monospace`
        ctx.textAlign = 'center'
        if (N > 16) {
          ctx.rotate(-Math.PI / 2)
          ctx.textAlign = 'right'
          ctx.fillText(i.toString(2).padStart(n, '0'), 0, 3)
        } else {
          ctx.fillText(i.toString(2).padStart(n, '0'), 0, 10)
        }
        ctx.restore()
      }
    }

    // The mean amplitude: what diffusion reflects about.
    const mean = meanAmplitude(display).re
    ctx.strokeStyle = color('--exact')
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    polyline(ctx, [
      [left, y(mean)],
      [width - 10, y(mean)],
    ])
    ctx.setLineDash([])
    ctx.fillStyle = color('--exact')
    ctx.textAlign = 'left'
    ctx.font = '12px ui-sans-serif, system-ui, sans-serif'
    ctx.fillText(`mean ${fmt(mean, 3)}`, left + 4, y(mean) - 6)
  })

  const onBarsClick = (event: MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const { left, bw } = barGeometry(rect.width)
    const i = Math.floor((event.clientX - rect.left - left) / bw)
    if (i >= 0 && i < N) toggleMarked(i)
  }

  // ---- The 2-D rotation picture -------------------------------------------
  const plane = useCanvas((frame) => {
    const { ctx, width, height, color } = frame
    const r = Math.min(width, height) / 2 - 34
    const cx = width / 2
    const cy = height / 2
    const P = (s: number, w: number): [number, number] => [cx + s * r, cy - w * r]
    ctx.font = '12px ui-sans-serif, system-ui, sans-serif'
    /** Text that never spills off the canvas. */
    const label = (text: string, [x, y]: [number, number], align: 'left' | 'right' | 'center' = 'left') => {
      const w = ctx.measureText(text).width
      const left = align === 'left' ? x : align === 'right' ? x - w : x - w / 2
      ctx.textAlign = 'left'
      ctx.fillText(text, Math.max(4, Math.min(width - w - 4, left)), Math.max(14, Math.min(height - 6, y)))
    }

    ctx.strokeStyle = color('--grid')
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = color('--target')
    polyline(ctx, [P(-1.1, 0), P(1.1, 0)])
    polyline(ctx, [P(0, -1.1), P(0, 1.1)])
    ctx.fillStyle = color('--muted')
    label('|s′⟩ unmarked', P(1.08, -0.1), 'right')
    ctx.fillStyle = color('--marked')
    label('|w⟩ marked', P(-0.04, 1.08), 'right')

    // |s⟩, the starting direction, at angle θ above the unmarked axis.
    ctx.strokeStyle = color('--exact')
    ctx.setLineDash([5, 4])
    polyline(ctx, [P(0, 0), P(Math.cos(theta) * 1.08, Math.sin(theta) * 1.08)])
    ctx.setLineDash([])
    ctx.fillStyle = color('--exact')
    label(`|s⟩  θ = ${fmt(deg(theta), 1)}°`, P(Math.cos(theta) * 1.12, Math.sin(theta) * 1.12 + 0.04))

    // The mirror the next step reflects about.
    const next = stages[stage + 1]
    if (next && (next.kind === 'oracle' || next.kind === 'diffusion')) {
      const angle = next.kind === 'oracle' ? 0 : theta
      ctx.strokeStyle = color('--axis')
      ctx.lineWidth = 1.5
      ctx.setLineDash([2, 4])
      polyline(ctx, [P(-Math.cos(angle) * 1.15, -Math.sin(angle) * 1.15), P(Math.cos(angle) * 1.15, Math.sin(angle) * 1.15)])
      ctx.setLineDash([])
      ctx.fillStyle = color('--axis')
      label(`next mirror (${next.kind})`, P(-Math.cos(angle) * 1.08, -Math.sin(angle) * 1.08 - 0.1))
    }

    // Past positions, one dot per completed stage.
    for (let i = 1; i < Math.min(stage, stages.length); i++) {
      const [s, w] = groverPlane(stateAt(n, stages, i, marked), marked)
      ctx.fillStyle = color('--trail')
      ctx.beginPath()
      ctx.arc(...P(s, w), 3.5, 0, Math.PI * 2)
      ctx.fill()
    }

    const [s, w] = groverPlane(display, marked)
    const [tx, ty] = P(s, w)
    arrow(ctx, cx, cy, tx, ty, color('--accent'), 3.5)
    ctx.fillStyle = color('--accent')
    ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif'
    label(`state at ${fmt(deg(Math.atan2(w, s)), 1)}° from |s′⟩`, [8, 18])
  })

  // ---- Success probability vs iterations ----------------------------------
  const curve = useCanvas((frame) => {
    const { ctx, color } = frame
    const xRange: [number, number] = [0, maxIterations]
    const yRange: [number, number] = [0, 1]
    const area = plotArea(frame, xRange, yRange)
    grid(frame, area, xRange, yRange, { x: (v) => `${v}`, y: (v) => `${Math.round(v * 100)}%` })
    ctx.save()
    clip(ctx, area)
    ctx.strokeStyle = color('--marked')
    ctx.globalAlpha = 0.6
    ctx.setLineDash([4, 4])
    polyline(ctx, [
      [area.x(optimal), area.y(0)],
      [area.x(optimal), area.y(1)],
    ])
    ctx.setLineDash([])
    ctx.globalAlpha = 1
    ctx.strokeStyle = color('--accent')
    ctx.lineWidth = 2
    const xs = Array.from({ length: 200 }, (_, i) => (i / 199) * maxIterations)
    polyline(ctx, xs.map((k) => [area.x(k), area.y(successProbability(N, M, k))] as [number, number]))
    ctx.restore()
    for (let k = 0; k <= maxIterations; k++) {
      const p = successProbability(N, M, k)
      ctx.fillStyle = k === iterationsDone && stage >= 1 ? color('--live') : color('--accent')
      ctx.beginPath()
      ctx.arc(area.x(k), area.y(p), k === iterationsDone && stage >= 1 ? 6 : 3.5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = color('--marked')
    ctx.textAlign = 'left'
    ctx.fillText(`optimal: ${optimal}`, area.x(optimal) + 5, area.y(0.06))
  })

  const pMarked = [...marked].reduce((sum, i) => sum + display.re[i] ** 2 + display.im[i] ** 2, 0)
  const atEnd = stage >= stages.length - 1
  const optimalStage = 1 + 2 * optimal

  return (
    <section className="card">
      <SectionHead step={7} id="grover" title="Grover's search, step by step">
        <p>
          Find a marked item among <var>N</var> unsorted ones. Classically you check them one by one,
          about <var>N</var>/2 tries on average. Grover's algorithm needs only about (π/4)·√<var>N</var>{' '}
          queries. It never “checks all items at once”. Instead, each round nudges amplitude from the
          unmarked items onto the marked one. <strong>Click a bar</strong> to mark or unmark items.
        </p>
      </SectionHead>

      <div className="row">
        <span className="small">Qubits</span>
        {[2, 3, 4, 5, 6, 7].map((k) => (
          <button key={k} className={`chip ${n === k ? 'active' : ''}`} onClick={() => changeN(k)}>
            {k} <span className="muted">({2 ** k})</span>
          </button>
        ))}
        <span className="spacer" />
        <button className="chip" onClick={() => {
          const next = new Set([randomItem(N)])
          setMarked(next)
          jump(n, next, stage)
        }}>
          random target
        </button>
      </div>

      <div className="stage-strip">
        {stages.map((s, i) => (
          <button
            key={i}
            className={`stage ${i === stage ? 'active' : ''} ${i < stage ? 'done' : ''} ${s.kind} ${i === optimalStage ? 'optimal' : ''}`}
            onClick={() => go(i)}
            title={s.kind}
          >
            {s.kind === 'start' ? '|0⟩' : s.kind === 'hadamard' ? 'H⊗ⁿ' : s.kind === 'oracle' ? `O${s.iteration}` : `D${s.iteration}`}
          </button>
        ))}
      </div>

      <div className="row">
        <button onClick={() => go(stage - 1)} disabled={stage === 0}>
          ◀ Back
        </button>
        <button className="primary" onClick={() => go(stage + 1)} disabled={atEnd}>
          Next step ▶
        </button>
        <button onClick={() => void playTo(optimalStage)}>▶ Run to optimal ({optimal} iteration{optimal === 1 ? '' : 's'})</button>
        <button onClick={() => jump(n, marked, 1)}>Reset</button>
        <span className="spacer" />
        <button onClick={measure}>Measure</button>
      </div>

      <p className="callout">
        <b>
          {current.kind === 'start'
            ? 'Start'
            : current.kind === 'hadamard'
              ? 'Superposition'
              : `Iteration ${current.iteration}: ${current.kind === 'oracle' ? 'oracle' : 'diffusion'}`}
        </b>
        {' · '}
        {explain[current.kind](N, M)}
        {measured !== null && (
          <>
            <br />
            Measured <b className="mono">{ketLabel(measured, n)}</b>:{' '}
            {marked.has(measured) ? <b className="ok">a marked item ✓</b> : <b className="bad">not marked ✗</b>}
          </>
        )}
      </p>

      <canvas
        ref={bars.ref}
        className="canvas canvas-bars clickable"
        onClick={onBarsClick}
        aria-label="Amplitude of every item; click to mark"
      />
      <div className="legend">
        <span>
          <i className="swatch" style={{ background: 'var(--accent)' }} /> unmarked amplitude
        </span>
        <span>
          <i className="swatch" style={{ background: 'var(--marked)' }} /> marked amplitude ({[...marked].map((i) => ketLabel(i, n)).join(', ')})
        </span>
        <span>
          <i className="swatch" style={{ background: 'var(--exact)' }} /> mean amplitude
        </span>
      </div>

      <div className="grover-grid">
        <div className="stack tight">
          <h3>Two reflections make a rotation</h3>
          <canvas ref={plane.ref} className="canvas canvas-square" aria-label="Grover state in the marked/unmarked plane" />
          <p className="small muted">
            The state never leaves the plane of |w⟩ (marked) and |s′⟩ (unmarked). The oracle mirrors it
            across |s′⟩, diffusion mirrors it across |s⟩. Two mirrors make a rotation by 2θ, so each
            round turns the arrow 2θ = {fmt(deg(2 * theta), 1)}° closer to |w⟩.
          </p>
        </div>
        <div className="stack tight">
          <h3>Success probability</h3>
          <canvas ref={curve.ref} className="canvas canvas-square" aria-label="Success probability against iterations" />
          <p className="small muted">
            sin²((2<var>k</var> + 1)θ) after <var>k</var> rounds. Go past the optimum and the arrow
            overshoots |w⟩: the probability falls again. Unlike a classical search, more work isn't
            always better.
          </p>
        </div>
      </div>

      <dl className="stats stats-4">
        <div>
          <dt>Items N · marked M</dt>
          <dd>
            {N} · {M}
          </dd>
        </div>
        <div>
          <dt>P(measure a marked item) now</dt>
          <dd className="accent">{fmt(pMarked * 100, 1)}%</dd>
        </div>
        <div>
          <dt>Grover queries (optimal)</dt>
          <dd>
            {optimal} → {fmt(successProbability(N, M, optimal) * 100, 1)}%
          </dd>
        </div>
        <div>
          <dt>Classical average tries (N+1)/(M+1)</dt>
          <dd>{fmt((N + 1) / (M + 1), 1)}</dd>
        </div>
      </dl>
      <p className="hint">
        With 4 items and one marked, θ = 30°: one round turns the state from 30° to exactly 90°, so a
        single query finds the item every time. With 128 items one round turns only about 10°, and you
        need 8 rounds. That √<var>N</var> scaling is a proven quadratic speed-up for unstructured search.
      </p>
    </section>
  )
}
