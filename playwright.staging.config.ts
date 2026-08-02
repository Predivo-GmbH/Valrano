import { defineConfig } from '@playwright/test'

/**
 * Playwright config for E2E tests against staging.valrano.com.
 *
 * Requires env vars:
 *   STAGING_URL            — https://staging.valrano.com
 *   STAGING_HTTP_USER      — HTTP Basic Auth user
 *   STAGING_HTTP_PASS      — HTTP Basic Auth password
 *   STAGING_TEST_EMAIL     — Supabase test user email
 *   STAGING_TEST_PASSWORD  — Supabase test user password
 */
export default defineConfig({
  testDir: './e2e/staging',
  // The heavy v11 hardened gates (seed/clean via the Management API) run in their own
  // pipeline (staging-gates.yml / playwright.v11-gates.config.ts). Keep them OUT of the
  // prod-promotion gauntlet — this config has no VAL_MGMT_TOKEN, so they'd fail here.
  testIgnore: '**/v11-gates.spec.ts',
  timeout: 45000,
  retries: 1,
  use: {
    baseURL: process.env.STAGING_URL || 'https://staging.valrano.com',
    headless: true,
    screenshot: 'on',
    trace: 'on-first-retry',
    httpCredentials: {
      username: process.env.STAGING_HTTP_USER || 'staging',
      password: process.env.STAGING_HTTP_PASS || 'predivo2026',
    },
  },
  projects: [
    {
      name: 'staging-auth-setup',
      testMatch: /auth\.setup\.ts/,
      use: { browserName: 'chromium' },
    },
    {
      name: 'staging-public',
      testMatch: /public\.spec\.ts/,
      use: { browserName: 'chromium' },
    },
    {
      name: 'staging-authenticated',
      testMatch: /authenticated\.spec\.ts/,
      dependencies: ['staging-auth-setup'],
      use: {
        browserName: 'chromium',
        storageState: 'playwright/.auth/staging-user.json',
      },
    },
  ],
})
