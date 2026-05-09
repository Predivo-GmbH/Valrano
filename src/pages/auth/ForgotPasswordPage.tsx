import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '@/hooks/useAuth'
import AuthLayout from '@/components/auth/AuthLayout'
import { friendlyAuthError } from '@/lib/utils'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { resetPassword } = useAuth()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await resetPassword(email)
      setSent(true)
    } catch (err) {
      setError(friendlyAuthError(err, 'Failed to send reset email'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <Helmet><title>Forgot Password - BenchmarkSignal</title><meta name="robots" content="noindex, nofollow" /></Helmet>

      {sent ? (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-accent)]/10">
            <svg className="h-6 w-6 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Check your email</h1>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            We sent a password reset link to <span className="font-medium text-[var(--color-foreground)]">{email}</span>
          </p>
          <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
            Check your spam folder if you don't see it within a few minutes.
          </p>
          <div className="mt-6 flex flex-col items-center gap-2">
            <button onClick={() => setSent(false)} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
              Resend or try a different email
            </button>
            <Link to="/login" className="text-sm font-medium text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
              Back to sign in
            </Link>
          </div>
        </div>
      ) : (
        <>
          <h1 className="text-center text-2xl font-bold text-[var(--color-foreground)]">Reset your password</h1>
          <p className="mt-2 text-center text-sm text-[var(--color-muted-foreground)]">Enter your email and we'll send you a reset link.</p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && <div role="alert" className="rounded-md bg-[var(--color-destructive)]/10 px-4 py-3 text-sm text-[var(--color-destructive)]">{error}</div>}
            <div>
              <label htmlFor="reset-email" className="block text-sm font-medium text-[var(--color-foreground)]">Email</label>
              <input id="reset-email" type="email" required autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-3 text-base text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 sm:text-sm"
                placeholder="you@company.com" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-3 text-sm font-medium text-[var(--color-primary-foreground)] transition-colors hover:opacity-90 disabled:opacity-50">
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-[var(--color-muted-foreground)]">
            <Link to="/login" className="font-medium text-[var(--color-accent)] hover:underline">Back to sign in</Link>
          </p>
        </>
      )}
    </AuthLayout>
  )
}
