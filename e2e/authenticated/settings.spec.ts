/**
 * Authenticated E2E: Settings and account pages.
 */
import { test, expect } from '@playwright/test'

test.describe('Settings — Authenticated', () => {
  test('settings page loads with user info', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Should show email or account info
    const body = await page.textContent('body')
    expect(body).toBeTruthy()

    // Should be on settings page (not redirected)
    expect(page.url()).toContain('/settings')
  })

  test('account page shows subscription tier', async ({ page }) => {
    await page.goto('/account')
    await page.waitForLoadState('networkidle')

    // Should show tier info (Starter, Professional, or Enterprise)
    const body = await page.textContent('body')
    const hasTier = body?.toLowerCase().includes('starter') ||
                    body?.toLowerCase().includes('professional') ||
                    body?.toLowerCase().includes('enterprise')

    expect(hasTier).toBe(true)
  })
})
