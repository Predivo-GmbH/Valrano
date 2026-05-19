/**
 * MSW request handlers for Supabase REST API.
 * These intercept actual fetch() calls from the Supabase client
 * and return realistic fixture data.
 */
import { http, HttpResponse } from 'msw'
import {
  companies,
  peerGroupWithMembers,
  peerGroupMembers,
  visibleCompanyIds,
  kpiDefinitions,
  kpiValues,
  subscription,
  myCompany,
  testUser,
} from '../fixtures'

// The Supabase URL used in tests (matches setup.ts mock)
const SUPABASE_URL = 'http://test.supabase.co'

// ---------------------------------------------------------------------------
// Helper: parse Supabase query params from URL
// ---------------------------------------------------------------------------

function getSelectParam(url: URL): string {
  return url.searchParams.get('select') ?? '*'
}

// ---------------------------------------------------------------------------
// REST API Handlers
// ---------------------------------------------------------------------------

export const handlers = [
  // ── RPC: visible_company_ids ──
  http.post(`${SUPABASE_URL}/rest/v1/rpc/visible_company_ids`, () => {
    return HttpResponse.json(visibleCompanyIds)
  }),

  // ── Companies ──
  http.get(`${SUPABASE_URL}/rest/v1/companies`, ({ request }) => {
    const url = new URL(request.url)
    const idFilter = url.searchParams.get('id')

    let result = companies.filter(c => c.is_active)

    // Handle .in('id', [...]) filter
    if (idFilter?.startsWith('in.')) {
      const ids = idFilter.replace('in.(', '').replace(')', '').split(',').map(s => s.replace(/"/g, ''))
      result = result.filter(c => ids.includes(c.id))
    }

    return HttpResponse.json(result)
  }),

  http.post(`${SUPABASE_URL}/rest/v1/companies`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    const newCompany = {
      id: `company-${Date.now()}`,
      ...body,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    return HttpResponse.json(newCompany, { status: 201 })
  }),

  // ── Peer Groups ──
  http.get(`${SUPABASE_URL}/rest/v1/peer_groups`, ({ request }) => {
    const url = new URL(request.url)
    const select = getSelectParam(url)

    if (select.includes('peer_group_members')) {
      return HttpResponse.json([peerGroupWithMembers])
    }

    return HttpResponse.json([peerGroupWithMembers])
  }),

  http.post(`${SUPABASE_URL}/rest/v1/peer_groups`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    const newPg = {
      id: `pg-${Date.now()}`,
      ...body,
      is_default: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    return HttpResponse.json(newPg, { status: 201 })
  }),

  // ── Peer Group Members ──
  http.get(`${SUPABASE_URL}/rest/v1/peer_group_members`, () => {
    return HttpResponse.json(peerGroupMembers)
  }),

  http.post(`${SUPABASE_URL}/rest/v1/peer_group_members`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json(body, { status: 201 })
  }),

  http.delete(`${SUPABASE_URL}/rest/v1/peer_group_members`, () => {
    return new HttpResponse(null, { status: 204 })
  }),

  // ── KPI Definitions ──
  http.get(`${SUPABASE_URL}/rest/v1/kpi_definitions`, () => {
    return HttpResponse.json(kpiDefinitions)
  }),

  // ── KPI Values ──
  http.get(`${SUPABASE_URL}/rest/v1/kpi_values`, ({ request }) => {
    const url = new URL(request.url)
    const companyFilter = url.searchParams.get('company_id')

    let result = [...kpiValues]
    if (companyFilter?.startsWith('in.')) {
      const ids = companyFilter.replace('in.(', '').replace(')', '').split(',').map(s => s.replace(/"/g, ''))
      result = result.filter(kv => ids.includes(kv.company_id))
    }
    return HttpResponse.json(result)
  }),

  // ── Subscriptions ──
  http.get(`${SUPABASE_URL}/rest/v1/subscriptions`, () => {
    return HttpResponse.json([subscription])
  }),

  // ── My Companies ──
  http.get(`${SUPABASE_URL}/rest/v1/my_companies`, () => {
    return HttpResponse.json([myCompany])
  }),

  http.post(`${SUPABASE_URL}/rest/v1/my_companies`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ id: `mc-${Date.now()}`, ...body }, { status: 201 })
  }),

  // ── Accounting Profiles ──
  http.get(`${SUPABASE_URL}/rest/v1/accounting_profiles`, () => {
    return HttpResponse.json([{
      id: 'ap-1',
      user_id: testUser.id,
      company_id: 'company-user',
      framework: 'IFRS',
      mentioned_competitors: [
        { name: 'Nestlé S.A.', ticker: 'NESN' },
        { name: 'Roche Holding AG', ticker: 'ROG' },
      ],
      created_at: '2026-01-01T00:00:00Z',
    }])
  }),

  // ── Publication Events ──
  http.get(`${SUPABASE_URL}/rest/v1/publication_events`, () => {
    return HttpResponse.json([])
  }),

  http.post(`${SUPABASE_URL}/rest/v1/publication_events`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ id: `pe-${Date.now()}`, ...body }, { status: 201 })
  }),

  // ── Auth ──
  http.get(`${SUPABASE_URL}/auth/v1/user`, () => {
    return HttpResponse.json(testUser)
  }),

  http.post(`${SUPABASE_URL}/auth/v1/token`, () => {
    return HttpResponse.json({
      access_token: 'test-access-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'test-refresh-token',
      user: testUser,
    })
  }),
]

// ---------------------------------------------------------------------------
// Empty state handlers — for testing new user with no data
// ---------------------------------------------------------------------------

export const emptyStateHandlers = [
  http.post(`${SUPABASE_URL}/rest/v1/rpc/visible_company_ids`, () => {
    return HttpResponse.json([])
  }),

  http.get(`${SUPABASE_URL}/rest/v1/peer_groups`, () => {
    return HttpResponse.json([])
  }),

  http.get(`${SUPABASE_URL}/rest/v1/my_companies`, () => {
    return HttpResponse.json([])
  }),

  http.get(`${SUPABASE_URL}/rest/v1/accounting_profiles`, () => {
    return HttpResponse.json([])
  }),

  http.get(`${SUPABASE_URL}/rest/v1/publication_events`, () => {
    return HttpResponse.json([])
  }),
]
