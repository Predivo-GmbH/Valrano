/**
 * Staging E2E — Public pages (no auth required).
 *
 * These tests verify the staging frontend is serving correctly,
 * connected to the staging Supabase, and all public routes work.
 */
import { test, expect } from '@playwright/test'

test.describe('Staging — Public Pages', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Valrano/)
  })

  test('dark mode is default', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    const html = page.locator('html')
    await expect(html).toHaveClass(/dark/)
  })

  test('login page is accessible', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading')).toBeVisible()
  })

  test('signup page is accessible', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByRole('heading')).toBeVisible()
  })

  test('unauthenticated user cannot access dashboard', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // SPA may: redirect to /login, show PasswordGate, or show a login prompt
    const url = page.url()
    const body = await page.textContent('body')
    const isRedirected = url.includes('/login') || url.includes('/auth')
    const showsLoginPrompt = body?.includes('Sign in') || body?.includes('Log in')
    const showsPasswordGate = body?.includes('access code') || body?.includes('Private beta')

    expect(isRedirected || showsLoginPrompt || showsPasswordGate).toBe(true)
  })

  test('privacy page loads', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page).toHaveTitle(/Privacy/i)
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(50)
  })

  test('terms page loads', async ({ page }) => {
    await page.goto('/terms')
    await expect(page).toHaveTitle(/Terms/i)
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(50)
  })

  test('imprint page loads', async ({ page }) => {
    await page.goto('/imprint')
    await expect(page).toHaveTitle(/Imprint/i)
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(50)
  })

  test('unknown route shows not-found page', async ({ page }) => {
    await page.goto('/nonexistent-route-xyz')
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(10)
  })

  test('no critical console errors on landing', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('supabase') &&
        !e.includes('auth') &&
        !e.includes('401') &&
        !e.includes('403') &&
        !e.includes('favicon') &&
        !e.includes('X-Frame-Options'),
    )
    expect(criticalErrors).toHaveLength(0)
  })

  test('staging connects to staging Supabase (not production)', async ({ page }) => {
    // Intercept network requests to verify we're hitting staging Supabase
    const supabaseRequests: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('supabase.co')) {
        supabaseRequests.push(req.url())
      }
    })

    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Any Supabase request should go to staging project (vfwpcgdkrwqhdivfzmrg)
    // and NOT to production (mkdeftmubrkseyrrbzvp)
    for (const url of supabaseRequests) {
      expect(url).not.toContain('mkdeftmubrkseyrrbzvp')
      expect(url).toContain('vfwpcgdkrwqhdivfzmrg')
    }
  })
})
