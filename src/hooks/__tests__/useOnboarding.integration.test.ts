/**
 * Integration test: useOnboarding status detection.
 *
 * Tests that onboarding status correctly reflects:
 * - hasFramework: accounting profile exists
 * - hasCompetitors: peer group with members exists
 * - hasSchedule: publication events exist
 * - isComplete: all three are true
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { peerGroupWithMembers, testUser } from '@/test/fixtures'

const SUPABASE_URL = 'http://test.supabase.co'

const server = setupServer(
  http.get(`${SUPABASE_URL}/auth/v1/user`, () => {
    return HttpResponse.json(testUser)
  }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

vi.mock('@/lib/supabase', () => {
  const { createClient } = require('@supabase/supabase-js')
  return {
    supabase: createClient(SUPABASE_URL, 'test-anon-key', {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  }
})

const { useOnboarding } = await import('@/hooks/useOnboarding')

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useOnboarding integration', () => {
  it('reports incomplete when no data exists (new user)', async () => {
    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/accounting_profiles`, () =>
        HttpResponse.json([])),
      http.get(`${SUPABASE_URL}/rest/v1/peer_groups`, () =>
        HttpResponse.json([])),
      http.get(`${SUPABASE_URL}/rest/v1/publication_events`, () =>
        HttpResponse.json([])),
    )

    const wrapper = createWrapper()
    const { result } = renderHook(() => useOnboarding(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    }, { timeout: 5000 })

    expect(result.current.status.hasFramework).toBe(false)
    expect(result.current.status.hasCompetitors).toBe(false)
    expect(result.current.status.hasSchedule).toBe(false)
    expect(result.current.status.isComplete).toBe(false)
    expect(result.current.status.completedSteps).toBe(0)
  })

  it('reports hasCompetitors when peer group has members', async () => {
    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/accounting_profiles`, () =>
        HttpResponse.json([])),
      http.get(`${SUPABASE_URL}/rest/v1/peer_groups`, () =>
        HttpResponse.json([peerGroupWithMembers])),
      http.get(`${SUPABASE_URL}/rest/v1/publication_events`, () =>
        HttpResponse.json([])),
    )

    const wrapper = createWrapper()
    const { result } = renderHook(() => useOnboarding(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    }, { timeout: 5000 })

    expect(result.current.status.hasCompetitors).toBe(true)
    expect(result.current.status.completedSteps).toBe(1)
  })

  it('reports complete when all three steps are done', async () => {
    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/accounting_profiles`, () =>
        HttpResponse.json([{
          id: 'ap-1',
          user_id: testUser.id,
          framework: 'IFRS',
        }])),
      http.get(`${SUPABASE_URL}/rest/v1/peer_groups`, () =>
        HttpResponse.json([peerGroupWithMembers])),
      http.get(`${SUPABASE_URL}/rest/v1/publication_events`, () =>
        HttpResponse.json([{
          id: 'pe-1',
          company_id: 'company-nestlé',
          report_type: 'annual',
          expected_date: '2026-03-15',
        }])),
    )

    const wrapper = createWrapper()
    const { result } = renderHook(() => useOnboarding(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    }, { timeout: 5000 })

    expect(result.current.status.hasFramework).toBe(true)
    expect(result.current.status.hasCompetitors).toBe(true)
    expect(result.current.status.hasSchedule).toBe(true)
    expect(result.current.status.isComplete).toBe(true)
    expect(result.current.status.completedSteps).toBe(3)
  })
})
