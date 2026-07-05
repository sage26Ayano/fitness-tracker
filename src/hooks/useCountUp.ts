import { useEffect, useRef, useState } from 'react'

/** Animates from the previous value to `value` whenever it changes. */
export function useCountUp(value: number, durationMs = 700): number {
  const [display, setDisplay] = useState(value)
  const from = useRef(value)
  const raf = useRef<number>(0)

  useEffect(() => {
    const start = performance.now()
    const initial = from.current
    const delta = value - initial

    if (delta === 0) return

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(initial + delta * eased)
      if (t < 1) raf.current = requestAnimationFrame(tick)
      else from.current = value
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value, durationMs])

  return display
}
