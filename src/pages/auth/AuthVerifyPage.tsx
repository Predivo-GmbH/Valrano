import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '@/hooks/useAuth'

export default function AuthVerifyPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { verifyOtp } = useAuth()
  const [error, setError] = useState<string | null>(null)

  const token = searchParams.get('token')
  const email = searchParams.get('email')
  const type = searchParams.get('type') || 'signup'

  useEffect(() => {
    if (!token || !email) {
      navigate('/login')
      return
    }

    async function verify() {
      try {
        await verifyOtp(email!, token!)
        if (type === 'signup') {
          navigate('/signup?verified=true')
        } else {
          navigate('/dashboard')
        }
      } catch {
        setError('This code has expired or is invalid. Please request a new one.')
      }
    }

    verify()
  }, [token, email, type, navigate, verifyOtp])

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-background)] px-4">
        <Helmet><title>Verification Failed - BenchmarkSignal</title><meta name="robots" content="noindex, nofollow" /></Helmet>
        <div className="mx-auto max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-destructive)]/10">
            <svg className="h-6 w-6 text-[var(--color-destructive)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-sm text-[var(--color-muted-foreground)]">{error}</p>
          <a href={type === 'signup' ? '/signup' : '/login'}
            className="mt-4 inline-block text-sm font-medium text-[var(--color-primary)] hover:underline">
            {type === 'signup' ? 'Try signing up again' : 'Go to login'}
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen items-center justify-center bg-[var(--color-background)]">
      <Helmet><title>Verifying... - BenchmarkSignal</title><meta name="robots" content="noindex, nofollow" /></Helmet>
      <div className="text-center" role="status" aria-live="polite">
        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
        <p className="mt-4 text-sm text-[var(--color-muted-foreground)]">Verifying your code...</p>
      </div>
    </div>
  )
}
