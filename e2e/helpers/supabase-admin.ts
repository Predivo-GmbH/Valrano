/**
 * Supabase Admin helpers for E2E tests.
 *
 * Uses service_role key to create/delete test users, seed data, and clean up.
 * All operations target the STAGING Supabase project.
 */

const STAGING_URL = 'https://vfwpcgdkrwqhdivfzmrg.supabase.co'
const STAGING_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmd3BjZ2RrcndxaGRpdmZ6bXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTM0MjIsImV4cCI6MjA5NDc2OTQyMn0.oKmklW0md_-S5tqKT0fg-2Vz0lVh_qDf9jRvm3tqbHs'
const STAGING_SERVICE_ROLE_KEY =
  '***REDACTED-SECRET***'

const TEST_PASSWORD = 'E2eTestUser2026!'

/** Headers for service_role admin requests */
function adminHeaders() {
  return {
    apikey: STAGING_ANON_KEY,
    Authorization: `Bearer ${STAGING_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }
}

/** Headers for user-level requests */
function userHeaders(accessToken: string) {
  return {
    apikey: STAGING_ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

// ---------------------------------------------------------------------------
// User management
// ---------------------------------------------------------------------------

export interface TestUser {
  id: string
  email: string
  accessToken: string
  refreshToken: string
}

/** Create a test user via Admin API, return user ID + session tokens */
export async function createTestUser(emailPrefix = 'e2e-gap-test'): Promise<TestUser> {
  const email = `${emailPrefix}@valrano-test.local`

  // Delete if already exists
  const listRes = await fetch(`${STAGING_URL}/auth/v1/admin/users?page=1&per_page=50`, {
    headers: adminHeaders(),
  })
  if (listRes.ok) {
    const listData = await listRes.json()
    const existing = listData.users?.find((u: { email: string }) => u.email === email)
    if (existing) {
      await deleteTestUser(existing.id)
    }
  }

  // Create user
  const createRes = await fetch(`${STAGING_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { onboarding_dismissed: true },
    }),
  })
  if (!createRes.ok) throw new Error(`Failed to create test user: ${await createRes.text()}`)
  const created = await createRes.json()

  // Sign in to get tokens
  const signInRes = await fetch(`${STAGING_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: STAGING_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  })
  if (!signInRes.ok) throw new Error(`Failed to sign in test user: ${await signInRes.text()}`)
  const session = await signInRes.json()

  return {
    id: created.id,
    email,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  }
}

/** Delete a test user and their data via Admin API */
export async function deleteTestUser(userId: string): Promise<void> {
  // Delete user data in dependency order (best-effort)
  const tables = [
    'chat_messages',
    'chat_sessions',
    'ai_insights',
    'publication_events',
    'kpi_values',
    'reports',
    'peer_group_members',
    'peer_groups',
    'ir_catalog_items',
    'accounting_profiles',
    'my_companies',
    'google_connections',
    'corporate_templates',
    'companies',
    'workspace_members',
    'workspaces',
    'subscriptions',
  ]

  for (const table of tables) {
    const col = ['peer_groups', 'workspaces'].includes(table)
      ? 'owner_id'
      : ['companies', 'publication_events', 'ir_catalog_items'].includes(table)
        ? 'created_by'
        : 'user_id'

    await fetch(
      `${STAGING_URL}/rest/v1/${table}?${col}=eq.${userId}`,
      { method: 'DELETE', headers: adminHeaders() },
    ).catch(() => {})
  }

  // Delete the auth user
  await fetch(`${STAGING_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: adminHeaders(),
  })
}

// ---------------------------------------------------------------------------
// Google connection seeding
// ---------------------------------------------------------------------------

/** Seed a fake Google connection for a user (for testing disconnect flow) */
export async function seedGoogleConnection(userId: string): Promise<void> {
  await fetch(`${STAGING_URL}/rest/v1/google_connections`, {
    method: 'POST',
    headers: { ...adminHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: userId,
      google_email: 'test@gmail.com',
      access_token: 'fake-access-token-for-e2e',
      refresh_token: 'fake-refresh-token-for-e2e',
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    }),
  })
}

/** Remove Google connection for a user */
export async function removeGoogleConnection(userId: string): Promise<void> {
  await fetch(`${STAGING_URL}/rest/v1/google_connections?user_id=eq.${userId}`, {
    method: 'DELETE',
    headers: adminHeaders(),
  })
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { STAGING_URL, STAGING_ANON_KEY, STAGING_SERVICE_ROLE_KEY, TEST_PASSWORD }
