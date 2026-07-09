import { createContext } from 'react'

export interface WaitlistContextValue {
  /** Open the "registrations paused" waitlist modal. `source` is stored with the signup. */
  openWaitlist: (source?: string) => void
}

export const WaitlistContext = createContext<WaitlistContextValue | null>(null)
