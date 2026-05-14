import { useState, useEffect, useRef } from 'react'

/**
 * Smooth progress animation hook with continuous asymptotic creep.
 *
 * Takes a `milestone` percentage (the real progress from backend steps)
 * and returns a `displayProgress` that smoothly animates between milestones
 * so the user never sees a stuck progress bar.
 *
 * Behavior:
 * - When a new milestone arrives, display jumps to at least that value
 * - A continuous interval (every 200ms) creeps the display toward ceiling
 *   using asymptotic decay: each tick moves 3% of the remaining gap
 * - Ceiling = milestone + 25 (capped at 98) — enough headroom to fill long gaps
 * - The bar NEVER stops moving until milestone hits 100 or resets to 0
 * - Uses setInterval (not RAF) so it works even when tab is backgrounded
 */
export function useSmoothProgress(milestone: number): number {
  const [display, setDisplay] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const milestoneRef = useRef(0)

  // Snap display on milestone change
  useEffect(() => {
    milestoneRef.current = milestone
    if (milestone >= 100) {
      setDisplay(100)
    } else if (milestone <= 0) {
      setDisplay(0)
    } else {
      setDisplay((prev) => Math.max(prev, milestone))
    }
  }, [milestone])

  // Continuous creep — runs while 0 < milestone < 100
  const isActive = milestone > 0 && milestone < 100
  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      setDisplay((prev) => {
        const ceiling = Math.min(milestoneRef.current + 25, 98)
        if (prev >= ceiling) return prev
        // Asymptotic: 3% of remaining gap per tick, min 0.1
        const remaining = ceiling - prev
        const increment = Math.max(remaining * 0.03, 0.1)
        return Math.min(prev + increment, ceiling)
      })
    }, 200)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isActive])

  return Math.round(display)
}
