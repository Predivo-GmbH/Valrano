import { useState, useEffect, useRef } from 'react'

/**
 * Smooth progress animation hook with continuous exponential-decay creep.
 *
 * Takes a `milestone` percentage (the real progress from backend steps)
 * and returns a `displayProgress` that smoothly animates between milestones
 * so the user never sees a stuck progress bar.
 *
 * Behavior:
 * - When a new milestone arrives, display jumps to at least that value
 * - A continuous interval (every 200ms) creeps the display toward 98%
 * - Creep rate decays exponentially with distance from the last milestone,
 *   so progress starts fast then gradually slows — but NEVER stops
 * - Uses setInterval (not RAF) so it works even when tab is backgrounded
 * - When milestone hits 100, display immediately goes to 100
 * - When milestone resets to 0, display resets to 0
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
        const hardCeiling = 98
        if (prev >= hardCeiling) return prev

        // Exponential decay: rate drops as display moves further from milestone
        // At milestone: full speed. 20% past milestone: ~37% speed. 40% past: ~14% speed.
        const distFromMilestone = prev - milestoneRef.current
        const decayFactor = Math.exp(-distFromMilestone / 20)
        const remaining = hardCeiling - prev
        // 2% of remaining * decay, with minimum 0.05 so bar never fully stops
        const increment = Math.max(remaining * 0.02 * decayFactor, 0.05)
        return Math.min(prev + increment, hardCeiling)
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
