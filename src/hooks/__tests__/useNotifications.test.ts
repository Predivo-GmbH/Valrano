import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockNotifications = [
  { id: '1', type: 'report', title: 'New Report', body: 'Body 1', link: null, is_read: false, related_document_id: null, related_report_id: null, created_at: '2026-05-01' },
  { id: '2', type: 'alert', title: 'Alert', body: 'Body 2', link: null, is_read: true, related_document_id: null, related_report_id: null, created_at: '2026-04-30' },
  { id: '3', type: 'report', title: 'Another', body: 'Body 3', link: null, is_read: false, related_document_id: null, related_report_id: null, created_at: '2026-04-29' },
]

const mockSelect = vi.fn()
const mockEq = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: (...args: unknown[]) => {
        mockSelect(...args)
        // Handle count query (useUnreadCount) vs full query (useNotifications)
        const hasCount = args.length > 1 && typeof args[1] === 'object' && (args[1] as Record<string, unknown>).count === 'exact'
        if (hasCount) {
          return {
            eq: (...eqArgs: unknown[]) => {
              mockEq(...eqArgs)
              return { count: 2, error: null }
            },
          }
        }
        return {
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              data: mockNotifications,
              error: null,
            })),
          })),
        }
      },
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { ...mockNotifications[0], is_read: true },
              error: null,
            })),
          })),
        })),
      })),
    })),
  },
}))

import { useNotifications, useUnreadCount } from '@/hooks/useNotifications'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useNotifications', () => {
  it('returns notifications list ordered by created_at desc', async () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => {
      expect(result.current.data).toHaveLength(3)
    })
    expect(result.current.data![0].id).toBe('1')
    expect(result.current.data![2].id).toBe('3')
  })

  it('returns all notification fields', async () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => {
      expect(result.current.data).toBeDefined()
    })
    const first = result.current.data![0]
    expect(first).toHaveProperty('id')
    expect(first).toHaveProperty('type')
    expect(first).toHaveProperty('title')
    expect(first).toHaveProperty('body')
    expect(first).toHaveProperty('is_read')
    expect(first).toHaveProperty('created_at')
  })

  it('reports loading state', () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    })
    // Initially loading
    expect(result.current.isLoading).toBe(true)
  })
})

describe('useUnreadCount', () => {
  it('returns count of unread notifications', async () => {
    const { result } = renderHook(() => useUnreadCount(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => {
      expect(result.current.data).toBe(2)
    })
  })

  it('filters by is_read = false', async () => {
    renderHook(() => useUnreadCount(), { wrapper: createWrapper() })
    await waitFor(() => {
      expect(mockEq).toHaveBeenCalledWith('is_read', false)
    })
  })
})
