import { formatComplex, type Complex } from 'visual-quantum-computing'
import type { ReactNode } from 'react'

export interface SliderProps {
  label: ReactNode
  value: number
  min: number
  max: number
  step: number
  unit?: string
  format?: (value: number) => string
  onChange: (value: number) => void
}

export function Slider({ label, value, min, max, step, unit, format, onChange }: SliderProps) {
  return (
    <label className="slider">
      <span className="slider-label">
        <span>{label}</span>
        <output>
          {format ? format(value) : value}
          {unit}
        </output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

export function SectionHead({ step, title, id, children }: { step: number; title: string; id: string; children: ReactNode }) {
  return (
    <div className="section-head" id={id}>
      <span className="step">{step}</span>
      <div>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

/** Phase → colour. Phase 0 is blue, π is orange, so a sign flip is impossible to miss. */
export function phaseColor(phase: number, alpha = 1): string {
  const hue = (((phase * 180) / Math.PI + 220) % 360 + 360) % 360
  return `hsla(${hue.toFixed(0)}, 75%, 55%, ${alpha})`
}

/** A tiny colour wheel legend for phases. */
export function PhaseLegend() {
  const stops = Array.from({ length: 13 }, (_, i) => phaseColor((i / 12) * 2 * Math.PI)).join(', ')
  return (
    <span className="phase-legend">
      <i className="phase-wheel" style={{ background: `conic-gradient(from 90deg, ${stops})` }} />
      phase: <b style={{ color: phaseColor(0) }}>0</b> · <b style={{ color: phaseColor(Math.PI / 2) }}>π/2</b> ·{' '}
      <b style={{ color: phaseColor(Math.PI) }}>π</b> · <b style={{ color: phaseColor(-Math.PI / 2) }}>−π/2</b>
    </span>
  )
}

/** "0.707 |0⟩ + 0.5i |1⟩" with zero terms dropped. */
export function KetSum({ amplitudes, n }: { amplitudes: Complex[]; n: number }) {
  const terms = amplitudes
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => Math.hypot(a.re, a.im) > 5e-4)
  return (
    <span className="ket-sum">
      {terms.map(({ a, i }, k) => {
        let text = formatComplex(a, 3)
        const negative = text.startsWith('−') && !text.includes(' ')
        if (negative) text = text.slice(1)
        const compound = text.includes(' ')
        const sign = k === 0 ? (negative ? '−' : '') : negative ? ' − ' : ' + '
        return (
          <span key={i} className="ket-term">
            {sign}
            {compound ? `(${text})` : text === '1' ? '' : text}
            <span className="ket">|{i.toString(2).padStart(n, '0')}⟩</span>
          </span>
        )
      })}
    </span>
  )
}

export const deg = (radians: number) => (radians * 180) / Math.PI
export const rad = (degrees: number) => (degrees * Math.PI) / 180
