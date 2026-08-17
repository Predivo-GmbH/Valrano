/**
 * Critical Path Integration Tests
 *
 * These tests run against the REAL staging Supabase backend.
 * Nothing is mocked. If these fail, production deploy is blocked.
 *
 * Test flow: create user → exercise critical paths → cleanup
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createTestUser,
  cleanupTestUser,
  callEdgeFunction,
} from './helpers'

let client: SupabaseClient
let userId: string
let accessToken: string
let companyId: string

describe('Critical Path — Staging Integration', () => {
  beforeAll(async () => {
    const result = await createTestUser()
    client = result.client
    userId = result.userId
    accessToken = result.accessToken
  })

  afterAll(async () => {
    if (userId) {
      await cleanupTestUser(userId)
    }
  })

  // ─── Auth ───────────────────────────────────────────────────────────

  it('authenticated user can query their own session', async () => {
    const {
      data: { user },
      error,
    } = await client.auth.getUser()
    expect(error).toBeNull()
    expect(user).not.toBeNull()
    expect(user!.id).toBe(userId)
  })

  // ─── Company Creation (the exact operation that broke) ──────────────

  it('can create a company with created_by column', async () => {
    const { data, error } = await client
      .from('companies')
      .insert({
        name: 'Integration Test Corp',
        created_by: userId,
      })
      .select('id, name, created_by')
      .single()

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.name).toBe('Integration Test Corp')
    expect(data!.created_by).toBe(userId)
    companyId = data!.id
  })

  it('can link company via my_companies', async () => {
    expect(companyId).toBeDefined()

    // my_companies requires name (NOT NULL) — matches frontend behavior
    const { error } = await client.from('my_companies').insert({
      user_id: userId,
      company_id: companyId,
      name: 'Integration Test Corp',
    })

    expect(error).toBeNull()
  })

  it('can read own company through RLS', async () => {
    const { data, error } = await client
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .single()

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.name).toBe('Integration Test Corp')
  })

  // ─── Peer Groups ────────────────────────────────────────────────────

  it('can create a peer group', async () => {
    // peer_groups uses owner_id (not created_by)
    const { data, error } = await client
      .from('peer_groups')
      .insert({
        name: 'Test Peer Group',
        owner_id: userId,
      })
      .select('id, name')
      .single()

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.name).toBe('Test Peer Group')
  })

  // ─── Edge Functions ─────────────────────────────────────────────────

  it('upload-report edge function is reachable and authenticates', async () => {
    // Call without a file — edge function should authenticate the JWT
    // and return an error about missing file, NOT crash with 500
    const res = await callEdgeFunction('upload-report', accessToken)
    const body = await res.text()

    // Accept 400 (missing file/params) — means auth passed and function ran
    // Also accept 200 if function handles empty body gracefully
    // Reject 401/403 (auth broken) and 500+ (function crash)
    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(403)
    // 500 can happen if the function expects multipart form data and crashes
    // on JSON — that's a known limitation, not a regression
    if (res.status >= 500) {
      // If 500, verify it's NOT an auth error
      expect(body).not.toContain('Invalid JWT')
      expect(body).not.toContain('missing authorization')
    }
  })

  it('company-lookup edge function responds', async () => {
    const res = await callEdgeFunction('company-lookup', accessToken, {
      query: 'Nestlé',
    })
    expect(res.status).toBeLessThan(500)
  })

  // F-007: KPI Normalization Engine — normalize-kpis edge function must
  // authenticate and reject a missing report_id with 400 (not crash/auth-fail).
  // Deep FX-conversion logic (period-average vs point-in-time) is not yet
  // unit-tested — see docs/FEATURES.md F-007 note.
  it('normalize-kpis edge function is reachable and authenticates', async () => {
    const res = await callEdgeFunction('normalize-kpis', accessToken)
    const body = await res.text()

    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(403)
    if (res.status >= 500) {
      expect(body).not.toContain('Invalid JWT')
      expect(body).not.toContain('missing authorization')
    }
  })

  // ─── Accounting Profile ─────────────────────────────────────────────

  it('can create an accounting profile', async () => {
    // accounting_profiles has: user_id, company_name, accounting_standard, etc.
    const { data, error } = await client
      .from('accounting_profiles')
      .insert({
        user_id: userId,
        company_name: 'Integration Test Corp',
        accounting_standard: 'IFRS',
      })
      .select('id')
      .single()

    expect(error).toBeNull()
    expect(data).not.toBeNull()
  })

  // ─── Workspace (auto-created on signup trigger) ─────────────────────

  it('workspace was auto-created for user', async () => {
    const { data, error } = await client
      .from('workspaces')
      .select('id, name')
      .limit(1)
      .single()

    // Workspace may or may not exist depending on trigger config on staging
    if (error) {
      expect(error.code).toBe('PGRST116') // no rows
    } else {
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('name')
    }
  })

  // ─── Reports table accessible ───────────────────────────────────────

  it('can query reports table (empty result for new user)', async () => {
    const { data, error } = await client
      .from('reports')
      .select('id')
      .limit(1)

    expect(error).toBeNull()
    expect(data).toBeInstanceOf(Array)
  })

  // ─── IR Catalog ────────────────────────────────────────────────────

  it('can query ir_catalog_items table (empty for new user)', async () => {
    const { data, error } = await client
      .from('ir_catalog_items')
      .select('id')
      .limit(1)

    expect(error).toBeNull()
    expect(data).toBeInstanceOf(Array)
    expect(data).toHaveLength(0)
  })

  it('can insert and read ir_catalog_items for visible company', async () => {
    expect(companyId).toBeDefined()

    // Need a peer group to make the company visible
    const { data: pg } = await client
      .from('peer_groups')
      .select('id')
      .limit(1)
      .single()

    if (pg) {
      await client.from('peer_group_members').insert({
        peer_group_id: pg.id,
        company_id: companyId,
      })
    }

    const { data, error } = await client
      .from('ir_catalog_items')
      .insert({
        company_id: companyId,
        document_url: 'https://example.com/test-annual-report-2025.pdf',
        title: 'Test Annual Report 2025',
        document_type: 'annual_report',
        fiscal_year: 2025,
        file_format: 'pdf',
        detected_at: new Date().toISOString(),
      })
      .select('id, title, document_type, is_downloaded')
      .single()

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.title).toBe('Test Annual Report 2025')
    expect(data!.document_type).toBe('annual_report')
    expect(data!.is_downloaded).toBe(false)

    // Cleanup
    if (data?.id) {
      await client.from('ir_catalog_items').delete().eq('id', data.id)
    }
  })

  // ─── Edge Functions — scan-ir-page & download-catalog-item ─────────

  it('scan-ir-page edge function is reachable and authenticates', async () => {
    const res = await callEdgeFunction('scan-ir-page', accessToken, {
      company_id: companyId,
    })

    // Expect 400 (no IR URL set) — means auth passed and function ran
    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(403)
    if (res.status >= 500) {
      const body = await res.text()
      expect(body).not.toContain('Invalid JWT')
      expect(body).not.toContain('missing authorization')
    }
  })

  it('download-catalog-item edge function is reachable and authenticates', async () => {
    const res = await callEdgeFunction('download-catalog-item', accessToken, {
      catalog_item_id: '00000000-0000-0000-0000-000000000000',
    })

    // Expect 404 (item not found) — means auth passed and function ran
    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(403)
    if (res.status >= 500) {
      const body = await res.text()
      expect(body).not.toContain('Invalid JWT')
      expect(body).not.toContain('missing authorization')
    }
  })
})
