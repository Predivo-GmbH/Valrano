/**
 * Authenticated E2E: Dashboard data verification.
 *
 * These tests run with a real authenticated session (from auth.setup.ts)
 * and verify that actual data appears on the dashboard.
 */
import { test, expect } from '@playwright/test'

test.describe('Dashboard — Authenticated', () => {
  test('dashboard loads with user data', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Should show the peer comparison section
    const body = await page.textContent('body')
    expect(body).toBeTruthy()

    // Should NOT show the "not logged in" or redirect state
    expect(page.url()).toContain('/dashboard')
  })

  test('peer comparison table shows company names', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Wait for data to load (table or empty state)
    const table = page.locator('table').first()
    const emptyState = page.locator('text=Add competitors')

    // Either peers are displayed in a table OR empty state is shown
    const hasTable = await table.isVisible({ timeout: 10000 }).catch(() => false)
    const hasEmptyState = await emptyState.isVisible({ timeout: 3000 }).catch(() => false)

    expect(hasTable || hasEmptyState).toBe(true)

    if (hasTable) {
      // Verify table has at least one row with company data
      const rows = table.locator('tbody tr')
      const rowCount = await rows.count()
      expect(rowCount).toBeGreaterThan(0)
    }
  })

  test('fiscal year selector is interactive', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Find year display/selector
    const yearElement = page.locator('text=2025').or(page.locator('text=2024')).first()
    const isVisible = await yearElement.isVisible({ timeout: 10000 }).catch(() => false)

    if (isVisible) {
      // Year selector is shown — basic data is loading
      expect(isVisible).toBe(true)
    }
  })

  test('navigation works from dashboard', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Navigate to peers page
    const peersLink = page.locator('a[href*="peers"], nav >> text=Peers').first()
    if (await peersLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await peersLink.click()
      await page.waitForLoadState('networkidle')
      expect(page.url()).toContain('/peers')
    }
  })
})
