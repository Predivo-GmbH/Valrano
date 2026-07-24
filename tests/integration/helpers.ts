import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const STAGING_URL = process.env.SUPABASE_STAGING_URL!
const STAGING_ANON_KEY = process.env.SUPABASE_STAGING_ANON_KEY!
const STAGING_SERVICE_ROLE_KEY = process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY!

const TEST_PASSWORD = 'IntegrationTest2026!'

if (!STAGING_URL || !STAGING_ANON_KEY || !STAGING_SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing staging env vars: SUPABASE_STAGING_URL, SUPABASE_STAGING_ANON_KEY, SUPABASE_STAGING_SERVICE_ROLE_KEY'
  )
}

const TRANSIENT_JWT = /invalid jwt|unable to parse|unrecognized|bad_jwt|\bkid\b|\bjws\b|verify signature/i

/**
 * Retry a Supabase admin-auth call through the transient GoTrue signing-key window. During an ES256
 * key rotation GoTrue can briefly reject a VALID admin token ("invalid JWT / unable to parse or
 * verify signature / unrecognized kid <nil> for ES256 / bad_jwt"); it self-heals in seconds. We
 * retry that transient class with backoff. A stable, real error still surfaces after the retries.
 * supabase-js admin methods return { data, error } (they don't throw), so we inspect error.message;
 * thrown errors are also caught for safety.
 */
export async function withKeyRetry<T extends { error?: unknown }>(fn: () => Promise<T>): Promise<T> {
  let last: T | undefined
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fn()
      last = res
      const msg = String((res as { error?: { message?: string } })?.error?.message ?? '')
      if ((res as { error?: unknown })?.error && TRANSIENT_JWT.test(msg) && attempt < 4) {
        await new Promise((r) => setTimeout(r, 1500 * attempt)); continue
      }
      return res
    } catch (e) {
      if (attempt < 4 && TRANSIENT_JWT.test(String((e as { message?: string })?.message ?? ''))) {
        await new Promise((r) => setTimeout(r, 1500 * attempt)); continue
      }
      throw e
    }
  }
  return last as T
}

/** Admin client with service_role — bypasses RLS */
export function getAdminClient(): SupabaseClient {
  return createClient(STAGING_URL, STAGING_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** User-level client with anon key — respects RLS */
export function getAnonClient(): SupabaseClient {
  return createClient(STAGING_URL, STAGING_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Create test user via admin API, return authenticated anon client + user ID.
 *  Each caller gets a unique email to avoid collision between test suites. */
export async function createTestUser(
  emailPrefix = 'integration-test'
): Promise<{
  client: SupabaseClient
  userId: string
  accessToken: string
}> {
  const admin = getAdminClient()
  const testEmail = `${emailPrefix}@valrano-test.local`

  // Delete existing test user if present (cleanup from previous failed run)
  const { data: existingUsers } = await withKeyRetry(() => admin.auth.admin.listUsers())
  const existing = existingUsers?.users?.find((u) => u.email === testEmail)
  if (existing) {
    await cleanupTestUser(existing.id)
  }

  // Create fresh test user
  const { data: created, error: createErr } =
    await withKeyRetry(() =>
      admin.auth.admin.createUser({
        email: testEmail,
        password: TEST_PASSWORD,
        email_confirm: true,
      })
    )
  if (createErr || !created.user) {
    throw new Error(
      `Failed to create test user (${testEmail}): ${createErr?.message}`
    )
  }

  // Sign in as the test user with an anon client
  const client = getAnonClient()
  const { data: session, error: signInErr } =
    await client.auth.signInWithPassword({
      email: testEmail,
      password: TEST_PASSWORD,
    })
  if (signInErr || !session.session) {
    throw new Error(`Failed to sign in test user: ${signInErr?.message}`)
  }

  return {
    client,
    userId: created.user.id,
    accessToken: session.session.access_token,
  }
}

/** Clean up all test user data and delete the user */
export async function cleanupTestUser(userId: string): Promise<void> {
  const admin = getAdminClient()

  // Delete in dependency order: child tables first
  await admin.from('chat_messages').delete().eq('session_id', userId) // best-effort
  await admin.from('chat_sessions').delete().eq('user_id', userId)
  await admin.from('ai_insights').delete().eq('user_id', userId)
  await admin.from('publication_events').delete().eq('created_by', userId)
  await admin.from('kpi_values').delete().in(
    'company_id',
    (
      await admin
        .from('my_companies')
        .select('company_id')
        .eq('user_id', userId)
    ).data?.map((r) => r.company_id) ?? []
  )
  await admin.from('reports').delete().in(
    'company_id',
    (
      await admin
        .from('my_companies')
        .select('company_id')
        .eq('user_id', userId)
    ).data?.map((r) => r.company_id) ?? []
  )
  await admin.from('peer_group_members').delete().in(
    'peer_group_id',
    (
      await admin
        .from('peer_groups')
        .select('id')
        .eq('owner_id', userId)
    ).data?.map((r) => r.id) ?? []
  )
  await admin.from('peer_groups').delete().eq('owner_id', userId)
  await admin.from('ir_catalog_items').delete().in(
    'company_id',
    (
      await admin
        .from('companies')
        .select('id')
        .eq('created_by', userId)
    ).data?.map((r) => r.id) ?? []
  )
  await admin.from('accounting_profiles').delete().eq('user_id', userId)
  await admin.from('my_companies').delete().eq('user_id', userId)
  await admin.from('companies').delete().eq('created_by', userId)
  await admin.from('workspace_members').delete().eq('user_id', userId)
  await admin.from('workspaces').delete().eq('owner_id', userId)
  await admin.from('subscriptions').delete().eq('user_id', userId)

  // Delete the auth user last
  await withKeyRetry(() => admin.auth.admin.deleteUser(userId))
}

/** Call an edge function on staging with the user's JWT */
export async function callEdgeFunction(
  functionName: string,
  accessToken: string,
  body?: Record<string, unknown>,
  method = 'POST'
): Promise<Response> {
  return fetch(`${STAGING_URL}/functions/v1/${functionName}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      apikey: STAGING_ANON_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

export { STAGING_URL, STAGING_ANON_KEY }
