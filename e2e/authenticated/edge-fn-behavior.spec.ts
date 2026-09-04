/**
 * Edge Function Behavior Tests — beyond reachability.
 *
 * These tests verify actual behavior: auth enforcement, input validation,
 * response shapes, and RLS policies. They use direct HTTP calls against
 * the production Supabase project.
 */
import { test, expect } from '@playwright/test'

const SUPABASE_URL = 'https://mkdeftmubrkseyrrbzvp.supabase.co'
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

// ---------------------------------------------------------------------------
// Helper — call an edge function
// ---------------------------------------------------------------------------
async function callEdgeFn(
  fn: string,
  opts: {
    method?: string
    body?: Record<string, unknown>
    headers?: Record<string, string>
  } = {},
) {
  const { method = 'POST', body, headers = {} } = opts
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res
}

// ---------------------------------------------------------------------------
// 1. company-lookup — returns results or valid shape with service-role
// ---------------------------------------------------------------------------
test.describe('Edge Function Behavior', () => {
  test('company-lookup with query returns valid shape', async () => {
    const res = await callEdgeFn('company-lookup', {
      body: { query: 'Holcim' },
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
      },
    })

    // Should succeed or return a structured response (not 404/500)
    expect(res.status).not.toBe(404)
    expect(res.status).not.toBe(500)

    if (res.status === 200) {
      const data = await res.json()
      // Should return an array or object with results
      expect(data).toBeTruthy()
    }
  })

  // ---------------------------------------------------------------------------
  // 2. request-demo — public endpoint with valid payload returns 200
  // ---------------------------------------------------------------------------
  test('request-demo with valid email/name returns 200', async () => {
    const res = await callEdgeFn('request-demo', {
      body: {
        email: 'e2e-test@example.com',
        name: 'E2E Test User',
        company: 'Test Corp',
      },
    })

    // Public endpoint — should accept the request
    expect(res.status).toBe(200)
  })

  // ---------------------------------------------------------------------------
  // 3. stripe-webhook without signature returns 400
  // ---------------------------------------------------------------------------
  test('stripe-webhook without signature returns 400', async () => {
    const res = await callEdgeFn('stripe-webhook', {
      body: { type: 'checkout.session.completed' },
    })

    // Missing Stripe-Signature header should be rejected
    expect(res.status).toBe(400)
  })

  // ---------------------------------------------------------------------------
  // 4. send-auth-email refuses an unauthenticated caller (open-relay guard)
  //
  // THIS ASSERTION USED TO ACCEPT 400, AND THAT IS WHY IT WAS GREEN THROUGH THE HOLE.
  // signal-fleet:send-auth-email:unauthenticated-relay — the function verified a
  // Standard-Webhooks signature only WHEN ONE WAS PRESENT, so an unsigned POST was never
  // checked at all and anyone could make this product mail a login or password-reset code to
  // an address of their choosing. Measured on production 2026-09-04, before the cutover: a
  // forged unsigned payload answered 200 — it actually sent. `{}` answered 400.
  //
  // 400 IS THE FAILING SHAPE, NOT A PASSING ONE: 400 'No email in payload' is a complaint
  // about the BODY, which is only reached AFTER authentication. Accepting it here made the
  // vulnerability the contract. The only correct answer is 401.
  //
  // The live equivalent that does not depend on a browser or on CI is
  // supabase/functions/send-auth-email/relay-auth.prod.test.mjs, which checks BOTH projects.
  // ---------------------------------------------------------------------------
  test('send-auth-email refuses an unauthenticated caller with 401', async () => {
    const res = await callEdgeFn('send-auth-email', {
      // A well-formed payload, so a 401 can only come from the caller check and never from
      // body validation. The recipient is an RFC 2606 `.invalid` address that can never
      // resolve, so even a regressed deployment could not mail a real person because of it.
      body: {
        user: { email: 'relay-guard@valrano-test.invalid' },
        email_data: {
          token: '000000',
          token_hash: 'RELAY-GUARD',
          redirect_to: 'https://valrano.com',
          email_action_type: 'recovery',
          site_url: 'https://valrano.com',
        },
      },
      headers: {
        'x-supabase-webhook-signature': 'v1,invalid-signature',
      },
    })

    expect(res.status).toBe(401)
  })

  // ---------------------------------------------------------------------------
  // 5. delete-account without auth returns 401
  // ---------------------------------------------------------------------------
  test('delete-account without auth returns 401', async () => {
    const res = await callEdgeFn('delete-account', {
      body: {},
    })

    expect(res.status).toBe(401)
  })

  // ---------------------------------------------------------------------------
  // 6. billing-portal without auth returns 401
  // ---------------------------------------------------------------------------
  test('billing-portal without auth returns 401', async () => {
    const res = await callEdgeFn('billing-portal', {
      body: {},
    })

    expect(res.status).toBe(401)
  })

  // ---------------------------------------------------------------------------
  // 7. ai-chat without auth returns 401
  // ---------------------------------------------------------------------------
  test('ai-chat without auth returns 401', async () => {
    const res = await callEdgeFn('ai-chat', {
      body: { message: 'hello' },
    })

    expect(res.status).toBe(401)
  })

  // ---------------------------------------------------------------------------
  // 8. upload-report without auth returns 401
  // ---------------------------------------------------------------------------
  test('upload-report without auth returns 401', async () => {
    const res = await callEdgeFn('upload-report', {
      body: {},
    })

    expect(res.status).toBe(401)
  })

  // ---------------------------------------------------------------------------
  // 9. error_log table NOT queryable via anon key (RLS deny-all)
  // ---------------------------------------------------------------------------
  test('error_log table is not queryable via anon key', async () => {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/error_log?select=*&limit=1`,
      {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
      },
    )

    // RLS should block: 401, 403, or empty array (deny-all returns [])
    if (res.status === 200) {
      const data = await res.json()
      // If 200, RLS must return empty (no rows visible to anon)
      expect(data).toEqual([])
    } else {
      expect([401, 403]).toContain(res.status)
    }
  })

  // ---------------------------------------------------------------------------
  // 10. monitor-publications with service-role returns valid response
  // ---------------------------------------------------------------------------
  test('monitor-publications with service-role returns valid response', async () => {
    const res = await callEdgeFn('monitor-publications', {
      body: {},
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
      },
    })

    // Should not return 401 or 500 when called with service-role
    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(500)
    // Valid responses: 200 (processed), 204 (nothing to do), or similar
    expect(res.status).toBeLessThan(500)
  })
})
