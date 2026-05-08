import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { AuthContext, type AuthContextValue } from '@/contexts/AuthContext'

// Import after context is available
import { useAuth } from '@/hooks/useAuth'

const mockAuthValue: AuthContextValue = {
  user: null,
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

function wrapper({ children }: { children: ReactNode }) {
  return createElement(AuthContext.Provider, { value: mockAuthValue }, children)
}

describe('useAuth', () => {
  it('returns auth context value when inside AuthProvider', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.user).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(typeof result.current.signOut).toBe('function')
  })

  it('throws when used outside AuthProvider', () => {
    expect(() => {
      renderHook(() => useAuth())
    }).toThrow('useAuth must be used within AuthProvider')
  })

  it('returns user when authenticated', () => {
    const authedValue = {
      ...mockAuthValue,
      user: { id: 'user-1', email: 'test@example.com' } as unknown as import('@supabase/supabase-js').User,
    }
    function authedWrapper({ children }: { children: ReactNode }) {
      return createElement(AuthContext.Provider, { value: authedValue }, children)
    }
    const { result } = renderHook(() => useAuth(), { wrapper: authedWrapper })
    expect(result.current.user?.id).toBe('user-1')
  })
})
