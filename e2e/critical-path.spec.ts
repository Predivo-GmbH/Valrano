import { test, expect } from '@playwright/test'

const SUPABASE_URL = 'https://mkdeftmubrkseyrrbzvp.supabase.co'

test.describe('Critical Path', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Valrano/)
  })

  test('login page accessible', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading')).toBeVisible()
  })

  test('unauthenticated redirect works', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL(/\/(login|auth)/)
    expect(page.url()).toMatch(/\/(login|auth)/)
  })

  test('signup page accessible', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByRole('heading')).toBeVisible()
  })
})

// ── Edge Function Health ────────────────────────────────────────────

const ALL_EDGE_FUNCTIONS = [
  'advance-approval',
  'ai-chat',
  'analyze-accounting-profile',
  'billing-portal',
  'check-publication',
  'company-lookup',
  'compute-comparability',
  'delete-account',
  'deliver-document',
  'digest-company-news',
  'download-catalog-item',
  'download-report',
  'enrich-company',
  'extract-kpis',
  'extract-report-context',
  'fetch-company-news',
  'generate-benchmark',
  'generate-from-google-template',
  'generate-from-template',
  'generate-insights',
  'generate-report',
  'google-auth-callback',
  'google-auth-url',
  'insights-digest',
  'monitor-publications',
  'normalize-kpis',
  'parse-template',
  'pipeline-orchestrator',
  'render-benchmark-pdf',
  'request-demo',
  'resolve-company-website',
  'scan-ir-page',
  'self-benchmark',
  'send-auth-email',
  'send-document-notification',
  'send-welcome',
  'stripe-webhook',
  'suggest-competitors',
  'suggest-ir-url',
  'suggest-publication-dates',
  'upload-report',
]

test.describe('Critical Path — Edge Functions', () => {
  for (const fn of ALL_EDGE_FUNCTIONS) {
    test(`${fn} endpoint responds (not 404/500)`, async ({ request }) => {
      const response = await request.fetch(
        `${SUPABASE_URL}/functions/v1/${fn}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          data: {},
          failOnStatusCode: false,
        }
      )
      const status = response.status()
      expect(
        status !== 404 && status !== 500,
        `Edge function "${fn}" returned ${status} — not deployed or crashed`
      ).toBe(true)
    })
  }
})
