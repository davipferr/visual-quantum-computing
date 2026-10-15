import { bellStates, ry } from 'visual-quantum-computing'
import { useState } from 'react'
import { clip, fmt, grid, plotArea, polyline, useCanvas } from '../canvas'
import { SectionHead, Slider, rad } from '../ui'

/**
 * The CHSH game. Alice measures her half of |Φ+⟩ along angle a or a′, Bob along
 * b or b′ (directions in the x–z plane of the Bloch sphere). Quantum mechanics
 * predicts a correlation E = cos(a − b). Any local "hidden instructions" model
 * keeps S = E(a,b) + E(a,b′) + E(a′,b) − E(a′,b′) between −2 and 2; quantum
 * pairs reach 2√2.
 */

interface Settings {
  a: number
  a2: number
  b: number
  b2: number
}

const optimal: Settings = { a: 0, a2: 90, b: 45, b2: -45 }

/** Measure both halves along their angles `shots` times; return the measured correlation. */
function correlation(a: number, b: number, shots: number): number {
  const state = bellStates['Φ+'].clone().apply(ry(-rad(a)), 0).apply(ry(-rad(b)), 1)
  const [n00, n01, n10, n11] = state.sample(shots)
  return (n00 + n11 - n01 - n10) / shots
}

/** The best a local hidden-variable model can do for |Φ+⟩: a straight-line "sawtooth". */
const classicalE = (delta: number) => {
  const d = Math.abs(((((delta + 180) % 360) + 360) % 360) - 180)
  return 1 - (2 * d) / 180
}

const pairs = [
  { key: 'ab', label: 'a, b', sign: 1 },
  { key: 'ab2', label: 'a, b′', sign: 1 },
  { key: 'a2b', label: 'a′, b', sign: 1 },
  { key: 'a2b2', label: 'a′, b′', sign: -1 },
] as const

export function BellTest() {
  const [settings, setSettings] = useState<Settings>(optimal)
  const [shots, setShots] = useState(500)
  const [results, setResults] = useState<Record<string, number> | null>(null)

  const angleOf = (key: (typeof pairs)[number]['key']): [number, number] => {
    const { a, a2, b, b2 } = settings
    return { ab: [a, b], ab2: [a, b2], a2b: [a2, b], a2b2: [a2, b2] }[key] as [number, number]
  }
  const theory = (key: (typeof pairs)[number]['key']) => {
    const [x, y] = angleOf(key)
    return Math.cos(rad(x - y))
  }
  const sTheory = pairs.reduce((s, p) => s + p.sign * theory(p.key), 0)
  const sMeasured = results ? pairs.reduce((s, p) => s + p.sign * results[p.key], 0) : null

  const run = () => {
    const r: Record<string, number> = {}
    for (const p of pairs) {
      const [x, y] = angleOf(p.key)
      r[p.key] = correlation(x, y, shots)
    }
    setResults(r)
  }

  const set = (patch: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...patch }))
    setResults(null)
  }

  const plot = useCanvas((frame) => {
    const { ctx, color } = frame
    const xRange: [number, number] = [-180, 180]
    const yRange: [number, number] = [-1.1, 1.1]
    const area = plotArea(frame, xRange, yRange)
    grid(frame, area, xRange, yRange, { x: (v) => `${v}°`, y: (v) => `${v}` })
    ctx.save()
    clip(ctx, area)
    const xs = Array.from({ length: 361 }, (_, i) => i - 180)
    ctx.lineWidth = 2
    ctx.strokeStyle = color('--exact')
    ctx.setLineDash([6, 4])
    polyline(ctx, xs.map((x) => [area.x(x), area.y(classicalE(x))] as [number, number]))
    ctx.setLineDash([])
    ctx.strokeStyle = color('--accent')
    polyline(ctx, xs.map((x) => [area.x(x), area.y(Math.cos(rad(x)))] as [number, number]))
    for (const p of pairs) {
      const [x, y] = angleOf(p.key)
      const delta = ((((x - y + 180) % 360) + 360) % 360) - 180
      const value = results ? results[p.key] : theory(p.key)
      ctx.fillStyle = results ? color('--live') : color('--muted')
      ctx.beginPath()
      ctx.arc(area.x(delta), area.y(value), 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = color('--text')
      ctx.textAlign = 'left'
      ctx.fillText(p.label, area.x(delta) + 7, area.y(value) - 6)
    }
    ctx.restore()
  })

  const gauge = (value: number) => `${Math.min(100, (Math.abs(value) / 3) * 100)}%`

  return (
    <section className="card">
      <SectionHead step={5} id="bell" title="Spooky correlations: a Bell test">
        <p>
          Could a Bell pair just carry hidden instructions, decided when it was made? Bell showed this
          can be tested. Alice picks one of two measurement angles, Bob picks one of two, and they
          combine the four correlations into <var>S</var>. Any hidden-instruction theory gives |
          <var>S</var>| ≤ 2. Quantum mechanics predicts up to 2√2 ≈ 2.83, and experiments agree with
          it (Nobel Prize 2022).
        </p>
      </SectionHead>

      <div className="split">
        <div className="stack">
          <Slider label={<>Alice <var>a</var></>} value={settings.a} min={-180} max={180} step={5} unit="°" onChange={(a) => set({ a })} />
          <Slider label={<>Alice <var>a′</var></>} value={settings.a2} min={-180} max={180} step={5} unit="°" onChange={(a2) => set({ a2 })} />
          <Slider label={<>Bob <var>b</var></>} value={settings.b} min={-180} max={180} step={5} unit="°" onChange={(b) => set({ b })} />
          <Slider label={<>Bob <var>b′</var></>} value={settings.b2} min={-180} max={180} step={5} unit="°" onChange={(b2) => set({ b2 })} />
          <Slider label="Shots per setting" value={shots} min={50} max={5000} step={50} onChange={setShots} />
          <div className="row">
            <button className="primary" onClick={run}>
              Run the experiment
            </button>
            <button className="chip" onClick={() => set(optimal)}>
              optimal angles
            </button>
            <button className="chip" onClick={() => set({ a: 0, a2: 0, b: 0, b2: 0 })}>
              all aligned
            </button>
          </div>
        </div>

        <div className="stack">
          <table className="errors">
            <thead>
              <tr>
                <th>Setting</th>
                <th>Angle gap</th>
                <th>Quantum E = cos(gap)</th>
                <th>Measured</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((p) => {
                const [x, y] = angleOf(p.key)
                return (
                  <tr key={p.key}>
                    <td>
                      {p.sign < 0 ? '− ' : '+ '}E({p.label})
                    </td>
                    <td>{x - y}°</td>
                    <td>{fmt(theory(p.key), 3)}</td>
                    <td>{results ? fmt(results[p.key], 3) : '–'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="s-gauge">
            <div className="s-row">
              <span>S predicted</span>
              <div className="s-track">
                <div className="s-fill theory" style={{ width: gauge(sTheory) }} />
                <i className="s-limit classical" style={{ left: gauge(2) }} />
                <i className="s-limit tsirelson" style={{ left: gauge(2 * Math.SQRT2) }} />
              </div>
              <b>{fmt(sTheory, 3)}</b>
            </div>
            <div className="s-row">
              <span>S measured</span>
              <div className="s-track">
                {sMeasured !== null && <div className="s-fill measured" style={{ width: gauge(sMeasured) }} />}
                <i className="s-limit classical" style={{ left: gauge(2) }} />
                <i className="s-limit tsirelson" style={{ left: gauge(2 * Math.SQRT2) }} />
              </div>
              <b>{sMeasured === null ? '–' : fmt(sMeasured, 3)}</b>
            </div>
            <p className="small muted">
              Grey tick: classical limit 2. Green tick: quantum maximum 2√2. {sMeasured !== null && Math.abs(sMeasured) > 2
                ? 'Your measured S beats every hidden-instruction theory.'
                : ''}
            </p>
          </div>
        </div>
      </div>

      <canvas ref={plot.ref} className="canvas canvas-short" aria-label="Correlation against angle difference" />
      <div className="legend">
        <span>
          <i className="swatch" style={{ background: 'var(--accent)' }} /> quantum: cos(a − b)
        </span>
        <span>
          <i className="swatch" style={{ background: 'var(--exact)' }} /> best hidden-instruction model
        </span>
        <span>
          <i className="swatch" style={{ background: 'var(--live)' }} /> your four settings ({results ? 'measured' : 'predicted'})
        </span>
      </div>
      <p className="hint">
        The curves touch at 0°, ±90° and ±180°, so aligned detectors can't tell them apart. The gap is
        widest near 45°, which is why the optimal settings put Alice's and Bob's angles 45° apart.
      </p>
    </section>
  )
}
