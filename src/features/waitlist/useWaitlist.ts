import { useContext } from 'react'
import { WaitlistContext } from './waitlist-context'

export function useWaitlist() {
  const ctx = useContext(WaitlistContext)
  if (!ctx) throw new Error('useWaitlist must be used within WaitlistProvider')
  return ctx
}
