import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthContext, type AuthContextValue } from '@/contexts/AuthContext'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}))

import { useSubscription } from '@/hooks/useSubscription'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

function createWrapper(user: import('@supabase/supabase-js').User | null) {
  const authValue: AuthContextValue = {
    user,
    loading: false,
    signInWithPassword: vi.fn(),
    sendOtp: vi.fn(),
    sendLoginOtp: vi.fn(),
    verifyOtp: vi.fn(),
    hasCompletedProfile: vi.fn(() => false),
    completeProfile: vi.fn(),
    resetPassword: vi.fn(),
    updatePassword: vi.fn(),
    deleteAccount: vi.fn(),
    signOut: vi.fn(),
  }
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(AuthContext.Provider, { value: authValue }, children),
    )
  }
}

describe('useSubscription', () => {
  it('returns starter tier when no user', async () => {
    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(null),
    })
    await waitFor(() => {
      expect(result.current.tier).toBe('starter')
      expect(result.current.status).toBe('active')
    })
  })

  it('returns starter tier when no subscription found', async () => {
    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper({ id: 'user-1', email: 'test@example.com' }),
    })
    await waitFor(() => {
      expect(result.current.tier).toBe('starter')
    })
  })
})
