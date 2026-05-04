import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [status] = useState('Processing...')

  useEffect(() => {
    async function handleCallback() {
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error) {
        if (import.meta.env.DEV) console.error('Auth callback error:', error)
        navigate('/login')
        return
      }

      const hash = window.location.hash
      const params = new URLSearchParams(hash.replace('#', ''))
      const type = params.get('type')

      if (type === 'recovery') {
        navigate('/reset-password')
      } else if (session) {
        const isNewUser = !session.user?.user_metadata?.full_name
        navigate(isNewUser ? '/signup' : '/dashboard')
      } else {
        navigate('/login')
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div className="flex h-screen items-center justify-center bg-[var(--color-background)]">
      <Helmet><title>Redirecting... - BenchmarkSignal</title><meta name="robots" content="noindex, nofollow" /></Helmet>
      <div className="text-center" role="status" aria-live="polite">
        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
        <p className="mt-4 text-sm text-[var(--color-muted-foreground)]">{status}</p>
      </div>
    </div>
  )
}
