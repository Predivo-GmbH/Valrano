/**
 * Playwright auth setup — authenticates with test user and saves session.
 * All tests in e2e/authenticated/ depend on this setup and reuse the session.
 *
 * Test user: dev@benchmarksignal.predivo.ch / devtest2026
 */
import { test as setup, expect } from '@playwright/test'

const TEST_EMAIL = 'dev@benchmarksignal.predivo.ch'
const TEST_PASSWORD = 'devtest2026'
const AUTH_FILE = 'playwright/.auth/user.json'

setup('authenticate', async ({ page }) => {
  // Navigate to login
  await page.goto('/login')

  // Wait for login page to load
  await page.waitForLoadState('networkidle')

  // Check if we need to pass the password gate first
  const gateInput = page.locator('input[type="password"]').first()
  const isGated = await gateInput.isVisible({ timeout: 3000 }).catch(() => false)

  if (isGated) {
    // PasswordGate — enter shared password
    await gateInput.fill('predivo2026')
    await gateInput.press('Enter')
    await page.waitForLoadState('networkidle')
  }

  // Now on login page — use password tab
  const passwordTab = page.locator('text=Password').first()
  if (await passwordTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await passwordTab.click()
  }

  // Fill email
  const emailInput = page.getByLabel(/email/i).first()
  await emailInput.waitFor({ state: 'visible', timeout: 5000 })
  await emailInput.fill(TEST_EMAIL)

  // Fill password
  const passwordInput = page.getByLabel(/password/i).first()
  await passwordInput.fill(TEST_PASSWORD)

  // Submit
  const submitButton = page.getByRole('button', { name: /sign in|log in/i }).first()
  await submitButton.click()

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 15000 })

  // Verify dashboard loaded
  await expect(page.locator('body')).not.toBeEmpty()

  // Save session state
  await page.context().storageState({ path: AUTH_FILE })
})
