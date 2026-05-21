import { useState, type FormEvent, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
    () => SCREENSHOT_MODE || localStorage.getItem(STORAGE_KEY) === 'true'
  )
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(false)
    const hash = await sha256(password)
    if (hash === GATE_PASSWORD_HASH) {
      localStorage.setItem(STORAGE_KEY, 'true')
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
          <h1 className="text-xl font-bold text-[var(--color-foreground)]">Valrano</h1>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            Private beta — enter the access code
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="rounded-md bg-[var(--color-destructive)]/10 px-4 py-3 text-sm text-[var(--color-destructive)]">
              Incorrect access code
            </div>
          )}
          <div>
            <label htmlFor="gate-password" className="block text-sm font-medium text-[var(--color-foreground)] mb-1">Access code</label>
            <div className="relative">
              <input
                id="gate-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(false) }}
                placeholder="Enter access code"
                autoFocus
                required
                className="block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 pr-10 text-base text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 sm:text-sm"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full">
            Enter
          </Button>
        </form>
      </div>
    </div>
  )
}
