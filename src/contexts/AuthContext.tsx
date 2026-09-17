import { createContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export interface AuthContextValue {
  user: SupabaseUser | null
  loading: boolean
  /** Traditional email+password sign in. captchaToken is a Cloudflare Turnstile token,
   *  required once CAPTCHA is enabled in Auth settings (no-op before that). */
  signInWithPassword: (email: string, password: string, captchaToken?: string) => Promise<void>
  sendOtp: (email: string, captchaToken?: string) => Promise<void>
  sendLoginOtp: (email: string, captchaToken?: string) => Promise<void>
  verifyOtp: (email: string, token: string) => Promise<{ isNewUser: boolean }>
  hasCompletedProfile: () => boolean
  completeProfile: (password: string, fullName: string) => Promise<void>
  /** Send password reset email. captchaToken required once CAPTCHA is enabled (no-op before). */
  resetPassword: (email: string, captchaToken?: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  deleteAccount: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ---------------------------------------------------------------------------
// Prefetch critical data on login — eliminates cold-start waterfalls on
// Dashboard by warming the React Query cache before the page renders.
// ---------------------------------------------------------------------------
function prefetchCriticalData(queryClient: ReturnType<typeof useQueryClient>) {
  // visible_company_ids — used by useCompanies, useSmartYear, useReports
  queryClient.prefetchQuery({
    queryKey: ['visible-company-ids'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('visible_company_ids')
      if (error) throw error
      return (data ?? []) as string[]
    },
  })

  // Primary company — used by Dashboard for "my company" column
  queryClient.prefetchQuery({
    queryKey: ['my-companies', 'primary'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('my_companies')
        .select('id, user_id, company_id, name, sector, country, reporting_currency, headcount, founded_year, website_url, is_primary')
        .eq('is_primary', true)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  // KPI definitions — static reference data, rarely changes
  queryClient.prefetchQuery({
    queryKey: ['kpi-definitions'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpi_definitions')
        .select('*')
        .eq('is_active', true)
        .order('display_order')
      if (error) throw error
      return data
    },
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        // Verify user still exists server-side (handles deleted accounts)
        const { data: { user: verifiedUser }, error } = await supabase.auth.getUser()
        if (error || !verifiedUser) {
          // Only a DEFINITIVE miss (deleted account, invalid/revoked token) clears the
          // session. A transient failure - network blip, GoTrue 5xx, the ES256 kid-rotation
          // window this fleet hits sporadically - must NOT sign the user out. Measured
          // 2026-08-21: one transient getUser() error signed the e2e account out mid-crawl
          // and every route after it silently rendered signed-out.
          const transient =
            !!error &&
            (error.name === 'AuthRetryableFetchError' || error.status === 0 || (error.status ?? 0) >= 500)
          if (transient) {
            setUser(session.user)
            setLoading(false)
            return
          }
          // User was deleted or the token is definitively invalid — clear stale session
          await supabase.auth.signOut().catch(() => {})
          setUser(null)
          setLoading(false)
          return
        }
        setUser(verifiedUser)
        setLoading(false)
        prefetchCriticalData(queryClient)
      } else {
        setUser(null)
        setLoading(false)
      }
    }).catch((err) => {
      if (import.meta.env.DEV) console.error('Failed to get session:', err)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        prefetchCriticalData(queryClient)
      }
    })

    return () => subscription.unsubscribe()
  }, [queryClient])

  const signInWithPassword = useCallback(async (email: string, password: string, captchaToken?: string) => {
    // captchaToken is threaded through to GoTrue's /token endpoint. It is IGNORED by the server
    // until CAPTCHA is enabled in the project's Auth settings, so passing it (or not) is a no-op
    // today — which is exactly what makes shipping this client change outage-safe.
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    })
    if (error) throw error
  }, [])

  const sendOtp = useCallback(async (email: string, captchaToken?: string) => {
    // Sign out any existing session before starting signup flow —
    // prevents stale session data leaking into the new user's onboarding
    await supabase.auth.signOut().catch(() => {})
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, ...(captchaToken ? { captchaToken } : {}) },
    })
    if (error) throw error
  }, [])

  const sendLoginOtp = useCallback(async (email: string, captchaToken?: string) => {
    // shouldCreateUser: false — only sends OTP if account exists. Supabase returns 200
    // regardless (prevents email enumeration), so a still-tokenless request cannot be told apart
    // from a legitimate one at this level — captchaToken guards the /otp endpoint itself, once
    // CAPTCHA is enabled server-side. No-op until that switch is flipped.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, ...(captchaToken ? { captchaToken } : {}) },
    })
    if (error) throw error
  }, [])

  const verifyOtp = useCallback(async (email: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    })
    if (error) throw error
    const isNewUser = !data.user?.user_metadata?.full_name
    return { isNewUser }
  }, [])

  const completeProfile = useCallback(async (password: string, fullName: string) => {
    const { error } = await supabase.auth.updateUser({
      password,
      data: { full_name: fullName },
    })
    if (error) throw error

    supabase.functions.invoke('send-welcome', { method: 'POST' }).catch((err) => {
      if (import.meta.env.DEV) console.error('Welcome email failed:', err)
    })
  }, [])

  const resetPassword = useCallback(async (email: string, captchaToken?: string) => {
    // captchaToken guards the /recover endpoint (also captcha-protected project-wide once
    // enabled); no-op until CAPTCHA is enabled server-side.
    const redirectTo = `${window.location.origin}/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
      ...(captchaToken ? { captchaToken } : {}),
    })
    if (error) throw error
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  }, [])

  const hasCompletedProfile = useCallback(() => {
    if (!user) return false
    return !!user.user_metadata?.full_name
  }, [user])

  const deleteAccount = useCallback(async () => {
    const { error: fnError } = await supabase.functions.invoke('delete-account', {
      method: 'POST',
    })
    if (fnError) throw new Error(fnError.message || 'Failed to delete account')
    await supabase.auth.signOut()
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const value = useMemo(() => ({
    user,
    loading,
    signInWithPassword,
    sendOtp,
    sendLoginOtp,
    verifyOtp,
    hasCompletedProfile,
    completeProfile,
    resetPassword,
    updatePassword,
    deleteAccount,
    signOut,
  }), [user, loading, signInWithPassword, sendOtp, sendLoginOtp,
    verifyOtp, hasCompletedProfile, completeProfile,
    resetPassword, updatePassword, deleteAccount, signOut])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export { AuthContext }