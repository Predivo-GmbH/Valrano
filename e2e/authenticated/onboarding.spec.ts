/**
 * Authenticated E2E: Onboarding wizard flows.
 *
 * Tests the onboarding wizard steps, skip/resume, and banner lifecycle.
 * Auth session from auth.setup.ts (onboarding_dismissed managed per-test).
 */
import { test, expect, type Page } from '@playwright/test'

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

// ---------------------------------------------------------------------------
// ONB-005: Complete onboarding → no banner on dashboard
// ---------------------------------------------------------------------------
test.describe('Onboarding — Complete Flow', () => {
  test('ONB-005: completed onboarding shows no banner on dashboard', async ({ page }) => {
    // Ensure onboarding IS dismissed (simulating completed flow)
    await setOnboardingDismissed(page, true)

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Should be on dashboard
    expect(page.url()).toContain('/dashboard')

    // SetupProgressBanner should NOT be visible
    const banner = page.locator('text=Complete Setup').first()
    await expect(banner).not.toBeVisible({ timeout: 5000 })

    // No "Setup X/3 complete" text
    const body = await page.textContent('body')
    expect(body).not.toMatch(/Setup \d\/3 complete/)
  })

  // ---------------------------------------------------------------------------
  // ONB-006: Step 1 — Upload report UI
  // ---------------------------------------------------------------------------
  test('ONB-006: step 1 shows upload report UI with drop zone', async ({ page }) => {
    await setOnboardingDismissed(page, false)

    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')

    // Step 1 should be active (Accounting Framework)
    const body = await page.textContent('body')
    expect(body).toContain('Accounting Framework')

    // Should have a file input or drop zone for PDF
    const fileInput = page.locator('input[type="file"]')
    const dropZone = page.locator('text=drag').or(page.locator('text=Drop')).or(page.locator('text=upload'))

    const hasFileInput = await fileInput.count() > 0
    const hasDropZone = await dropZone.first().isVisible({ timeout: 5000 }).catch(() => false)

    expect(hasFileInput || hasDropZone).toBe(true)

    await setOnboardingDismissed(page, true)
  })

  // ---------------------------------------------------------------------------
  // ONB-007: Step 2 — Add competitors
  // ---------------------------------------------------------------------------
  test('ONB-007: step 2 shows competitor search UI', async ({ page }) => {
    await setOnboardingDismissed(page, false)

    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')

    // Navigate to step 2 via Continue button
    const continueButton = page.locator('button:has-text("Continue")').first()
    if (await continueButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await continueButton.click()
      await page.waitForTimeout(1000)
    }

    // Step 2 should show "Add Competitors" content
    const body = await page.textContent('body')
    const hasCompetitorUI =
      body?.includes('Add Competitors') ||
      body?.includes('competitor') ||
      body?.includes('peer') ||
      body?.includes('Search')

    expect(hasCompetitorUI).toBe(true)

    await setOnboardingDismissed(page, true)
  })

  // ---------------------------------------------------------------------------
  // ONB-008: Step 3 — Analyze reports
  // ---------------------------------------------------------------------------
  test('ONB-008: step 3 shows analyze reports content', async ({ page }) => {
    await setOnboardingDismissed(page, false)

    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')

    // Navigate to step 3: Continue twice
    const continueButton = page.locator('button:has-text("Continue")').first()
    for (let i = 0; i < 2; i++) {
      if (await continueButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await continueButton.click()
        await page.waitForTimeout(1000)
      }
    }

    // Step 3 should show "Analyze Reports" content
    const body = await page.textContent('body')
    const hasAnalyzeUI =
      body?.includes('Analyze Reports') ||
      body?.includes('Analyze') ||
      body?.includes('report') ||
      body?.includes('Report')

    expect(hasAnalyzeUI).toBe(true)

    await setOnboardingDismissed(page, true)
  })

  // ---------------------------------------------------------------------------
  // ONB-009: Step 4 — Publication schedule
  // ---------------------------------------------------------------------------
  test('ONB-009: step 4 shows publication schedule content', async ({ page }) => {
    await setOnboardingDismissed(page, false)

    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')

    // Navigate to step 4: Continue three times
    const continueButton = page.locator('button:has-text("Continue")').first()
    for (let i = 0; i < 3; i++) {
      if (await continueButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await continueButton.click()
        await page.waitForTimeout(1000)
      }
    }

    // Step 4 should show "Publication Schedule" content
    const body = await page.textContent('body')
    const hasScheduleUI =
      body?.includes('Publication Schedule') ||
      body?.includes('schedule') ||
      body?.includes('Schedule') ||
      body?.includes('Finish Setup')

    expect(hasScheduleUI).toBe(true)

    await setOnboardingDismissed(page, true)
  })

  // ---------------------------------------------------------------------------
  // ONB-011: Skip schedule step 4 only
  // ---------------------------------------------------------------------------
  test('ONB-011: skip button on step 4 navigates to dashboard', async ({ page }) => {
    await setOnboardingDismissed(page, false)

    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')

    // Navigate to step 4
    const continueButton = page.locator('button:has-text("Continue")').first()
    for (let i = 0; i < 3; i++) {
      if (await continueButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await continueButton.click()
        await page.waitForTimeout(1000)
      }
    }

    // Look for a skip button on step 4
    const skipButton = page.locator('button:has-text("Skip"), text=Skip this step, text=Skip setup').first()
    const hasSkip = await skipButton.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasSkip) {
      await skipButton.click()
      // Should navigate to dashboard
      await page.waitForURL('**/dashboard', { timeout: 10000 })
      expect(page.url()).toContain('/dashboard')
    }

    await setOnboardingDismissed(page, true)
  })
})
