import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockRpc = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => {
      mockRpc(...args)
      return { data: ['company-1', 'company-2'], error: null }
    },
    from: (...args: unknown[]) => {
      mockFrom(...args)
      return {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn(() => ({
          data: [
            { fiscal_year: 2025 },
            { fiscal_year: 2024 },
            { fiscal_year: 2025 },
            { fiscal_year: 2023 },
          ],
          error: null,
        })),
      }
    },
  },
}))

import { useSmartYear } from '@/hooks/useSmartYear'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useSmartYear', () => {
  it('returns the most recent year as defaultYear when data exists', async () => {
    const { result } = renderHook(() => useSmartYear(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.defaultYear).toBe(2025)
  })

  it('returns availableYears sorted descending', async () => {
    const { result } = renderHook(() => useSmartYear(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    const years = result.current.availableYears
    expect(years.length).toBeGreaterThanOrEqual(3)
    // Verify descending order
    for (let i = 1; i < years.length; i++) {
      expect(years[i - 1]).toBeGreaterThan(years[i])
    }
  })

  it('calls visible_company_ids RPC', async () => {
    renderHook(() => useSmartYear(), { wrapper: createWrapper() })
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('visible_company_ids')
    })
  })

  it('queries kpi_values table', async () => {
    renderHook(() => useSmartYear(), { wrapper: createWrapper() })
    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('kpi_values')
    })
  })
})
