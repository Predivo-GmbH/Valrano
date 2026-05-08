import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '@/hooks/useAuth'
import AuthLayout from '@/components/auth/AuthLayout'
import OtpInput from '@/components/auth/OtpInput'
import ResendTimer from '@/components/auth/ResendTimer'
import PasswordStrength from '@/components/auth/PasswordStrength'
import { getPasswordScore } from '@/components/auth/password-utils'
import { friendlyAuthError } from '@/lib/utils'

type Step = 'email' | 'verify' | 'profile'

export default function SignUpPage() {
  const [searchParams] = useSearchParams()
  const { sendOtp, verifyOtp, completeProfile, hasCompletedProfile } = useAuth()
  const navigate = useNavigate()

  const getInitialStep = (): Step => {
    if (searchParams.get('verified') === 'true') {
      if (hasCompletedProfile()) {
        navigate('/dashboard')
        return 'email'
      }
      return 'profile'
    }
    return 'email'
  }

  const [step, setStep] = useState<Step>(getInitialStep)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSendCode(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await sendOtp(email)
      setStep('verify')
    } catch (err) {
      setError(friendlyAuthError(err, 'Failed to send verification code'))
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(code: string) {
    setError(null)
    setLoading(true)
    try {
      const { isNewUser } = await verifyOtp(email, code)
      if (isNewUser) {
        setStep('profile')
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      setError(friendlyAuthError(err, 'Invalid verification code'))
    } finally {
      setLoading(false)
    }
  }

  async function handleCompleteProfile(e: FormEvent) {
    e.preventDefault()
    if (getPasswordScore(password) < 3) {
      setError('Please choose a stronger password')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await completeProfile(password, fullName)
      navigate('/dashboard')
    } catch (err) {
      setError(friendlyAuthError(err, 'Failed to create account'))
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    await sendOtp(email)
  }

  const stepDots = (current: number) => (
    <nav className="mt-5 flex justify-center gap-2" aria-label="Sign up progress">
      {[0, 1, 2].map((i) => (
        <div key={i} className={`h-2 w-8 rounded-full ${i <= current ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`} />
      ))}
    </nav>
  )

  const inputCls = 'mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-3 text-base text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 sm:text-sm'
  const btnCls = 'w-full rounded-lg bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white transition-all hover:brightness-110 hover:shadow-lg hover:shadow-[var(--color-accent)]/25 active:scale-[0.98] disabled:opacity-50 cursor-pointer'

  return (
    <AuthLayout>
      <Helmet><title>Create Account - BenchmarkSignal</title><meta name="robots" content="noindex, nofollow" /></Helmet>

      {/* Step 1: Email */}
      {step === 'email' && (
        <div>
          <h1 className="text-center text-2xl font-bold text-[var(--color-foreground)]">Create your account</h1>
          <p className="mt-2 text-center text-sm text-[var(--color-muted-foreground)]">Private beta access</p>
          {stepDots(0)}
          <form onSubmit={handleSendCode} className="mt-8 space-y-4">
            {error && <div role="alert" className="rounded-md bg-[var(--color-destructive)]/10 px-4 py-3 text-sm text-[var(--color-destructive)]">{error}</div>}
            <div>
              <label htmlFor="signup-email" className="block text-sm font-medium text-[var(--color-foreground)]">Business email</label>
              <input id="signup-email" type="email" required autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="you@company.com" />
            </div>
            <button type="submit" disabled={loading} className={btnCls}>{loading ? 'Sending code...' : 'Continue'}</button>
          </form>
          <p className="mt-6 text-center text-sm text-[var(--color-muted-foreground)]">
            Already have an account? <Link to="/login" className="font-medium text-[var(--color-accent)] hover:underline">Sign in</Link>
          </p>
        </div>
      )}

      {/* Step 2: Verify OTP */}
      {step === 'verify' && (
        <div>
          <h1 className="text-center text-2xl font-bold text-[var(--color-foreground)]">Check your email</h1>
          <p className="mt-2 text-center text-sm text-[var(--color-muted-foreground)]">
            We sent a 6-digit code to <span className="font-medium text-[var(--color-foreground)]">{email}</span>
          </p>
          {stepDots(1)}
          <div className="mt-8 space-y-5">
            {error && <div role="alert" className="rounded-md bg-[var(--color-destructive)]/10 px-4 py-3 text-sm text-[var(--color-destructive)]">{error}</div>}
            <OtpInput onComplete={handleVerify} disabled={loading} />
            {loading && <p className="text-center text-sm text-[var(--color-muted-foreground)]">Verifying...</p>}
            <ResendTimer onResend={handleResend} />
          </div>
          <button onClick={() => { setStep('email'); setError(null) }}
            className="mt-6 block w-full text-center text-sm font-medium text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
            &larr; Use a different email
          </button>
        </div>
      )}

      {/* Step 3: Complete Profile */}
      {step === 'profile' && (
        <div>
          <h1 className="text-center text-2xl font-bold text-[var(--color-foreground)]">Complete your account</h1>
          <p className="mt-2 text-center text-sm text-[var(--color-muted-foreground)]">Set your name and password for future sign-ins.</p>
          {stepDots(2)}
          <form onSubmit={handleCompleteProfile} className="mt-8 space-y-4">
            {error && <div role="alert" className="rounded-md bg-[var(--color-destructive)]/10 px-4 py-3 text-sm text-[var(--color-destructive)]">{error}</div>}
            <div>
              <label htmlFor="signup-name" className="block text-sm font-medium text-[var(--color-foreground)]">Full name</label>
              <input id="signup-name" type="text" required autoComplete="name" autoFocus value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} placeholder="Maria Schmidt" />
            </div>
            <div>
              <label htmlFor="signup-password" className="block text-sm font-medium text-[var(--color-foreground)]">Password</label>
              <input id="signup-password" type="password" required autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="Min. 8 characters" />
              <PasswordStrength password={password} />
            </div>
            <button type="submit" disabled={loading} className={btnCls}>{loading ? 'Creating account...' : 'Create Account'}</button>
          </form>
        </div>
      )}
    </AuthLayout>
  )
}
