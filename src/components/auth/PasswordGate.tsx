import { useState, type FormEvent, type ReactNode } from 'react'

const GATE_PASSWORD_HASH = '3bd8037a8ed38a35825983767f94e6cf3b18c3deee1601daee71faec0d83565f'
const STORAGE_KEY = 'bs_unlocked'
const SCREENSHOT_MODE = import.meta.env.VITE_SCREENSHOT_MODE === 'true'

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export default function PasswordGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(
    () => SCREENSHOT_MODE || sessionStorage.getItem(STORAGE_KEY) === 'true'
  )
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(false)
    const hash = await sha256(password)
    if (hash === GATE_PASSWORD_HASH) {
      sessionStorage.setItem(STORAGE_KEY, 'true')
      setUnlocked(true)
    } else {
      setError(true)
    }
  }

  if (unlocked) return <>{children}</>

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-8">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-[var(--color-foreground)]">BenchmarkSignal</h1>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            Private beta — enter the access code
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="rounded-md bg-[var(--color-destructive)]/10 px-4 py-3 text-sm text-[var(--color-destructive)]">
              Incorrect password
            </div>
          )}
          <div>
            <label htmlFor="gate-password" className="sr-only">Access password</label>
            <input
              id="gate-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter access password"
              autoFocus
              required
              className="block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 text-base text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 sm:text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-3 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  )
}
