import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setStatus(session ? 'authenticated' : 'unauthenticated')
    })
  }, [])

  if (status === 'loading') return null
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
