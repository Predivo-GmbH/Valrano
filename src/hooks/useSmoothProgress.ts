import { useState, useEffect, useRef } from 'react'

/**
 * Smooth progress animation hook.
 *
 * Takes a `milestone` percentage (the real progress from backend steps)
 * and returns a `displayProgress` that smoothly animates between milestones
 * so the user never sees a stuck progress bar.
 *
 * Behavior:
 * - When a new milestone arrives, display jumps to at least that value
 * - Between milestones, display slowly creeps upward (+1% every ~2s)
 * - Creep is capped at milestone + 12% to avoid overshooting the next step
 * - When milestone hits 100, display immediately goes to 100
 * - When milestone resets to 0, display resets to 0
 */
export function useSmoothProgress(milestone: number): number {
  const [display, setDisplay] = useState(0)
  const milestoneRef = useRef(milestone)

  // When milestone changes, ensure display is at least at milestone
  useEffect(() => {
    milestoneRef.current = milestone
    if (milestone >= 100) {
      setDisplay(100)
      return
    }
    if (milestone <= 0) {
      setDisplay(0)
      return
    }
    // Jump display to milestone if behind
    setDisplay((prev) => Math.max(prev, milestone))
  }, [milestone])

  // Slow creep timer — always running when active (0 < milestone < 100)
  const isActive = milestone > 0 && milestone < 100
  useEffect(() => {
    if (!isActive) return

    const interval = setInterval(() => {
      setDisplay((prev) => {
        // Don't creep past milestone + 12, and never past 98
        const ceiling = Math.min(milestoneRef.current + 12, 98)
        if (prev >= ceiling) return prev
        return prev + 1
      })
    }, 2000)

    return () => clearInterval(interval)
  }, [isActive])

  return display
}
