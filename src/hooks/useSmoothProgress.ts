import { useEffect, useMemo, useSyncExternalStore } from 'react'

/**
 * Smooth progress animation hook with continuous exponential-decay creep.
 *
 * Takes a `milestone` percentage (the real progress from backend steps)
 * and returns a `displayProgress` that smoothly animates between milestones.
 *
 * Uses useSyncExternalStore to avoid setState-in-effect lint violations.
 */

type Listener = () => void

function createProgressStore() {
  let display = 0
  let milestone = 0
  let intervalId: ReturnType<typeof setInterval> | null = null
  const listeners = new Set<Listener>()

  function notify() {
    for (const l of listeners) l()
  }

  function setMilestone(m: number) {
    milestone = m
    if (m >= 100) {
      display = 100
      stop()
      notify()
      return
    }
    if (m <= 0) {
      display = 0
      stop()
      notify()
      return
    }
    if (m > display) {
      display = m
      notify()
    }
    start()
  }

  function start() {
    if (intervalId) return
    intervalId = setInterval(() => {
      const hardCeiling = 98
      if (display >= hardCeiling) return
      const distFromMilestone = display - milestone
      const decayFactor = Math.exp(-distFromMilestone / 20)
      const remaining = hardCeiling - display
      const increment = Math.max(remaining * 0.02 * decayFactor, 0.05)
      const prev = display
      display = Math.min(display + increment, hardCeiling)
      if (Math.round(display) !== Math.round(prev)) {
        notify()
      }
    }, 200)
  }

  function stop() {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  function subscribe(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) stop()
    }
  }

  function getSnapshot() {
    return Math.round(display)
  }

  function reset() {
    display = 0
    milestone = 0
    stop()
  }

  return { setMilestone, subscribe, getSnapshot, reset }
}

export function useSmoothProgress(milestoneValue: number): number {
  const store = useMemo(() => createProgressStore(), [])

  useEffect(() => {
    store.setMilestone(milestoneValue)
  }, [milestoneValue, store])

  useEffect(() => {
    return () => store.reset()
  }, [store])

  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}
