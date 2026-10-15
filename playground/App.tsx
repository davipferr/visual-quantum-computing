import { useState } from 'react'
import { SpeedContext } from './animation'
import { Controls } from './Controls'
import { BellTest } from './sections/BellTest'
import { CircuitComposer } from './sections/CircuitComposer'
import { Entanglement } from './sections/Entanglement'
import { GatesAsRotations } from './sections/GatesAsRotations'
import { Grover } from './sections/Grover'
import { Measurement } from './sections/Measurement'
import { SingleQubit } from './sections/SingleQubit'

export function App() {
  const [speed, setSpeed] = useState(1)

  return (
    <SpeedContext.Provider value={speed}>
      <div className="page">
        <header className="page-header">
          <h1>Quantum computing, visually</h1>
          <p>
            Qubits as arrows on a sphere, gates as rotations, entanglement as arrows that vanish, and
            Grover's search one reflection at a time. Everything is interactive and simulated live.
          </p>
        </header>

        <div className="layout">
          <Controls speed={speed} onSpeed={setSpeed} />
          <main className="sections">
            <SingleQubit />
            <GatesAsRotations />
            <Measurement />
            <Entanglement />
            <BellTest />
            <CircuitComposer />
            <Grover />
          </main>
        </div>
      </div>
    </SpeedContext.Provider>
  )
}
