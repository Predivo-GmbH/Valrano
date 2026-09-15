import { defineConfig, devices } from '@playwright/test'

// The dev-server port was hardcoded to 5173 AND reuseExistingServer was true
// unconditionally - including on CI. That combination is why run 33392070436 reported
// "landing page loads" failing with title "Sign in | Factory Cockpit": our self-hosted
// host runs many runners for many repos in ONE network namespace, another app already
// held 5173, and Playwright cheerfully reused it. The whole suite then ran against a
// different product and 88 of 90 tests still passed, because only the title assertion
// is specific enough to notice. A green suite that never loaded our app is worse than
// a red one.
//
// CI now gets a free port from the OS (E2E_PORT, set by .github/workflows/test.yml) and
// starts its own server; 5173 stays the local default so nothing changes for local dev.
// --strictPort makes Vite fail loudly instead of sliding to 5174 while Playwright polls
// 5173. Same shape as ScoutCopilot's playwright.config.ts (d039192), which fixed the
// ERR_CONNECTION_REFUSED half of this bug on 2026-08-27.
const PORT = process.env.E2E_PORT || '5173'
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  // PINNED OFF test-results/ ITSELF, DELIBERATELY. The reporter above sweeps outputDir whole at
  // onEnd, and test-results/ in this fleet also holds json reports that CI steps read after the
  // suite and screenshots specs write themselves. Nesting keeps the sweep unconditional and
  // still confined to what Playwright wrote.
  outputDir: 'test-results/artifacts',
  // THE STRIPPER RUNS FIRST, AND THAT ORDER IS LOAD-BEARING. Reporters are called in array
  // order and share one TestResult, so removing an attachment here is what the reporter after
  // it sees - and the base reporter prints `Error Context: <path>` straight out of that array.
  // Registering it after would delete the file and still publish its path into the job log.
  // Playwright writes that error context - an ARIA snapshot of the signed-in page, form-field
  // contents included - for any test that ends with errors, gated on nothing but
  // `errors.length > 0`; no `use:` switch reaches it, and a FLAKY test is enough. See
  // e2e/strip-runner-artifacts.reporter.ts for the whole reasoning.
  reporter: [['./e2e/strip-runner-artifacts.reporter.ts'], [process.env.CI ? 'dot' : 'list']],
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: BASE_URL,
    headless: true,
    screenshot: 'off',
    video: 'off',
    // NOTHING IS RECORDED BY THIS SUITE (2026-09-14). It signs a real user in, so a trace records
    // what was typed and a screenshot photographs the form it was typed into. On 2026-09-14 exactly
    // that was found on our SELF-HOSTED runner - one WSL host shared by 19 repositories - holding
    // live staging session tokens, and 104 such files were swept off it. The fleet rule is that a
    // secret is never rendered anywhere, and a debugging convenience is not an exception to it.
    // Debug by reading the assertion, or locally with a throwaway account - never by turning these
    // back on in CI.
    trace: 'off',
  },
  projects: [
    // Unauthenticated tests (existing)
    { name: 'chromium', use: { browserName: 'chromium' } },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    // Authenticated setup — logs in and saves session
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.ts/,
      use: { browserName: 'chromium' },
    },
    // Authenticated tests — depend on auth setup
    {
      name: 'authenticated',
      testDir: './e2e/authenticated',
      dependencies: ['auth-setup'],
      use: {
        browserName: 'chromium',
        storageState: 'playwright/.auth/user.json',
      },
    },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: BASE_URL,
    // !CI: locally, reusing a dev server you already have running is a convenience.
    // On CI it is the bug above - never reuse whatever happens to hold the port.
    reuseExistingServer: !process.env.CI,
    // 15s was too tight for a cold Vite start on a loaded shared runner.
    timeout: 120 * 1000,
  },
})
