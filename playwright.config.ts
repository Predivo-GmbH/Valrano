import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'on',
    trace: 'on-first-retry',
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
    command: 'npx vite --port 5173',
    port: 5173,
    reuseExistingServer: true,
    timeout: 15000,
  },
})
