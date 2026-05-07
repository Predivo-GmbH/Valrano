import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '@/hooks/useAuth'
import AuthLayout from '@/components/auth/AuthLayout'
import OtpInput from '@/components/auth/OtpInput'
import ResendTimer from '@/components/auth/ResendTimer'
import { friendlyAuthError } from '@/lib/utils'

type Tab = 'password' | 'code'
type CodeStep = 'email' | 'verify'

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>('password')
  const [codeStep, setCodeStep] = useState<CodeStep>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { signInWithPassword, sendLoginOtp, verifyOtp } = useAuth()
  const navigate = useNavigate()

  async function handlePasswordLogin(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signInWithPassword(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(friendlyAuthError(err, 'Login failed'))
    } finally {
      setLoading(false)
    }
  }

  async function handleSendCode(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await sendLoginOtp(email)
      setCodeStep('verify')
    } catch (err) {
      setError(friendlyAuthError(err, 'Failed to send login code'))
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyCode(code: string) {
    setError(null)
    setLoading(true)
    try {
      await verifyOtp(email, code)
      navigate('/dashboard')
    } catch (err) {
      setError(friendlyAuthError(err, 'Invalid verification code'))
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    await sendLoginOtp(email)
  }

  function switchTab(t: Tab) {
    setTab(t)
    setError(null)
    setCodeStep('email')
  }

  return (
    <AuthLayout>
      <Helmet><title>Sign In - BenchmarkSignal</title><meta name="robots" content="noindex, nofollow" /></Helmet>
      <h1 className="text-center text-2xl font-bold text-[var(--color-foreground)]">
        Sign in to BenchmarkSignal
      </h1>

      {/* Tabs */}
      <div className="mt-6 flex rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-1" role="tablist" aria-label="Sign in method">
        <button
          role="tab"
          aria-selected={tab === 'password'}
          onClick={() => switchTab('password')}
          className={`flex-1 rounded-md py-2.5 text-sm font-medium transition-all ${
            tab === 'password'
              ? 'bg-[var(--color-card)] text-[var(--color-foreground)] shadow-sm'
              : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
          }`}
        >
          Password
        </button>
        <button
          role="tab"
          aria-selected={tab === 'code'}
          onClick={() => switchTab('code')}
          className={`flex-1 rounded-md py-2.5 text-sm font-medium transition-all ${
            tab === 'code'
              ? 'bg-[var(--color-card)] text-[var(--color-foreground)] shadow-sm'
              : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
          }`}
        >
          Email Code
        </button>
      </div>

      {/* Password Tab */}
      {tab === 'password' && (
        <form onSubmit={handlePasswordLogin} className="mt-6 space-y-4">
          {error && (
            <div role="alert" className="rounded-md bg-[var(--color-destructive)]/10 px-4 py-3 text-sm text-[var(--color-destructive)]">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-[var(--color-foreground)]">Email</label>
            <input id="login-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-3 text-base text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 sm:text-sm"
              placeholder="you@company.com" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className="block text-sm font-medium text-[var(--color-foreground)]">Password</label>
              <Link to="/forgot-password" className="inline-flex min-h-[44px] items-center text-xs font-medium text-[var(--color-accent)] hover:underline">Forgot password?</Link>
            </div>
            <input id="login-password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-3 text-base text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 sm:text-sm"
              placeholder="Enter your password" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-3 text-sm font-medium text-[var(--color-primary-foreground)] transition-colors hover:opacity-90 disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      )}

      {/* Email Code Tab — Step 1: Email */}
      {tab === 'code' && codeStep === 'email' && (
        <form onSubmit={handleSendCode} className="mt-6 space-y-4">
          {error && (
            <div role="alert" className="rounded-md bg-[var(--color-destructive)]/10 px-4 py-3 text-sm text-[var(--color-destructive)]">{error}</div>
          )}
          <p className="text-center text-sm text-[var(--color-muted-foreground)]">We'll send a sign-in code to your email if you have an account.</p>
          <div>
            <label htmlFor="code-email" className="block text-sm font-medium text-[var(--color-foreground)]">Email</label>
            <input id="code-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-3 text-base text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 sm:text-sm"
              placeholder="you@company.com" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-3 text-sm font-medium text-[var(--color-primary-foreground)] transition-colors hover:opacity-90 disabled:opacity-50">
            {loading ? 'Sending code...' : 'Send Sign-In Code'}
          </button>
        </form>
      )}

      {/* Email Code Tab — Step 2: Verify */}
      {tab === 'code' && codeStep === 'verify' && (
        <div className="mt-6 space-y-5">
          <p className="text-center text-sm text-[var(--color-muted-foreground)]">
            Enter the 6-digit code sent to <span className="font-medium text-[var(--color-foreground)]">{email}</span>
          </p>
          {error && (
            <div role="alert" className="rounded-md bg-[var(--color-destructive)]/10 px-4 py-3 text-sm text-[var(--color-destructive)]">{error}</div>
          )}
          <OtpInput onComplete={handleVerifyCode} disabled={loading} />
          {loading && <p className="text-center text-sm text-[var(--color-muted-foreground)]">Verifying...</p>}
          <ResendTimer onResend={handleResend} />
          <button onClick={() => { setCodeStep('email'); setError(null) }}
            className="block w-full py-3 text-center text-sm font-medium text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
            &larr; Use a different email
          </button>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-[var(--color-muted-foreground)]">
        Don&apos;t have an account?{' '}
        <Link to="/signup" className="font-medium text-[var(--color-accent)] hover:underline">Create account</Link>
      </p>
    </AuthLayout>
  )
}
