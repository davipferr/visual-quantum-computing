import { onFrame } from 'visual-quantum-computing'
import { createContext, useCallback, useContext, useEffect, useRef } from 'react'

/** Global animation speed multiplier, set from the sidebar. */
export const SpeedContext = createContext(1)

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/**
 * One animation at a time: `play(ms, update)` calls `update(t)` every frame
 * with t eased from 0 to 1. Starting a new one finishes the current one
 * instantly (update(1)), so clicks never get lost or tangled.
 */
export function useTween() {
  const speed = useContext(SpeedContext)
  const speedRef = useRef(speed)
  speedRef.current = speed
  const current = useRef<{ stop: () => void; update: (t: number) => void; resolve: () => void } | null>(null)

  const finish = useCallback(() => {
    const c = current.current
    if (!c) return
    current.current = null
    c.stop()
    c.update(1)
    c.resolve()
  }, [])

  const play = useCallback(
    (ms: number, update: (t: number) => void) =>
      new Promise<void>((resolve) => {
        finish()
        const total = ms / 1000 / speedRef.current
        let elapsed = 0
        const entry = {
          update,
          resolve,
          stop: onFrame((dt) => {
            elapsed += dt
            const t = Math.min(1, elapsed / total)
            if (t >= 1) {
              finish()
              return
            }
            update(easeInOut(t))
          }),
        }
        current.current = entry
        update(0)
      }),
    [finish],
  )

  const isPlaying = useCallback(() => current.current !== null, [])

  useEffect(
    () => () => {
      current.current?.stop()
      current.current = null
    },
    [],
  )

  return { play, finish, isPlaying }
}
