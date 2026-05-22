import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading')

  useEffect(() => {
    import('@/lib/supabase').then(({ supabase }) => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setStatus(session ? 'authenticated' : 'unauthenticated')
      }).catch(() => {
        setStatus('unauthenticated')
      })
    })
  }, [])

  if (status === 'loading') return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" role="status" aria-label="Loading" />
    </div>
  )
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
