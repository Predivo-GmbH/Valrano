/**
 * Staging auth setup — authenticates with test user on staging Supabase.
 *
 * Signs in via direct API call (outside browser to avoid HTTP Basic Auth
 * interference), then injects the session into the browser's localStorage.
 */
import { test as setup, expect } from '@playwright/test'

const _TEST_EMAIL = process.env.STAGING_TEST_EMAIL || 'e2e-test@valrano-test.local'
const _TEST_PASSWORD = process.env.STAGING_TEST_PASSWORD || 'IntegrationTest2026!'
const AUTH_FILE = 'playwright/.auth/staging-user.json'
void _TEST_EMAIL, _TEST_PASSWORD

const SUPABASE_URL = 'https://vfwpcgdkrwqhdivfzmrg.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmd3BjZ2RrcndxaGRpdmZ6bXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTM0MjIsImV4cCI6MjA5NDc2OTQyMn0.oKmklW0md_-S5tqKT0fg-2Vz0lVh_qDf9jRvm3tqbHs'

setup('authenticate on staging', async ({ page }) => {
  // Step 1: Sign in via Node.js fetch (hardcoded to avoid any env var issues)
  const loginEmail = 'e2e-test@valrano-test.local'
  const loginPassword = 'IntegrationTest2026!'
  const loginBody = JSON.stringify({ email: loginEmail, password: loginPassword })

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: loginBody,
  })

  const responseBody = await response.text()
  expect(response.ok, `Login failed (${loginEmail}): ${responseBody}`).toBeTruthy()
  const session = JSON.parse(responseBody)

  // Step 1b: Dismiss onboarding so authenticated routes don't redirect to /onboarding
  const dismissRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: { onboarding_dismissed: true } }),
  })
  expect(dismissRes.ok, `Failed to dismiss onboarding: ${await dismissRes.text()}`).toBeTruthy()

  // Step 2: Navigate to app and inject session + gate bypass into localStorage
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')

  await page.evaluate(({ s }) => {
    // Bypass PasswordGate
    localStorage.setItem('bs_unlocked', 'true')

    // Inject Supabase auth session
    const storageKey = 'sb-vfwpcgdkrwqhdivfzmrg-auth-token'
    localStorage.setItem(storageKey, JSON.stringify({
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: s.expires_at,
      expires_in: s.expires_in,
      token_type: s.token_type,
      user: s.user,
    }))
  }, { s: session })

  // Step 3: Navigate to dashboard — should be authenticated
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')

  // With onboarding dismissed, user should stay on /dashboard
  const url = page.url()
  expect(url).toContain('/dashboard')
  const body = await page.textContent('body')
  expect(body!.length).toBeGreaterThan(50)

  // Save browser state for other tests
  await page.context().storageState({ path: AUTH_FILE })
})
