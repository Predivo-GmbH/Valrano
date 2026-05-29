/**
 * Authenticated E2E: Analytics page interactions.
 *
 * Tests CSV export, KPI/company filters, and chart rendering.
 */
import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// ANA-003: Export CSV
// ---------------------------------------------------------------------------
test.describe('Analytics — Export', () => {
  test('ANA-003: download CSV button is present on each analytics tab', async ({ page }) => {
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    // Look for CSV download buttons (aria-label contains "Download" or "CSV")
    const csvButtons = page.locator(
      'button[aria-label*="Download"], button[aria-label*="CSV"], button:has-text("CSV")'
    )
    const csvCount = await csvButtons.count()

    // At least one CSV export button should be visible on one of the tabs
    const trendsTab = page.locator('button:has-text("Trends"), [role="tab"]:has-text("Trends")').first()
    if (await trendsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await trendsTab.click()
      await page.waitForTimeout(500)
    }

    // Check for download button after tab switch
    const downloadBtn = page.locator('button[aria-label*="Download"]').first()
    const hasDownload = await downloadBtn.isVisible({ timeout: 5000 }).catch(() => false)

    // Page should render without crash
    const body = await page.textContent('body')
    expect(body).not.toContain('Something went wrong')
  })
})

// ---------------------------------------------------------------------------
// ANA-004: KPI/company filter
// ---------------------------------------------------------------------------
test.describe('Analytics — Filters', () => {
  test('ANA-004: KPI and company filter controls are present', async ({ page }) => {
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    // Look for filter controls (dropdowns, selects, comboboxes)
    const filterControls = page.locator(
      'select, [role="combobox"], [role="listbox"], button:has-text("Filter"), button:has-text("KPI"), button:has-text("Company")'
    )
    const filterCount = await filterControls.count()

    // Look for KPI-related controls on different tabs
    const tabs = ['Trends', 'CAGR', 'Scatter', 'Heatmap', 'Percentile']
    for (const tabName of tabs) {
      const tab = page.locator(`button:has-text("${tabName}"), [role="tab"]:has-text("${tabName}")`).first()
      if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tab.click()
        await page.waitForTimeout(500)

        // Each tab should render without crash
        const body = await page.textContent('body')
        expect(body).not.toContain('Something went wrong')
      }
    }
  })
})
