import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { loginSchema } from '@/lib/validation'
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
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { signInWithPassword, sendLoginOtp, verifyOtp, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  // Redirect authenticated users to dashboard
  if (!authLoading && user) return <Navigate to="/dashboard" replace />

  async function handlePasswordLogin(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const validation = loginSchema.safeParse({ email, password })
    if (!validation.success) {
      setError(validation.error.issues[0].message)
      return
    }
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
    try {
      await sendLoginOtp(email)
    } catch (err) {
      setError(friendlyAuthError(err, 'Failed to resend code'))
    }
  }

  function switchTab(t: Tab) {
    setTab(t)
    setError(null)
    setCodeStep('email')
  }

  return (
    <AuthLayout>
      <Helmet><title>Sign In - Valrano</title><meta name="robots" content="noindex, nofollow" /></Helmet>
      <h1 className="text-center text-2xl font-bold text-[var(--color-foreground)]">
        Sign in to Valrano
      </h1>

      {/* Tabs */}
      <div className="mt-6 flex rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-1" role="tablist" aria-label="Sign in method">
        <button
          role="tab"
          id="login-tab-password"
          aria-selected={tab === 'password'}
          aria-controls="login-tabpanel-password"
          tabIndex={tab === 'password' ? 0 : -1}
          onClick={() => switchTab('password')}
          className={`flex-1 rounded-md py-2.5 min-h-[44px] text-sm font-medium transition-all ${
            tab === 'password'
              ? 'bg-[var(--color-card)] text-[var(--color-foreground)] shadow-sm'
              : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
          }`}
        >
          Password
        </button>
        <button
          role="tab"
          id="login-tab-code"
          aria-selected={tab === 'code'}
          aria-controls="login-tabpanel-code"
          tabIndex={tab === 'code' ? 0 : -1}
          onClick={() => switchTab('code')}
          className={`flex-1 rounded-md py-2.5 min-h-[44px] text-sm font-medium transition-all ${
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
        <form onSubmit={handlePasswordLogin} className="mt-6 space-y-4" role="tabpanel" id="login-tabpanel-password" aria-labelledby="login-tab-password">
          {error && (
            <div id="login-error" role="alert" className="rounded-md bg-[var(--color-destructive)]/10 px-4 py-3 text-sm text-[var(--color-destructive)]">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-[var(--color-foreground)]">Email</label>
            <input id="login-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              aria-describedby={error ? 'login-error' : undefined}
              className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-3 text-base text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 sm:text-sm"
              placeholder="you@company.com" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className="block text-sm font-medium text-[var(--color-foreground)]">Password</label>
              <Link to="/forgot-password" className="inline-flex min-h-[44px] items-center text-xs font-medium text-[var(--color-accent)] hover:underline">Forgot password?</Link>
            </div>
            <div className="relative">
              <input id="login-password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
                aria-describedby={error ? 'login-error' : undefined}
                className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-3 pr-10 text-base text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 sm:text-sm"
                placeholder="Enter your password" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 mt-0.5 text-muted-foreground hover:text-foreground transition-colors" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white transition-all hover:brightness-110 hover:shadow-lg hover:shadow-[var(--color-accent)]/25 active:scale-[0.98] disabled:opacity-50 cursor-pointer">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      )}

      {/* Email Code Tab — Step 1: Email */}
      {tab === 'code' && codeStep === 'email' && (
        <form onSubmit={handleSendCode} className="mt-6 space-y-4" role="tabpanel" id="login-tabpanel-code" aria-labelledby="login-tab-code">
          {error && (
            <div id="code-error" role="alert" className="rounded-md bg-[var(--color-destructive)]/10 px-4 py-3 text-sm text-[var(--color-destructive)]">{error}</div>
          )}
          <p className="text-center text-sm text-[var(--color-muted-foreground)]">We'll send a sign-in code to your email if you have an account.</p>
          <div>
            <label htmlFor="code-email" className="block text-sm font-medium text-[var(--color-foreground)]">Email</label>
            <input id="code-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              aria-describedby={error ? 'code-error' : undefined}
              className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-3 text-base text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 sm:text-sm"
              placeholder="you@company.com" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white transition-all hover:brightness-110 hover:shadow-lg hover:shadow-[var(--color-accent)]/25 active:scale-[0.98] disabled:opacity-50 cursor-pointer">
            {loading ? 'Sending code...' : 'Send Sign-In Code'}
          </button>
        </form>
      )}

      {/* Email Code Tab — Step 2: Verify */}
      {tab === 'code' && codeStep === 'verify' && (
        <div className="mt-6 space-y-5" role="tabpanel" id="login-tabpanel-code" aria-labelledby="login-tab-code">
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
            className="block w-full py-3 min-h-[44px] text-center text-sm font-medium text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
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
