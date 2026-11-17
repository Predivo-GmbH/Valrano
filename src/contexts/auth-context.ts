import { createContext } from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'

// Lives apart from AuthContext.tsx so that file exports only the AuthProvider component:
// react-refresh/only-export-components (>= 0.5.7) rejects a createContext export next to a
// component, because Fast Refresh cannot hot-swap a file that mixes the two.

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

export const AuthContext = createContext<AuthContextValue | null>(null)
