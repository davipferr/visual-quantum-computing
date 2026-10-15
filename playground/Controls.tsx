import { PhaseLegend, Slider } from './ui'

const sections = [
  ['bloch', 'One qubit on the Bloch sphere'],
  ['rotations', 'Gates are rotations'],
  ['measurement', 'Measurement'],
  ['entanglement', 'Two qubits and entanglement'],
  ['bell', 'A Bell test'],
  ['circuits', 'Circuit composer'],
  ['grover', "Grover's search"],
] as const

export function Controls({ speed, onSpeed }: { speed: number; onSpeed: (speed: number) => void }) {
  return (
    <aside className="card controls">
      <div>
        <h2>Contents</h2>
        <ol className="toc">
          {sections.map(([id, title]) => (
            <li key={id}>
              <a href={`#${id}`}>{title}</a>
            </li>
          ))}
        </ol>
      </div>

      <Slider
        label="Animation speed"
        value={speed}
        min={0.25}
        max={3}
        step={0.25}
        unit="×"
        onChange={onSpeed}
      />

      <div className="notes">
        <h3>Notation</h3>
        <dl className="glossary">
          <dt>|0⟩, |1⟩</dt>
          <dd>The two basis states, like a bit's 0 and 1.</dd>
          <dt>|+⟩, |−⟩</dt>
          <dd>(|0⟩ ± |1⟩)/√2, even superpositions.</dd>
          <dt>|+i⟩, |−i⟩</dt>
          <dd>(|0⟩ ± i|1⟩)/√2.</dd>
          <dt>|q₀q₁…⟩</dt>
          <dd>
            Qubit 0 is written <b>leftmost</b>: |10⟩ means q0 = 1, q1 = 0.
          </dd>
          <dt>Probability</dt>
          <dd>|amplitude|², the Born rule.</dd>
        </dl>
        <PhaseLegend />
      </div>

      <p className="muted small">
        Every number on this page comes from a small state-vector simulator in <code>src/</code>, written
        from scratch with no quantum libraries.
      </p>
    </aside>
  )
}
