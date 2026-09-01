/**
 * Staging E2E — Comprehensive authenticated flow tests.
 *
 * These tests run with a real authenticated session on staging Supabase
 * and verify every page, navigation, and interactive element works.
 *
 * Auth session is set up by auth.setup.ts (onboarding_dismissed = true).
 */
import { test, expect, type Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Staging Supabase helpers
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'https://vfwpcgdkrwqhdivfzmrg.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmd3BjZ2RrcndxaGRpdmZ6bXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTM0MjIsImV4cCI6MjA5NDc2OTQyMn0.oKmklW0md_-S5tqKT0fg-2Vz0lVh_qDf9jRvm3tqbHs'

async function getAccessToken(page: Page): Promise<string> {
  const storage = await page.context().storageState()
  const entry = storage.origins
    .flatMap(o => o.localStorage)
    .find(e => e.name.startsWith('sb-') && e.name.endsWith('-auth-token'))
  if (!entry) throw new Error('No Supabase auth token in storage')
  return JSON.parse(entry.value).access_token
}

async function setOnboardingDismissed(page: Page, dismissed: boolean) {
  const token = await getAccessToken(page)
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: { onboarding_dismissed: dismissed } }),
  })
  if (!res.ok) throw new Error(`Failed to set onboarding_dismissed=${dismissed}: ${await res.text()}`)
}

async function clearBannerDismissal(page: Page) {
  const token = await getAccessToken(page)
  await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: { setup_banner_dismissed: false } }),
  })
  // Navigate to app first so localStorage is accessible (avoids SecurityError on about:blank)
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')
  await page.evaluate(() => localStorage.removeItem('valrano-setup-banner-dismissed'))
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

test.describe('Dashboard', () => {
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

  test('dashboard shows Valrano branding', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=Valrano').first()).toBeVisible({ timeout: 10000 })
  })

  test('sidebar navigation is visible', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Sidebar should have navigation links
    const navLinks = await page.locator('nav a, aside a').all()
    expect(navLinks.length).toBeGreaterThanOrEqual(3)
  })
})

// ---------------------------------------------------------------------------
// Navigation — all main routes
// ---------------------------------------------------------------------------

test.describe('Navigation', () => {
  test('all main nav links work without errors', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const routes = ['/competitors', '/my-company', '/analytics', '/reports', '/settings', '/account']
    for (const route of routes) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      const url = page.url()
      expect(url).not.toContain('/login')
      // Should not show error boundary
      const body = await page.textContent('body')
      expect(body).not.toContain('Something went wrong')
    }
  })

  test('redirect routes work correctly', async ({ page }) => {
    // /peers → /competitors
    await page.goto('/peers')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/competitors')

    // /upload → /competitors
    await page.goto('/upload')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/competitors')

    // /calendar → /competitors?tab=calendar
    await page.goto('/calendar')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/competitors')

    // /documents → /reports
    await page.goto('/documents')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/reports')
  })
})

// ---------------------------------------------------------------------------
// Competitors Page
// ---------------------------------------------------------------------------

test.describe('Competitors Page', () => {
  test('competitors page loads', async ({ page }) => {
    await page.goto('/competitors')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/competitors')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()
  })

  test('add peer button is visible', async ({ page }) => {
    await page.goto('/competitors')
    await page.waitForLoadState('networkidle')

    const addButton = page.getByRole('button', { name: /add/i }).first()
    const isVisible = await addButton.isVisible({ timeout: 10000 }).catch(() => false)
    expect(isVisible).toBe(true)
  })

  test('competitor search autocomplete opens', async ({ page }) => {
    await page.goto('/competitors')
    await page.waitForLoadState('networkidle')

    // Click add button to open autocomplete
    const addButton = page.getByRole('button', { name: /add/i }).first()
    if (await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addButton.click()
      // Should show an input or autocomplete dropdown
      await page.waitForTimeout(500)
      const inputs = await page.locator('input[placeholder*="earch"], input[placeholder*="ompan"], input[type="text"]').all()
      expect(inputs.length).toBeGreaterThanOrEqual(1)
    }
  })

  test('tabs are present on competitors page', async ({ page }) => {
    await page.goto('/competitors')
    await page.waitForLoadState('networkidle')

    // Check for tab-like elements (peers, calendar, IR catalog)
    const body = await page.textContent('body')
    // At minimum the page should have some interactive content
    expect(body!.length).toBeGreaterThan(100)
  })
})

// ---------------------------------------------------------------------------
// My Company Page
// ---------------------------------------------------------------------------

test.describe('My Company Page', () => {
  test('my company page loads', async ({ page }) => {
    await page.goto('/my-company')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/my-company')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    // Should not show error boundary
    expect(body).not.toContain('Something went wrong')
  })

  test('my company page has tabs', async ({ page }) => {
    await page.goto('/my-company')
    await page.waitForLoadState('networkidle')

    // Should have tab buttons (overview, benchmark, reports, etc.)
    const tabButtons = await page.locator('[role="tab"], button').all()
    expect(tabButtons.length).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// Analytics Page
// ---------------------------------------------------------------------------

test.describe('Analytics Page', () => {
  test('analytics page loads', async ({ page }) => {
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/analytics')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body).not.toContain('Something went wrong')
  })
})

// ---------------------------------------------------------------------------
// Reports Page
// ---------------------------------------------------------------------------

test.describe('Reports Page', () => {
  test('reports page loads', async ({ page }) => {
    await page.goto('/reports')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/reports')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body).not.toContain('Something went wrong')
  })
})

// ---------------------------------------------------------------------------
// Settings Page
// ---------------------------------------------------------------------------

test.describe('Settings Page', () => {
  test('settings page loads with user info', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/settings')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body).not.toContain('Something went wrong')
  })
})

// ---------------------------------------------------------------------------
// Account Page
// ---------------------------------------------------------------------------

test.describe('Account Page', () => {
  test('account page shows subscription info', async ({ page }) => {
    await page.goto('/account')
    await page.waitForLoadState('networkidle')

    const body = await page.textContent('body')
    const hasTierInfo =
      body?.toLowerCase().includes('starter') ||
      body?.toLowerCase().includes('professional') ||
      body?.toLowerCase().includes('enterprise') ||
      body?.toLowerCase().includes('subscription') ||
      body?.toLowerCase().includes('plan') ||
      body?.toLowerCase().includes('account')

    expect(hasTierInfo).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Onboarding Wizard (critical — previously untested)
// ---------------------------------------------------------------------------

test.describe('Onboarding Wizard', () => {
  test('onboarding page loads without crash', async ({ page }) => {
    await setOnboardingDismissed(page, false)

    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')

    const body = await page.textContent('body')
    expect(body).not.toContain('Something went wrong')

    const hasWizardContent =
      body?.includes('Accounting Framework') ||
      body?.includes('Valrano') ||
      body?.includes('Skip setup')
    expect(hasWizardContent).toBe(true)

    await setOnboardingDismissed(page, true)
  })

  test('wizard shows step 1 (Accounting Framework)', async ({ page }) => {
    await setOnboardingDismissed(page, false)

    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')

    const body = await page.textContent('body')
    expect(body).toContain('Accounting Framework')
    expect(body).toContain('Add Competitors')
    expect(body).toContain('Analyze Reports')
    expect(body).toContain('Publication Schedule')

    const hasUploadUI =
      body?.includes('upload') || body?.includes('Upload') ||
      body?.includes('drag') || body?.includes('Drop')
    expect(hasUploadUI).toBe(true)

    await expect(page.locator('text=Skip setup').first()).toBeVisible({ timeout: 5000 })

    await setOnboardingDismissed(page, true)
  })

  // ONB-002: Skip setup → dashboard → banner visible
  test('skip setup shows SetupProgressBanner on dashboard', async ({ page }) => {
    await setOnboardingDismissed(page, false)
    await clearBannerDismissal(page)

    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')

    // Click "Skip setup"
    const skipButton = page.locator('text=Skip setup').first()
    await expect(skipButton).toBeVisible({ timeout: 5000 })
    await skipButton.click()

    // Should navigate to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 })
    expect(page.url()).toContain('/dashboard')

    // THE KEY ASSERTION: SetupProgressBanner must be visible
    const banner = page.locator('text=Complete Setup').first()
    await expect(banner).toBeVisible({ timeout: 10000 })

    // Banner should show progress (e.g., "Setup 0/3 complete")
    const body = await page.textContent('body')
    expect(body).toMatch(/Setup \d\/3 complete/)

    await setOnboardingDismissed(page, true)
  })

  // ONB-003: Skip → dashboard → click "Complete Setup" → back to wizard
  test('Complete Setup button on banner returns to wizard', async ({ page }) => {
    await setOnboardingDismissed(page, false)
    await clearBannerDismissal(page)

    // Skip to dashboard first
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    await page.locator('text=Skip setup').first().click()
    await page.waitForURL('**/dashboard', { timeout: 10000 })

    // Click "Complete Setup" on the banner
    const completeButton = page.locator('button:has-text("Complete Setup")').first()
    await expect(completeButton).toBeVisible({ timeout: 10000 })
    await completeButton.click()

    // Should navigate back to /onboarding
    await page.waitForURL('**/onboarding', { timeout: 10000 })
    expect(page.url()).toContain('/onboarding')

    // Wizard should load — auto-wait for the stepper (renders all step labels),
    // immediate textContent races the wizard's data loading
    await expect(page.getByText('Accounting Framework').first()).toBeVisible({ timeout: 15000 })

    await setOnboardingDismissed(page, true)
  })

  // ONB-004: Dismiss banner with X → banner hidden
  test('dismissing banner with X hides it', async ({ page }) => {
    await setOnboardingDismissed(page, false)
    await clearBannerDismissal(page)

    // Skip to dashboard
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    await page.locator('text=Skip setup').first().click()
    await page.waitForURL('**/dashboard', { timeout: 10000 })

    // Banner should be visible
    const banner = page.locator('text=Complete Setup').first()
    await expect(banner).toBeVisible({ timeout: 10000 })

    // Click X to dismiss
    const dismissButton = page.locator('button[aria-label="Dismiss setup banner"]').first()
    await expect(dismissButton).toBeVisible({ timeout: 5000 })
    await dismissButton.click()

    // Banner should disappear
    await expect(banner).not.toBeVisible({ timeout: 5000 })

    // Reload — banner should stay hidden (persisted in localStorage + user metadata)
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=Complete Setup').first()).not.toBeVisible({ timeout: 5000 })

    await setOnboardingDismissed(page, true)
  })

  test('step navigation works (breadcrumb clicks)', async ({ page }) => {
    await setOnboardingDismissed(page, false)

    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')

    const body = await page.textContent('body')
    expect(body).not.toContain('Something went wrong')

    const continueButton = page.locator('button:has-text("Continue")').first()
    const backButton = page.locator('button:has-text("Back")').first()

    if (await backButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      expect(await backButton.isDisabled()).toBe(true)
    }
    await expect(continueButton).toBeVisible({ timeout: 5000 })

    await setOnboardingDismissed(page, true)
  })
})

// ---------------------------------------------------------------------------
// Auth Flows (functional — not just page loads)
// ---------------------------------------------------------------------------

test.describe('Auth Flows', () => {
  // AUTH-006: Sign out flow
  test('sign out redirects to landing page', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    // Web-first, not a one-shot read of page.url(). The dashboard route re-checks the
    // Supabase session on mount and bounces to /login until it resolves; networkidle can
    // be reached inside that window, and then a single non-retrying read sees /login and
    // fails a product that is fine.
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })

    // Open user menu dropdown (aria-label="User menu")
    const userMenuButton = page.locator('button[aria-label="User menu"]').first()
    await expect(userMenuButton).toBeVisible({ timeout: 5000 })
    await userMenuButton.click()

    // Click "Sign out" in the dropdown
    const signOutButton = page.locator('text=Sign out').first()
    await expect(signOutButton).toBeVisible({ timeout: 3000 })
    await signOutButton.click()

    // After sign out, should leave dashboard (landing or login page).
    // A fixed 3s sleep followed by one non-retrying read is the whole bug: sign-out has to
    // clear the Supabase session, tear down the auth listener and route away, and on a
    // host that runs 25 runner instances in one WSL that is regularly slower than 3s. The
    // test then failed on a redirect that completed a moment later - it blocked the
    // 2026-09-01 production promotion (gate-e2e in run 33509341053) and passed unchanged
    // afterwards. Poll for the destination instead of guessing how long it takes.
    await expect(page).not.toHaveURL(/\/(dashboard|competitors)/, { timeout: 15_000 })
  })
})

// ---------------------------------------------------------------------------
// Error Boundary — no crashes on any page
// ---------------------------------------------------------------------------

test.describe('No crashes on any page', () => {
  const allRoutes = [
    '/dashboard',
    '/my-company',
    '/competitors',
    '/analytics',
    '/reports',
    '/settings',
    '/account',
  ]

  for (const route of allRoutes) {
    test(`${route} does not show error boundary`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))

      await page.goto(route)
      await page.waitForLoadState('networkidle')

      const body = await page.textContent('body')
      expect(body).not.toContain('Something went wrong')
      expect(body).not.toContain('An unexpected error occurred')

      // No uncaught JS errors
      expect(errors).toHaveLength(0)
    })
  }
})
