import { defineConfig, devices } from '@playwright/test'

/**
 * Gate A runtime crawl against the DEPLOYED staging site.
 *
 * Kept in its OWN config, separate from playwright.v11-gates.config.ts: the crawl is
 * long-running and READ-ONLY by design (it measures the commit control in every dialog it
 * finds and never clicks one, and never clicks anything on the denylists in the spec,
 * including the AI-assistant chips that would each bill a paid Anthropic call).
 *
 * staging.valrano.com sits behind HTTP basic auth. WITHOUT httpCredentials every route
 * returns a 401 page and the crawl reports zero triggers, which reads exactly like a clean
 * app. That is not hypothetical: ChannelMover's recon did precisely that on 2026-08-20.
 *
 * Run locally (magiclink path, no password needed):
 *   STAGING_HTTP_USER=staging STAGING_HTTP_PASS=... VAL_SVC_KEY=eyJ... \
 *   npx playwright test --config playwright.gate-a-crawl.config.ts
 */
const STAGING_URL = process.env.STAGING_URL ?? 'https://staging.valrano.com'

export default defineConfig({
  testDir: './e2e/staging',
  testMatch: 'gate-a-crawl.spec.ts',
  timeout: 1_800_000,
  retries: 0, // a retry would double a long crawl and hide flakiness rather than surface it
  workers: 1,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: STAGING_URL,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    // Playwright's default actionTimeout is 0, so an action inherits the (deliberately
    // huge) test timeout. A locator pointing at a responsive surface that unmounted at a
    // wider viewport then blocks for the whole run and the job looks slow, not stuck.
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    httpCredentials:
      process.env.STAGING_HTTP_USER && process.env.STAGING_HTTP_PASS
        ? { username: process.env.STAGING_HTTP_USER, password: process.env.STAGING_HTTP_PASS }
        : undefined,
  },
  projects: [{ name: 'gate-a-crawl', use: { browserName: 'chromium' } }],
})
