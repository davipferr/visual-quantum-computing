import { amplitudesFromSpherical, fromSpherical, gates, QuantumState, type Vec3 } from 'visual-quantum-computing'
import { useState } from 'react'
import { useTween } from '../animation'
import { clip, fmt, grid, plotArea, polyline, useCanvas } from '../canvas'
import { drawBlochSphere, useBlochCanvas } from '../sphere'
import { KetSum, SectionHead, Slider, rad } from '../ui'

type Basis = 'Z' | 'X' | 'Y'

const bases: Record<Basis, { axis: Vec3; outcomes: [string, string]; note: string }> = {
  Z: { axis: [0, 0, 1], outcomes: ['|0⟩', '|1⟩'], note: 'the standard basis' },
  X: { axis: [1, 0, 0], outcomes: ['|+⟩', '|−⟩'], note: 'apply H, then measure' },
  Y: { axis: [0, 1, 0], outcomes: ['|+i⟩', '|−i⟩'], note: 'apply S†, then H, then measure' },
}

/** Rotate the state so the chosen basis lines up with |0⟩/|1⟩, then measure. */
function measureOnce(state: QuantumState, basis: Basis): 0 | 1 {
  const s = state.clone()
  if (basis === 'Y') s.apply(gates.Sdg.matrix, 0)
  if (basis !== 'Z') s.apply(gates.H.matrix, 0)
  return s.measureQubit(0)
}

const MAX_POINTS = 4000

export function Measurement() {
  const tween = useTween()
  const [theta, setTheta] = useState(60)
  const [phi, setPhi] = useState(45)
  const [basis, setBasis] = useState<Basis>('Z')
  const [counts, setCounts] = useState<[number, number]>([0, 0])
  const [series, setSeries] = useState<number[]>([])
  const [collapse, setCollapse] = useState<{ v: Vec3; outcome: 0 | 1 } | null>(null)

  const prepared = QuantumState.fromAmplitudes(amplitudesFromSpherical({ theta: rad(theta), phi: rad(phi) }))
  const v = fromSpherical({ theta: rad(theta), phi: rad(phi) })
  const { axis, outcomes } = bases[basis]
  const expected = (1 + v[0] * axis[0] + v[1] * axis[1] + v[2] * axis[2]) / 2

  const clear = () => {
    setCounts([0, 0])
    setSeries([])
    setCollapse(null)
  }

  const record = (results: (0 | 1)[]) => {
    let [a, b] = counts
    const next = [...series]
    for (const r of results) {
      if (r === 0) a++
      else b++
      if (next.length < MAX_POINTS) next.push(a / (a + b))
    }
    setCounts([a, b])
    setSeries(next)
  }

  const shoot = (shots: number) => {
    tween.finish()
    setCollapse(null)
    record(Array.from({ length: shots }, () => measureOnce(prepared, basis)))
  }

  const shootOnce = () => {
    const outcome = measureOnce(prepared, basis)
    record([outcome])
    const pole: Vec3 = outcome === 0 ? axis : [-axis[0], -axis[1], -axis[2]]
    void tween.play(450, (t) => {
      const mix = v.map((c, i) => c + (pole[i] - c) * t) as unknown as Vec3
      const length = Math.hypot(...mix) || 1
      setCollapse({ v: mix.map((c) => c / length) as unknown as Vec3, outcome })
    })
  }

  const sphere = useBlochCanvas((frame, view) =>
    drawBlochSphere(frame, view, {
      measureAxis: { v: axis, color: frame.color('--measure') },
      axis: { v: axis, color: frame.color('--measure') },
      vectors: [
        ...(collapse ? [{ v, color: frame.color('--target'), width: 2 }] : []),
        { v: collapse?.v ?? v, color: collapse ? frame.color('--live') : frame.color('--accent') },
      ],
    }),
  )

  const plot = useCanvas((frame) => {
    const { ctx, color } = frame
    const total = Math.max(10, series.length)
    const xRange: [number, number] = [0, total]
    const yRange: [number, number] = [0, 1]
    const area = plotArea(frame, xRange, yRange)
    grid(frame, area, xRange, yRange, { x: (x) => `${x}`, y: (y) => `${Math.round(y * 100)}%` })
    ctx.save()
    clip(ctx, area)
    ctx.strokeStyle = color('--exact')
    ctx.setLineDash([6, 4])
    ctx.lineWidth = 2
    polyline(ctx, [
      [area.x(0), area.y(expected)],
      [area.x(total), area.y(expected)],
    ])
    ctx.setLineDash([])
    ctx.strokeStyle = color('--accent')
    polyline(ctx, series.map((f, i) => [area.x(i + 1), area.y(f)] as [number, number]))
    ctx.restore()
  })

  const total = counts[0] + counts[1]

  return (
    <section className="card">
      <SectionHead step={3} id="measurement" title="Measurement">
        <p>
          Measuring asks the qubit a yes/no question along one axis of the sphere. The answer is
          random: the chance of landing on each end is (1 ± cos <var>γ</var>)/2, where <var>γ</var> is
          the angle between the state and that axis (the Born rule, |amplitude|²). Afterwards the
          state <em>is</em> the answer: the superposition is gone.
        </p>
      </SectionHead>

      <div className="split">
        <div className="stack">
          <canvas ref={sphere.ref} className="canvas canvas-sphere draggable" aria-label="Measurement on the Bloch sphere" {...sphere.handlers} />
        </div>
        <div className="stack">
          <Slider label={<>Polar angle <var>θ</var></>} value={theta} min={0} max={180} step={1} unit="°" onChange={(t) => {
            setTheta(t)
            clear()
          }} />
          <Slider label={<>Phase <var>φ</var></>} value={phi} min={-180} max={180} step={1} unit="°" onChange={(p) => {
            setPhi(p)
            clear()
          }} />
          <div className="mono">
            |ψ⟩ = <KetSum amplitudes={prepared.amplitudes()} n={1} />
          </div>

          <div className="row">
            <span className="small">Measure along</span>
            {(Object.keys(bases) as Basis[]).map((b) => (
              <button
                key={b}
                className={`chip ${basis === b ? 'active' : ''}`}
                onClick={() => {
                  setBasis(b)
                  clear()
                }}
              >
                {b}
              </button>
            ))}
            <span className="muted small">({bases[basis].note})</span>
          </div>

          <div className="row">
            <button className="primary" onClick={shootOnce}>
              Measure once
            </button>
            <button onClick={() => shoot(10)}>×10</button>
            <button onClick={() => shoot(100)}>×100</button>
            <button onClick={() => shoot(1000)}>×1000</button>
            <button className="link" onClick={clear}>
              clear
            </button>
          </div>

          {collapse && (
            <p className="callout">
              Got <b>{outcomes[collapse.outcome]}</b>. The state collapsed onto it; the next shot
              starts from a freshly prepared |ψ⟩.
            </p>
          )}

          <div className="histogram">
            {outcomes.map((label, i) => {
              const p = i === 0 ? expected : 1 - expected
              const measured = total ? counts[i] / total : 0
              return (
                <div key={label} className="hist-row">
                  <span className="mono">{label}</span>
                  <div className="prob-track tall">
                    <div className="prob-fill" style={{ width: `${measured * 100}%` }} />
                    <div className="prob-marker" style={{ left: `${p * 100}%` }} title="expected" />
                  </div>
                  <span className="mono small">
                    {counts[i]} · {fmt(measured * 100, 1)}%
                  </span>
                </div>
              )
            })}
            <p className="muted small">
              Bars: measured frequency over {total} shots. Amber tick: the Born-rule probability{' '}
              {fmt(expected * 100, 1)}%.
            </p>
          </div>
        </div>
      </div>

      <canvas ref={plot.ref} className="canvas canvas-short" aria-label="Running frequency of the first outcome" />
      <div className="legend">
        <span>
          <i className="swatch" style={{ background: 'var(--accent)' }} /> running frequency of {outcomes[0]}
        </span>
        <span>
          <i className="swatch" style={{ background: 'var(--exact)' }} /> probability |⟨{outcomes[0].slice(1, -1)}|ψ⟩|²
        </span>
      </div>
      <p className="hint">
        Change φ while measuring along Z: nothing changes, because a relative phase doesn't affect Z
        statistics. Switch to X or Y and the phase suddenly matters. Information about a qubit is
        spread across bases, and one shot only ever reveals one bit of it.
      </p>
    </section>
  )
}
