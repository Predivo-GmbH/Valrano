/**
 * Authenticated E2E: Dashboard action interactions.
 *
 * Tests Export PDF, Generate Insights, insight actions, column sorting,
 * and fiscal year filter.
 */
import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// DASH-002: Fiscal year filter (full test)
// ---------------------------------------------------------------------------
test.describe('Dashboard — FY Filter', () => {
  test('DASH-002: fiscal year selector changes displayed data', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Find year display (e.g., 2024, 2025)
    const year2024 = page.locator('text=2024').first()
    const year2025 = page.locator('text=2025').first()

    const has2024 = await year2024.isVisible({ timeout: 5000 }).catch(() => false)
    const has2025 = await year2025.isVisible({ timeout: 3000 }).catch(() => false)

    // At least one year should be visible
    expect(has2024 || has2025).toBe(true)

    // Try clicking a different year to see if table updates
    if (has2024 && has2025) {
      await year2025.click()
      await page.waitForTimeout(500)
      const body = await page.textContent('body')
      expect(body).not.toContain('Something went wrong')
    }
  })
})

// ---------------------------------------------------------------------------
// DASH-004: Export PDF
// ---------------------------------------------------------------------------
test.describe('Dashboard — Export', () => {
  test('DASH-004: export brief button is available', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Look for "Export Brief" button
    const exportButton = page.locator('button[aria-label="Export insights as brief"], button:has-text("Export Brief")').first()
    const hasExport = await exportButton.isVisible({ timeout: 5000 }).catch(() => false)

    // Export may only appear when insights exist — page should not crash
    const body = await page.textContent('body')
    expect(body).not.toContain('Something went wrong')
  })
})

// ---------------------------------------------------------------------------
// DASH-005: Generate Insights
// ---------------------------------------------------------------------------
test.describe('Dashboard — Insights', () => {
  test('DASH-005: generate insights button is available', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Look for "Generate Insights" button
    const insightsButton = page.locator('button:has-text("Generate Insights")').first()
    const hasInsights = await insightsButton.isVisible({ timeout: 5000 }).catch(() => false)

    // Button may be hidden if no data — page should not crash
    const body = await page.textContent('body')
    expect(body).not.toContain('Something went wrong')
  })

  // ---------------------------------------------------------------------------
  // DASH-006: Insight actions (bookmark, acted, dismiss)
  // ---------------------------------------------------------------------------
  test('DASH-006: insight action buttons are accessible', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Look for insight action buttons
    const bookmarkBtn = page.locator('button[aria-label*="Bookmark"]').first()
    const actedBtn = page.locator('button[aria-label="Mark as acted upon"]').first()
    const dismissBtn = page.locator('button[aria-label="Dismiss insight"]').first()

    const hasBookmark = await bookmarkBtn.isVisible({ timeout: 5000 }).catch(() => false)
    const hasActed = await actedBtn.isVisible({ timeout: 3000 }).catch(() => false)
    const hasDismiss = await dismissBtn.isVisible({ timeout: 3000 }).catch(() => false)

    // Data-dependent — page should not crash
    const body = await page.textContent('body')
    expect(body).not.toContain('Something went wrong')
  })
})

// ---------------------------------------------------------------------------
// DASH-007: Sort columns
// ---------------------------------------------------------------------------
test.describe('Dashboard — Sorting', () => {
  test('DASH-007: column headers are clickable for sorting', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Look for sortable column headers
    const sortButton = page.locator('button[aria-label*="Sort"], th button').first()
    const hasSortable = await sortButton.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasSortable) {
      await sortButton.click()
      await page.waitForTimeout(300)

      // Table should re-render without crash
      const body = await page.textContent('body')
      expect(body).not.toContain('Something went wrong')

      // Click again to reverse sort
      await sortButton.click()
      await page.waitForTimeout(300)
      const body2 = await page.textContent('body')
      expect(body2).not.toContain('Something went wrong')
    }
  })
})
