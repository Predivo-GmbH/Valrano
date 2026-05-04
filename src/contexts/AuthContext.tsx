import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export interface AuthContextValue {
  user: SupabaseUser | null
  loading: boolean
  signInWithPassword: (email: string, password: string) => Promise<void>
  sendOtp: (email: string) => Promise<void>
  sendLoginOtp: (email: string) => Promise<void>
  verifyOtp: (email: string, token: string) => Promise<{ isNewUser: boolean }>
  hasCompletedProfile: () => boolean
  completeProfile: (password: string, fullName: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  deleteAccount: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const sendOtp = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    if (error) throw error
  }, [])

  const sendLoginOtp = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
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

  const resetPassword = useCallback(async (email: string) => {
    const redirectTo = `${window.location.origin}/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
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

  return (
    <AuthContext.Provider
      value={{
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
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export { AuthContext }
