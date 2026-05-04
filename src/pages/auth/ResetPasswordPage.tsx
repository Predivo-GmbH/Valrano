import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '@/hooks/useAuth'
import AuthLayout from '@/components/auth/AuthLayout'
import PasswordStrength from '@/components/auth/PasswordStrength'
import { getPasswordScore } from '@/components/auth/password-utils'
import { friendlyAuthError } from '@/lib/utils'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const { updatePassword, user } = useAuth()
  const navigate = useNavigate()

  if (!user && !success) {
    navigate('/forgot-password')
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (getPasswordScore(password) < 3) {
      setError('Please choose a stronger password')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await updatePassword(password)
      setSuccess(true)
    } catch (err) {
      setError(friendlyAuthError(err, 'Failed to reset password'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <Helmet><title>Reset Password - BenchmarkSignal</title><meta name="robots" content="noindex, nofollow" /></Helmet>

      {success ? (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
            <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Password updated</h1>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">Your password has been reset successfully.</p>
          <button onClick={() => navigate('/dashboard')}
            className="mt-6 rounded-lg bg-[var(--color-primary)] px-6 py-2.5 text-sm font-medium text-white hover:opacity-90">
            Go to Dashboard
          </button>
        </div>
      ) : (
        <>
          <h1 className="text-center text-2xl font-bold text-[var(--color-foreground)]">Set new password</h1>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && <div role="alert" className="rounded-md bg-[var(--color-destructive)]/10 px-4 py-3 text-sm text-[var(--color-destructive)]">{error}</div>}
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-[var(--color-foreground)]">New password</label>
              <input id="new-password" type="password" required autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                placeholder="Min. 8 characters" />
              <PasswordStrength password={password} />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-[var(--color-foreground)]">Confirm password</label>
              <input id="confirm-password" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                placeholder="Confirm password" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50">
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </>
      )}
    </AuthLayout>
  )
}
