import { useState, type FormEvent } from 'react'
import { Mail, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface WaitlistFormProps {
  /** Where the form was opened from — stored with the signup for analytics. */
  source: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Status = 'idle' | 'submitting' | 'success' | 'already' | 'error'

/**
 * Registration is paused pre-launch. This captures an email into the `waitlist`
 * table (anon-insert RLS) so we can notify people when registration reopens.
 * Reused inside the waitlist modal and on the /signup route.
 */
export function WaitlistForm({ source }: WaitlistFormProps) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const value = email.trim().toLowerCase()
    if (!EMAIL_RE.test(value)) {
      setError('Please enter a valid email address.')
      return
    }
    setError(null)
    setStatus('submitting')
    const { error: insertError } = await supabase.from('waitlist').insert({ email: value, source })
    if (insertError) {
      // 23505 = unique violation → already on the list; treat as a friendly success.
      if (insertError.code === '23505') {
        setStatus('already')
        return
      }
      setStatus('error')
      setError('Something went wrong on our end. Please try again in a moment.')
      return
    }
    setStatus('success')
  }

  if (status === 'success' || status === 'already') {
    return (
      <div className="py-2 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-accent)]/15">
          <Check className="h-6 w-6 text-[var(--color-accent)]" strokeWidth={2} aria-hidden="true" />
        </div>
        <h3 className="mb-1.5 text-lg font-semibold text-[var(--color-foreground)]">You&rsquo;re on the list</h3>
        <p className="text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          {status === 'already'
            ? "That email is already on the waitlist — we'll be in touch the moment registration reopens."
            : "Thanks. We'll email you the moment we reopen registration."}
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="mb-5 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
        We&rsquo;ve paused new registrations while we onboard our first customers. Leave your email
        and we&rsquo;ll let you know the moment registration reopens — no spam, just the one message.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]"
            aria-hidden="true"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (error) setError(null)
            }}
            placeholder="you@company.com"
            autoComplete="email"
            aria-label="Email address"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] py-2.5 pl-9 pr-3 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
          />
        </div>
        {error && <p className="text-xs text-[var(--color-destructive)]">{error}</p>}
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 hover:shadow-lg hover:shadow-[var(--color-accent)]/25 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
        >
          {status === 'submitting' ? 'Submitting…' : 'Notify me when it reopens'}
        </button>
      </form>
    </div>
  )
}
