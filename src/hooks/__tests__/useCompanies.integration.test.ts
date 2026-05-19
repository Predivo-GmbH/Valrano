/**
 * Integration test: useCompanies + useVisibleCompanyIds data flow.
 *
 * Tests that the actual data flow works:
 * - visible_company_ids RPC returns company IDs
 * - useCompanies fetches only those companies
 * - Empty visible IDs = empty companies list
 *
 * Uses MSW to intercept Supabase REST calls with realistic data.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { companies, visibleCompanyIds } from '@/test/fixtures'

// ---------------------------------------------------------------------------
// MSW server with Supabase REST handlers
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'http://test.supabase.co'

const server = setupServer(
  // visible_company_ids RPC
  http.post(`${SUPABASE_URL}/rest/v1/rpc/visible_company_ids`, () => {
    return HttpResponse.json(visibleCompanyIds)
  }),

  // Companies table
  http.get(`${SUPABASE_URL}/rest/v1/companies`, ({ request }) => {
    const url = new URL(request.url)
    const idFilter = url.searchParams.get('id')

    let result = companies.filter(c => c.is_active)
    if (idFilter?.startsWith('in.')) {
      const ids = idFilter.replace('in.(', '').replace(')', '').split(',').map(s => s.replace(/"/g, ''))
      result = result.filter(c => ids.includes(c.id))
    }
    return HttpResponse.json(result)
  }),

  // Auth — needed by Supabase client internals
  http.get(`${SUPABASE_URL}/auth/v1/user`, () => {
    return HttpResponse.json({ id: 'user-001-test', email: 'test@valrano.com' })
  }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// ---------------------------------------------------------------------------
// Real Supabase client (not mocked — MSW intercepts fetch)
// ---------------------------------------------------------------------------

// We need to use the REAL hooks with a REAL Supabase client pointing at our MSW server.
// Override the supabase module to use our test URL.
vi.mock('@/lib/supabase', () => {
  const { createClient } = require('@supabase/supabase-js')
  return {
    supabase: createClient(SUPABASE_URL, 'test-anon-key', {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  }
})

// Import hooks AFTER mocking supabase
const { useCompanies } = await import('@/hooks/useData')
const { useVisibleCompanyIds } = await import('@/hooks/useVisibleCompanyIds')

// ---------------------------------------------------------------------------
// Wrapper with fresh QueryClient per test
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useCompanies + useVisibleCompanyIds integration', () => {
  it('returns companies matching visible_company_ids RPC result', async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useCompanies(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    }, { timeout: 5000 })

    // Should return exactly the companies whose IDs are in visibleCompanyIds
    const returnedIds = result.current.data?.map(c => c.id) ?? []
    expect(returnedIds).toEqual(expect.arrayContaining(visibleCompanyIds))
    expect(returnedIds.length).toBe(visibleCompanyIds.length)
  })

  it('returns empty array when visible_company_ids returns empty', async () => {
    // Override the RPC to return empty
    server.use(
      http.post(`${SUPABASE_URL}/rest/v1/rpc/visible_company_ids`, () => {
        return HttpResponse.json([])
      }),
    )

    const wrapper = createWrapper()
    const { result } = renderHook(() => useCompanies(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    }, { timeout: 5000 })

    expect(result.current.data).toEqual([])
  })

  it('useVisibleCompanyIds returns company IDs from RPC', async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useVisibleCompanyIds(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    }, { timeout: 5000 })

    expect(result.current.data).toEqual(visibleCompanyIds)
  })

  it('useVisibleCompanyIds returns empty array for new user', async () => {
    server.use(
      http.post(`${SUPABASE_URL}/rest/v1/rpc/visible_company_ids`, () => {
        return HttpResponse.json([])
      }),
    )

    const wrapper = createWrapper()
    const { result } = renderHook(() => useVisibleCompanyIds(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    }, { timeout: 5000 })

    expect(result.current.data).toEqual([])
  })
})

describe('Cache invalidation behavior', () => {
  it('useCompanies updates when visible_company_ids cache is invalidated', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
    })
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)

    // Start with empty visible IDs
    server.use(
      http.post(`${SUPABASE_URL}/rest/v1/rpc/visible_company_ids`, () => {
        return HttpResponse.json([])
      }),
    )

    const { result } = renderHook(() => useCompanies(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    }, { timeout: 5000 })

    expect(result.current.data).toEqual([])

    // Now "create peer group members" — update the RPC response
    server.use(
      http.post(`${SUPABASE_URL}/rest/v1/rpc/visible_company_ids`, () => {
        return HttpResponse.json(visibleCompanyIds)
      }),
    )

    // Invalidate the cache (this is what the bug fix does)
    await queryClient.invalidateQueries({ queryKey: ['visible-company-ids'] })
    await queryClient.invalidateQueries({ queryKey: ['companies'] })

    await waitFor(() => {
      expect(result.current.data?.length).toBeGreaterThan(0)
    }, { timeout: 5000 })

    expect(result.current.data?.length).toBe(visibleCompanyIds.length)
  })
})
