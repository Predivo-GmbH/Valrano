import { useState, useCallback, useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { WaitlistForm } from './WaitlistForm'
import { WaitlistContext } from './waitlist-context'

/**
 * Provides openWaitlist() app-wide and renders the "registrations paused" modal.
 * Every sign-up CTA calls openWaitlist(source) instead of navigating to /signup.
 * Self-contained modal (no dependency on the app's dialog) so it can wrap the
 * whole router, including the public landing page.
 */
export function WaitlistProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState('unknown')

  const openWaitlist = useCallback((src = 'unknown') => {
    setSource(src)
    setOpen(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <WaitlistContext.Provider value={{ openWaitlist }}>
      {children}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            data-gate-a="WaitlistProvider"
            aria-modal="true"
            aria-label="Join the waitlist"
            className="relative w-full max-w-md max-h-[85dvh] overflow-y-auto overscroll-contain rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-xl"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="mb-1 text-lg font-bold text-[var(--color-foreground)]">Registrations are paused</h2>
            <WaitlistForm source={source} />
          </div>
        </div>
      )}
    </WaitlistContext.Provider>
  )
}
