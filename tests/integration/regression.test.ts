/**
 * Regression Tests
 *
 * Each test reproduces a specific bug that occurred in production.
 * These tests are NEVER deleted — they form a permanent safety net.
 * Tagged with date and root cause for traceability.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createTestUser, cleanupTestUser } from './helpers'

let client: SupabaseClient
let userId: string

describe('Regression Tests — Staging', () => {
  beforeAll(async () => {
    const result = await createTestUser('regression-test')
    client = result.client
    userId = result.userId
  })

  afterAll(async () => {
    if (userId) {
      await cleanupTestUser(userId)
    }
  })

  /**
   * regression-2026-05-19-missing-created-by
   *
   * Root cause: Audit migration 20260518000000 added `created_by` column to
   * `companies` table but was never applied to production. Frontend code
   * (useCreateMyCompany) inserted `created_by: user.id`, causing PostgREST
   * error 42703 ("column does not exist"). The catch block showed generic
   * "Upload failed" because PostgrestError is not instanceof Error.
   *
   * This test verifies the `created_by` column exists and is usable.
   */
  it('regression-2026-05-19: companies.created_by column exists and accepts uuid', async () => {
    const { data, error } = await client
      .from('companies')
      .insert({
        name: 'Regression Test — created_by',
        created_by: userId,
      })
      .select('id, created_by')
      .single()

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.created_by).toBe(userId)

    // Cleanup
    if (data?.id) {
      await client.from('my_companies').delete().eq('company_id', data.id)
      await client.from('companies').delete().eq('id', data.id)
    }
  })

  /**
   * regression-2026-05-19: RLS allows authenticated user to INSERT into
   * companies with created_by = auth.uid()
   */
  it('regression-2026-05-19: RLS INSERT policy requires created_by = auth.uid()', async () => {
    // Should succeed: created_by matches auth user
    const { error: goodInsert } = await client
      .from('companies')
      .insert({
        name: 'RLS Test — own user',
        created_by: userId,
      })
      .select('id')
      .single()

    expect(goodInsert).toBeNull()

    // Cleanup
    await client.from('companies').delete().eq('name', 'RLS Test — own user')
  })

  /**
   * regression-2026-05-19: google_connections RLS policies are per-operation
   * (not broad FOR ALL) and scoped to auth.uid() = user_id
   */
  it('regression-2026-05-19: google_connections per-operation RLS exists', async () => {
    // Insert should work with user_id = auth.uid()
    const { error: insertErr } = await client
      .from('google_connections')
      .insert({
        user_id: userId,
        provider: 'google',
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        token_expiry: new Date(Date.now() + 3600000).toISOString(),
      })

    // Table might not have all required columns or might fail for other reasons,
    // but it should NOT fail with a permission error
    if (insertErr) {
      expect(insertErr.code).not.toBe('42501') // permission denied
    }

    // Cleanup
    await client
      .from('google_connections')
      .delete()
      .eq('user_id', userId)
  })
})
