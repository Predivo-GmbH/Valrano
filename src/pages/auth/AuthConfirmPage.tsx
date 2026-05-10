import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '@/lib/supabase'

export default function AuthConfirmPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function confirm() {
      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type') as 'signup' | 'recovery' | 'magiclink' | 'email_change'
      const redirectTo = searchParams.get('redirect_to')

      if (!tokenHash || !type) {
        navigate('/login')
        return
      }

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type === 'recovery' ? 'recovery' : type === 'email_change' ? 'email_change' : 'email',
      })

      if (verifyError) {
        setError(verifyError.message)
        return
      }

      if (type === 'recovery') {
        navigate('/reset-password')
      } else if (data.session) {
        const isNewUser = !data.session.user?.user_metadata?.full_name
        navigate(isNewUser ? '/signup' : (redirectTo || '/dashboard'))
      } else {
        navigate('/login')
      }
    }

    confirm()
  }, [navigate, searchParams])

  return (
    <div className="flex h-screen items-center justify-center bg-[var(--color-background)]">
      <Helmet><title>Confirming... - BenchmarkSignal</title><meta name="robots" content="noindex, nofollow" /></Helmet>
      <div className="text-center" role="status" aria-live="polite">
        {error ? (
          <>
            <p className="text-sm text-red-500 mb-4" role="alert">{error}</p>
            <a href="/login" className="text-sm text-[var(--color-accent)] hover:underline">Back to login</a>
          </>
        ) : (
          <>
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
            <p className="mt-4 text-sm text-[var(--color-muted-foreground)]">Confirming...</p>
          </>
        )}
      </div>
    </div>
  )
}
