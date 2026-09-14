/**
 * auth-captcha-token.test.tsx — proves the client half of the sign-in bot-protection fix.
 *
 * THE VULNERABILITY (measured live 2026-09-14): Valrano production Supabase
 * (mkdeftmubrkseyrrbzvp) accepted a TOKENLESS, unauthenticated POST to /auth/v1/recover with
 * HTTP 200, and a tokenless POST to /auth/v1/otp reached user-lookup (422 otp_disabled) rather
 * than being refused — security_captcha_enabled was false. Anyone who knows a customer's email
 * could make Valrano email them a password-reset link or login code, unlimited, from the shared
 * Postmark sending reputation.
 *
 * The fix threads a Cloudflare Turnstile captchaToken through every captcha-protected GoTrue
 * endpoint this app calls: signInWithPassword (/token), sendOtp (/otp signup), sendLoginOtp
 * (/otp login), resetPassword (/recover). Enabling CAPTCHA in Supabase Auth is PROJECT-WIDE, so
 * all four must carry the token or a server-side enable would lock real users out.
 *
 * This suite asserts each AuthContext method forwards the token into the exact Supabase options
 * field the SDK sends to GoTrue as options.captchaToken. It does NOT prove server enforcement —
 * that is a Supabase Auth-settings switch (Roger's / half 2, not this change) and is proven live
 * by signin-captcha.prod.test.mjs once flipped. This proves the wiring is correct and ready.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Full auth mock with spies for every method under test — overrides the global setup.ts mock
// for this file only. vi.hoisted, not a plain const: vi.mock's factory is hoisted above any
// top-level binding it closes over, so a plain `const auth = {...}` throws
// "ReferenceError: Cannot access 'auth' before initialization" (see ReplyFlow's identical suite,
// which hit this exact failure). vi.hoisted runs in the same hoisted phase as vi.mock, so the
// spies exist by the time the factory needs them.
const auth = vi.hoisted(() => ({
  getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
  getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
  onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
  signOut: vi.fn().mockResolvedValue({ error: null }),
  signInWithPassword: vi.fn().mockResolvedValue({ data: null, error: null }),
  signInWithOtp: vi.fn().mockResolvedValue({ data: null, error: null }),
  resetPasswordForEmail: vi.fn().mockResolvedValue({ data: null, error: null }),
}))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth,
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
  },
}))

import { AuthProvider } from '@/contexts/AuthContext'
import { useAuth } from '@/hooks/useAuth'

const TOKEN = 'turnstile-token-abc123'

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  )
}

async function mountAuth() {
  const { result } = renderHook(() => useAuth(), { wrapper })
  await waitFor(() => expect(result.current.loading).toBe(false))
  return result
}

beforeEach(() => {
  Object.values(auth).forEach((f) => 'mockClear' in f && f.mockClear())
})

describe('auth methods forward the Turnstile captchaToken to Supabase', () => {
  it('sendLoginOtp passes captchaToken (the endpoint the incident abused)', async () => {
    const result = await mountAuth()
    await act(async () => { await result.current.sendLoginOtp('user@example.com', TOKEN) })
    expect(auth.signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        options: expect.objectContaining({ shouldCreateUser: false, captchaToken: TOKEN }),
      }),
    )
  })

  it('sendOtp (signup) passes captchaToken', async () => {
    const result = await mountAuth()
    await act(async () => { await result.current.sendOtp('new@example.com', TOKEN) })
    expect(auth.signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@example.com',
        options: expect.objectContaining({ shouldCreateUser: true, captchaToken: TOKEN }),
      }),
    )
  })

  it('signInWithPassword passes captchaToken', async () => {
    const result = await mountAuth()
    await act(async () => { await result.current.signInWithPassword('user@example.com', 'pw', TOKEN) })
    expect(auth.signInWithPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        password: 'pw',
        options: expect.objectContaining({ captchaToken: TOKEN }),
      }),
    )
  })

  it('resetPassword passes captchaToken alongside redirectTo (the /recover endpoint measured open 2026-09-14)', async () => {
    const result = await mountAuth()
    await act(async () => { await result.current.resetPassword('user@example.com', TOKEN) })
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'user@example.com',
      expect.objectContaining({ captchaToken: TOKEN }),
    )
  })

  it('omits captchaToken cleanly when none is supplied (outage-safe no-op before server enable)', async () => {
    const result = await mountAuth()
    await act(async () => { await result.current.sendLoginOtp('user@example.com') })
    const arg = auth.signInWithOtp.mock.calls[0][0]
    expect(arg.options).toEqual({ shouldCreateUser: false })
    expect('captchaToken' in arg.options).toBe(false)
  })
})
