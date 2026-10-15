# Visual Quantum Computing

A small, educational state-vector quantum simulator in TypeScript, plus an interactive
React 19 playground about it: Bloch spheres, gates as rotations, measurement, entanglement,
a Bell test, a circuit composer, and Grover's search step by step. There are no quantum or
math libraries. Complex numbers, gates and the simulator are written by hand, and every
picture is drawn on a 2-D canvas.

```ts
import { QuantumState, gates, grover, ketLabel } from 'visual-quantum-computing'

// A Bell pair: H on qubit 0, then CNOT 0 → 1
const bell = QuantumState.zero(2).apply(gates.H.matrix, 0).apply(gates.X.matrix, 1, [0])
bell.probabilities() // [0.5, 0, 0, 0.5]
bell.bloch(0)        // [0, 0, 0]: entangled, so qubit 0 alone has no direction

// Grover: find item 11 among 16
const found = grover(4, [11]).measureAll()
ketLabel(found, 4)   // '|1011⟩' (96% of the time)
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | The playground (see below) |
| `npm test` | Vitest: gates, rotations, state vector, entanglement, circuits, Grover |
| `npm run build` | Library build (ESM + CJS + `.d.ts`) into `dist/` |
| `npm run build:playground` | Static playground build into `dist-playground/` |
| `npm run typecheck` | `tsc --noEmit` over library and playground |

## Playground

`npm run dev` opens one page with seven interactive sections:

1. **One qubit on the Bloch sphere**: drag the state arrow, orbit the sphere, and click gates
   (X, Y, Z, H, S, T, √X, Rx/Ry/Rz) to watch them rotate the state about their axis. Live
   amplitudes, probabilities, angles and the (invisible) global phase.
2. **Gates are rotations**: six coloured marker states show the whole sphere turning. Each gate's
   matrix and its axis–angle form, plus a sequence composer that shows identities like
   `H Z H = X`.
3. **Measurement**: prepare any state, measure along Z, X or Y, and watch the running frequency
   converge to the Born-rule probability.
4. **Two qubits and entanglement**: two Bloch spheres for the reduced states, whose arrows shrink
   as entanglement grows. Includes amplitude circles, CNOT/CZ/SWAP, Bell states, concurrence,
   entropy, and measuring one half of a pair.
5. **A Bell test (CHSH)**: choose Alice's and Bob's angles, run the experiment, and beat the
   classical bound |S| ≤ 2.
6. **Circuit composer**: up to 5 qubits on a 12-column grid, with controls (●) and swaps (×).
   Step forwards and backwards with animated partial gates. Examples include Bell, GHZ,
   teleportation, QFT, phase kickback, Toffoli and a 2-qubit Grover.
7. **Grover's search**: 2–7 qubits, click bars to mark items, step through oracle and diffusion.
   Three linked views show the amplitude bars with their mean, the 2-D rotation picture, and
   success probability against iterations, including overshooting.

A sidebar holds the contents, an animation-speed slider and the notation.

## How it works

### 1. Complex numbers: [`src/complex.ts`](src/complex.ts)

Immutable `{ re, im }` values with the handful of operations a simulator needs.

### 2. Gates: [`src/gates.ts`](src/gates.ts)

A single-qubit gate is a 2×2 unitary, `[m00, m01, m10, m11]`. The key function is
**`toAxisAngle`**, which writes any gate as `e^{iγ}·R_n(θ)`: a global phase times a rotation by θ
about axis n. Since `det(e^{iγ}R) = e^{2iγ}`, γ comes from the determinant. The rotation's
entries `cos(θ/2) − i·sin(θ/2)(n·σ)` then give n and θ directly.

**`fractionalGate(U, t)`** is `e^{iγt}·R_n(θt)`, a smooth path from the identity to U. The
playground animates every gate with it, controlled gates included. There the "global" phase
becomes a relative one, which is why it has to be part of the path.

### 3. The state vector: [`src/state.ts`](src/state.ts)

`QuantumState` holds 2ⁿ amplitudes in two `Float64Array`s. **Qubit 0 is the leftmost symbol** of a
ket, as in textbooks; Qiskit uses the opposite order.

- **`apply(U, target, controls)`**: the amplitudes pair up, each index with `target = 0` with its
  partner with `target = 1`. U mixes each pair exactly as it mixes (α, β) for a lone qubit, but
  only where every control bit is 1. That loop is the whole simulator.
- **`swap(a, b, controls, t)`**: SWAPᵗ = P_sym + e^{iπt}·P_anti, so a swap can animate too.
- **Measurement**: `measureQubit` samples by the Born rule and then projects and renormalizes.
  `sample` runs many shots without disturbing the state. Seed it with `seededRandom` for
  repeatable runs.
- **`bloch(q)`**: the Bloch vector of qubit q's reduced density matrix, computed from
  `ρ00 − ρ11` and `ρ01`. Its length is 1 for a pure qubit and shrinks to 0 when the qubit is
  maximally entangled with the others.

### 4. Bloch sphere and entanglement: [`src/bloch.ts`](src/bloch.ts)

Conversions between amplitudes, Bloch vectors and (θ, φ). Also the concurrence
`2·|a00·a11 − a01·a10|`, the entanglement entropy and the four Bell states.

### 5. Circuits: [`src/circuit.ts`](src/circuit.ts)

A circuit is a grid of cells: a gate, `'control'`, `'swap'` or empty. As in Quirk, a control dot
controls every gate in its column. `circuitFromRows(['H ● -', '- X ●', '- - X'])` builds GHZ from
text. `applyColumn(state, column, t)` applies a partial column for animation.

### 6. Grover: [`src/grover.ts`](src/grover.ts)

The oracle flips the sign of the marked amplitudes, and diffusion maps `a → 2·mean − a`. Each
iteration is two reflections, which together make a rotation by 2θ in the plane of |w⟩ (marked)
and |s′⟩ (unmarked), where `sin θ = √(M/N)`. After k rounds the success probability is
`sin²((2k + 1)θ)`, and the optimal k is about `(π/4)·√(N/M)`. `groverPlane` returns the state's
coordinates in that plane for the playground's picture.

### Playground internals

- [`playground/sphere.ts`](playground/sphere.ts): an orthographic Bloch sphere on canvas. The
  camera has yaw and pitch. Great circles are split into back (dashed) and front halves, and
  there is screen-to-sphere unprojection for dragging the state arrow.
- [`playground/animation.ts`](playground/animation.ts): `useTween`, one eased animation at a time
  on the shared rAF loop ([`src/frameloop.ts`](src/frameloop.ts)). Starting a new animation
  finishes the old one instantly, so fast clicks never get lost.
- [`playground/amplitudes.ts`](playground/amplitudes.ts): Quirk-style amplitude circles. Disc area
  is the probability; colour and hand show the phase.

## Known limitations

These are deliberate, to keep the project small:

- Pure states only: no noise, no density-matrix simulation, no mid-circuit classical control.
  Teleportation uses the deferred-measurement form.
- The simulator caps at 16 qubits (2¹⁶ amplitudes) and the playground at 5 (composer) and 7 (Grover).
- The composer has the fixed gate set only, with no parameterised rotations.
