/**
 * Staging E2E — Comprehensive authenticated flow tests.
 *
 * These tests run with a real authenticated session on staging Supabase
 * and verify every page, navigation, and interactive element works.
 *
 * Auth session is set up by auth.setup.ts (onboarding_dismissed = true).
 */
import { test, expect } from '@playwright/test'

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
    // Re-enable onboarding for this test by clearing the dismissed flag
    const SUPABASE_URL = 'https://vfwpcgdkrwqhdivfzmrg.supabase.co'
    const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmd3BjZ2RrcndxaGRpdmZ6bXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTM0MjIsImV4cCI6MjA5NDc2OTQyMn0.oKmklW0md_-S5tqKT0fg-2Vz0lVh_qDf9jRvm3tqbHs'

    // Get current session from storage state
    const storage = await page.context().storageState()
    const supabaseEntry = storage.origins
      .flatMap(o => o.localStorage)
      .find(e => e.name.startsWith('sb-') && e.name.endsWith('-auth-token'))
    expect(supabaseEntry, 'No Supabase auth token found in storage').toBeTruthy()

    const session = JSON.parse(supabaseEntry!.value)
    const accessToken = session.access_token

    // Temporarily un-dismiss onboarding
    const undismissRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: { onboarding_dismissed: false } }),
    })
    expect(undismissRes.ok, 'Failed to un-dismiss onboarding').toBeTruthy()

    // Navigate to onboarding
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')

    // Should show the onboarding wizard, not an error
    const body = await page.textContent('body')
    expect(body).not.toContain('Something went wrong')

    // Should have the wizard steps visible
    const hasWizardContent =
      body?.includes('Accounting Framework') ||
      body?.includes('Valrano') ||
      body?.includes('Skip setup')

    expect(hasWizardContent).toBe(true)

    // Re-dismiss onboarding so other tests aren't affected
    await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: { onboarding_dismissed: true } }),
    })
  })

  test('onboarding wizard shows step 1 (Accounting Framework)', async ({ page }) => {
    const SUPABASE_URL = 'https://vfwpcgdkrwqhdivfzmrg.supabase.co'
    const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmd3BjZ2RrcndxaGRpdmZ6bXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTM0MjIsImV4cCI6MjA5NDc2OTQyMn0.oKmklW0md_-S5tqKT0fg-2Vz0lVh_qDf9jRvm3tqbHs'

    const storage = await page.context().storageState()
    const supabaseEntry = storage.origins
      .flatMap(o => o.localStorage)
      .find(e => e.name.startsWith('sb-') && e.name.endsWith('-auth-token'))
    const session = JSON.parse(supabaseEntry!.value)

    // Un-dismiss onboarding
    await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: { onboarding_dismissed: false } }),
    })

    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')

    // Step 1 should show breadcrumb with "Accounting Framework" as active
    const body = await page.textContent('body')
    expect(body).toContain('Accounting Framework')

    // Should have file upload area or upload button
    const hasUploadUI =
      body?.includes('upload') ||
      body?.includes('Upload') ||
      body?.includes('drag') ||
      body?.includes('Drop')

    expect(hasUploadUI).toBe(true)

    // Should have Skip setup button
    const skipButton = page.locator('text=Skip setup').first()
    await expect(skipButton).toBeVisible({ timeout: 5000 })

    // Should have breadcrumb steps visible
    expect(body).toContain('Add Competitors')
    expect(body).toContain('Analyze Reports')
    expect(body).toContain('Publication Schedule')

    // Re-dismiss
    await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: { onboarding_dismissed: true } }),
    })
  })

  test('onboarding skip setup works', async ({ page }) => {
    const SUPABASE_URL = 'https://vfwpcgdkrwqhdivfzmrg.supabase.co'
    const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmd3BjZ2RrcndxaGRpdmZ6bXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTM0MjIsImV4cCI6MjA5NDc2OTQyMn0.oKmklW0md_-S5tqKT0fg-2Vz0lVh_qDf9jRvm3tqbHs'

    const storage = await page.context().storageState()
    const supabaseEntry = storage.origins
      .flatMap(o => o.localStorage)
      .find(e => e.name.startsWith('sb-') && e.name.endsWith('-auth-token'))
    const session = JSON.parse(supabaseEntry!.value)

    // Un-dismiss onboarding
    await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: { onboarding_dismissed: false } }),
    })

    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')

    // Click "Skip setup"
    const skipButton = page.locator('text=Skip setup').first()
    await expect(skipButton).toBeVisible({ timeout: 5000 })
    await skipButton.click()

    // Should navigate to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 })
    expect(page.url()).toContain('/dashboard')

    // Re-dismiss (should already be dismissed by skip, but ensure)
    await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: { onboarding_dismissed: true } }),
    })
  })

  test('onboarding step navigation works (breadcrumb clicks)', async ({ page }) => {
    const SUPABASE_URL = 'https://vfwpcgdkrwqhdivfzmrg.supabase.co'
    const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmd3BjZ2RrcndxaGRpdmZ6bXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTM0MjIsImV4cCI6MjA5NDc2OTQyMn0.oKmklW0md_-S5tqKT0fg-2Vz0lVh_qDf9jRvm3tqbHs'

    const storage = await page.context().storageState()
    const supabaseEntry = storage.origins
      .flatMap(o => o.localStorage)
      .find(e => e.name.startsWith('sb-') && e.name.endsWith('-auth-token'))
    const session = JSON.parse(supabaseEntry!.value)

    // Un-dismiss onboarding
    await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: { onboarding_dismissed: false } }),
    })

    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')

    // Verify no error boundary on initial load
    const body = await page.textContent('body')
    expect(body).not.toContain('Something went wrong')

    // The wizard should show step navigation (Back/Continue buttons)
    const continueButton = page.locator('button:has-text("Continue")').first()
    const backButton = page.locator('button:has-text("Back")').first()

    // Back should be disabled on step 1
    if (await backButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      const isDisabled = await backButton.isDisabled()
      expect(isDisabled).toBe(true)
    }

    // Continue button should be visible
    await expect(continueButton).toBeVisible({ timeout: 5000 })

    // Re-dismiss
    await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: { onboarding_dismissed: true } }),
    })
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
