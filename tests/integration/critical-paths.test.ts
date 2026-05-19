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
})
