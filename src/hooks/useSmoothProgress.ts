import { useState, useEffect, useRef } from 'react'

/**
 * Smooth progress animation hook with continuous exponential-decay creep.
 *
 * Takes a `milestone` percentage (the real progress from backend steps)
 * and returns a `displayProgress` that smoothly animates between milestones.
 */
export function useSmoothProgress(milestone: number): number {
  const [display, setDisplay] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const milestoneRef = useRef(0)

  // Snap display on milestone change — setState here is intentional
  // (synchronizing display with external milestone prop, not cascading renders)
  useEffect(() => {
    milestoneRef.current = milestone
    if (milestone >= 100) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplay(100)
    } else if (milestone <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplay(0)
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
        const distFromMilestone = prev - milestoneRef.current
        const decayFactor = Math.exp(-distFromMilestone / 20)
        const remaining = hardCeiling - prev
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
