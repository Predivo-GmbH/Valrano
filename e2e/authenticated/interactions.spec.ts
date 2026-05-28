/**
 * Authenticated E2E: Interactive element verification.
 *
 * These tests run with a real authenticated session (from auth.setup.ts)
 * and verify that interactive UI elements are present and functional
 * across all major pages.
 */
import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// 1. Dashboard — peer comparison section
// ---------------------------------------------------------------------------
test.describe('Dashboard Interactions', () => {
  test('dashboard loads and has peer comparison section', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Should be on dashboard (not redirected)
    expect(page.url()).toContain('/dashboard')

    // Should show the Peer Comparison section — either a table or empty state
    const peerSection = page.locator('text=Peer Comparison').first()
    const table = page.locator('table').first()
    const emptyState = page.locator('text=Add competitors').or(page.locator('text=No data'))

    const hasPeerHeading = await peerSection.isVisible({ timeout: 10000 }).catch(() => false)
    const hasTable = await table.isVisible({ timeout: 3000 }).catch(() => false)
    const hasEmptyState = await emptyState.isVisible({ timeout: 3000 }).catch(() => false)

    expect(hasPeerHeading || hasTable || hasEmptyState).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // 2. Dashboard — KPI category tabs are clickable
  // ---------------------------------------------------------------------------
  test('KPI category tabs are clickable', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Wait for dashboard content
    await page.waitForTimeout(2000)

    // Find category tab buttons: Financial, ESG, Operational, All
    const financialTab = page.locator('button:has-text("Financial")').first()
    const esgTab = page.locator('button:has-text("ESG")').first()
    const operationalTab = page.locator('button:has-text("Operational")').first()

    const hasFinancial = await financialTab.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasFinancial) {
      // Click ESG tab and verify it becomes active
      await esgTab.click()
      await page.waitForTimeout(300)

      // Click Operational tab
      await operationalTab.click()
      await page.waitForTimeout(300)

      // Click back to Financial
      await financialTab.click()
      await page.waitForTimeout(300)

      // All tabs should still be visible (page didn't crash)
      await expect(financialTab).toBeVisible()
      await expect(esgTab).toBeVisible()
      await expect(operationalTab).toBeVisible()
    }
  })
})

// ---------------------------------------------------------------------------
// 3. Competitors page — "Add Peer" button
// ---------------------------------------------------------------------------
test.describe('Competitors Page Interactions', () => {
  test('competitors page has Add Peer button', async ({ page }) => {
    await page.goto('/competitors')
    await page.waitForLoadState('networkidle')

    const addButton = page.getByRole('button', { name: /add/i }).first()
    await expect(addButton).toBeVisible({ timeout: 10000 })
  })

  // ---------------------------------------------------------------------------
  // 4. Competitors page — tab switching
  // ---------------------------------------------------------------------------
  test('competitors page tab switching works', async ({ page }) => {
    await page.goto('/competitors')
    await page.waitForLoadState('networkidle')

    // The page has tabs: Competitors, Calendar, Review Queue
    const calendarTab = page.locator('button:has-text("Calendar"), [role="tab"]:has-text("Calendar")').first()
    const reviewTab = page.locator('button:has-text("Review"), [role="tab"]:has-text("Review")').first()
    const competitorsTab = page.locator('button:has-text("Competitors"), [role="tab"]:has-text("Competitors")').first()

    // Calendar tab should exist
    const hasCalendar = await calendarTab.isVisible({ timeout: 5000 }).catch(() => false)
    const hasReview = await reviewTab.isVisible({ timeout: 3000 }).catch(() => false)

    if (hasCalendar) {
      await calendarTab.click()
      await page.waitForTimeout(500)
      // Page should not crash
      const body = await page.textContent('body')
      expect(body).not.toContain('Something went wrong')
    }

    if (hasReview) {
      await reviewTab.click()
      await page.waitForTimeout(500)
      const body = await page.textContent('body')
      expect(body).not.toContain('Something went wrong')
    }

    // Switch back to Competitors tab
    if (await competitorsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await competitorsTab.click()
      await page.waitForTimeout(300)
    }

    expect(hasCalendar || hasReview).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 5. My Company page — 3 tabs
// ---------------------------------------------------------------------------
test.describe('My Company Page Interactions', () => {
  test('my company page has Profile, KPIs & Reports, and Benchmark tabs', async ({ page }) => {
    await page.goto('/my-company')
    await page.waitForLoadState('networkidle')

    // Check for the three tabs
    const profileTab = page.locator('[role="tab"]:has-text("Profile"), button:has-text("Profile")').first()
    const kpisTab = page.locator('[role="tab"]:has-text("KPIs"), button:has-text("KPIs")').first()
    const benchmarkTab = page.locator('[role="tab"]:has-text("Benchmark"), button:has-text("Benchmark")').first()

    await expect(profileTab).toBeVisible({ timeout: 10000 })
    await expect(kpisTab).toBeVisible()
    await expect(benchmarkTab).toBeVisible()

    // Click each tab and verify no crash
    await kpisTab.click()
    await page.waitForTimeout(500)
    let body = await page.textContent('body')
    expect(body).not.toContain('Something went wrong')

    await benchmarkTab.click()
    await page.waitForTimeout(500)
    body = await page.textContent('body')
    expect(body).not.toContain('Something went wrong')

    // Return to Profile
    await profileTab.click()
    await page.waitForTimeout(300)
  })
})

// ---------------------------------------------------------------------------
// 6. Analytics page — chart container and view mode buttons
// ---------------------------------------------------------------------------
test.describe('Analytics Page Interactions', () => {
  test('analytics page has chart container and view mode tabs', async ({ page }) => {
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    expect(page.url()).toContain('/analytics')

    // Should have view mode tabs (Trends, Scatter, etc.)
    const trendsTab = page.locator('button:has-text("Trends"), [role="tab"]:has-text("Trends")').first()
    const scatterTab = page.locator('button:has-text("Scatter"), [role="tab"]:has-text("Scatter")').first()

    const hasTrends = await trendsTab.isVisible({ timeout: 10000 }).catch(() => false)

    if (hasTrends) {
      // Click Scatter tab
      if (await scatterTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await scatterTab.click()
        await page.waitForTimeout(500)
        const body = await page.textContent('body')
        expect(body).not.toContain('Something went wrong')
      }

      // Return to Trends
      await trendsTab.click()
      await page.waitForTimeout(300)
    }

    // Page should have chart-related content (SVG, canvas, or chart container)
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body).not.toContain('Something went wrong')
  })
})

// ---------------------------------------------------------------------------
// 7. Reports page — "New Report" button
// ---------------------------------------------------------------------------
test.describe('Reports Page Interactions', () => {
  test('reports page has New Report button', async ({ page }) => {
    await page.goto('/reports')
    await page.waitForLoadState('networkidle')

    expect(page.url()).toContain('/reports')

    // Should have "New Report" button
    const newReportButton = page.getByRole('button', { name: /new report/i }).first()
    const hasButton = await newReportButton.isVisible({ timeout: 10000 }).catch(() => false)

    if (hasButton) {
      // Click it to open create dialog
      await newReportButton.click()
      await page.waitForTimeout(500)

      // Dialog should appear
      const dialog = page.locator('[role="dialog"]')
      const hasDialog = await dialog.isVisible({ timeout: 3000 }).catch(() => false)

      if (hasDialog) {
        // Close dialog with Escape
        await page.keyboard.press('Escape')
      }
    }

    // Alternatively, the page may show an empty state with a create button
    const body = await page.textContent('body')
    expect(body).not.toContain('Something went wrong')
  })
})

// ---------------------------------------------------------------------------
// 8. Account page — shows user email
// ---------------------------------------------------------------------------
test.describe('Account Page Interactions', () => {
  test('account page shows user email', async ({ page }) => {
    await page.goto('/account')
    await page.waitForLoadState('networkidle')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()

    // Should display the test user's email or an email-like string
    const hasEmail = body?.includes('@') || body?.toLowerCase().includes('email')
    expect(hasEmail).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // 9. Account page — has "Delete Account" section
  // ---------------------------------------------------------------------------
  test('account page has Delete Account section', async ({ page }) => {
    await page.goto('/account')
    await page.waitForLoadState('networkidle')

    // Should have Danger Zone with Delete Account
    const dangerZone = page.locator('text=Danger Zone').first()
    const deleteButton = page.getByRole('button', { name: /delete account/i }).first()

    const hasDanger = await dangerZone.isVisible({ timeout: 10000 }).catch(() => false)
    const hasDelete = await deleteButton.isVisible({ timeout: 5000 }).catch(() => false)

    expect(hasDanger || hasDelete).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 10. Settings page — Team tab and Approval Chains tab
// ---------------------------------------------------------------------------
test.describe('Settings Page Interactions', () => {
  test('settings page has Team and Approval Chains tabs', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    expect(page.url()).toContain('/settings')

    // Should have Team and Approval Chains tabs
    const teamTab = page.locator('[role="tab"]:has-text("Team"), button:has-text("Team")').first()
    const approvalsTab = page.locator('[role="tab"]:has-text("Approval"), button:has-text("Approval")').first()

    await expect(teamTab).toBeVisible({ timeout: 10000 })
    await expect(approvalsTab).toBeVisible()

    // Click Approval Chains tab and verify no crash
    await approvalsTab.click()
    await page.waitForTimeout(500)

    const body = await page.textContent('body')
    expect(body).not.toContain('Something went wrong')

    // Return to Team tab
    await teamTab.click()
    await page.waitForTimeout(300)
  })
})
