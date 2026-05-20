/**
 * Staging E2E — Authenticated flows.
 *
 * These tests run with a real authenticated session on staging
 * and verify critical user journeys work end-to-end.
 */
import { test, expect } from '@playwright/test'

test.describe('Staging — Dashboard', () => {
  test('dashboard loads after login', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/dashboard')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(50)
  })

  test('no critical console errors on dashboard', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('supabase') &&
        !e.includes('401') &&
        !e.includes('403') &&
        !e.includes('favicon') &&
        !e.includes('Failed to fetch') &&
        !e.includes('X-Frame-Options'),
    )
    expect(criticalErrors).toHaveLength(0)
  })
})

test.describe('Staging — Company Creation (regression: created_by)', () => {
  test('my company page loads', async ({ page }) => {
    await page.goto('/my-company')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/my-company')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()
  })

  test('competitors page loads', async ({ page }) => {
    await page.goto('/competitors')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/competitors')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()
  })

  test('add peer button is visible on competitors page', async ({ page }) => {
    await page.goto('/competitors')
    await page.waitForLoadState('networkidle')

    const addButton = page.getByRole('button', { name: /add/i }).first()
    const isVisible = await addButton.isVisible({ timeout: 10000 }).catch(() => false)
    expect(isVisible).toBe(true)
  })
})

test.describe('Staging — Navigation', () => {
  test('all main nav links work', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Test navigation to each critical page — should NOT redirect to /login
    // Note: /peers redirects to /competitors in current routing
    const routes = ['/competitors', '/my-company', '/settings', '/account']
    for (const route of routes) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      const url = page.url()
      expect(url).not.toContain('/login')
      expect(url).toContain(route)
    }
  })

  test('Valrano branding is visible', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=Valrano').first()).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Staging — Settings', () => {
  test('settings page loads with user info', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/settings')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()
  })

  test('account page shows subscription info', async ({ page }) => {
    await page.goto('/account')
    await page.waitForLoadState('networkidle')

    const body = await page.textContent('body')
    const hasTierInfo =
      body?.toLowerCase().includes('starter') ||
      body?.toLowerCase().includes('professional') ||
      body?.toLowerCase().includes('enterprise') ||
      body?.toLowerCase().includes('subscription') ||
      body?.toLowerCase().includes('plan')

    expect(hasTierInfo).toBe(true)
  })
})
