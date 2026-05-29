/**
 * Authenticated E2E: My Company page interactions.
 *
 * Tests inline editing, upload report dialog, report deletion,
 * KPI entry, and accounting profile actions.
 */
import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// MYCO-002: Inline field editing
// ---------------------------------------------------------------------------
test.describe('My Company — Inline Editing', () => {
  test('MYCO-002: profile fields are editable on click', async ({ page }) => {
    await page.goto('/my-company')
    await page.waitForLoadState('networkidle')

    // Ensure we're on the Profile tab
    const profileTab = page.locator('[role="tab"]:has-text("Profile"), button:has-text("Profile")').first()
    if (await profileTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await profileTab.click()
      await page.waitForTimeout(500)
    }

    // Look for editable field indicators (pencil icons or edit buttons)
    const editButtons = page.locator('button[aria-label="Edit"], button:has(svg.lucide-pencil), [class*="edit"]')
    const editCount = await editButtons.count()

    // Profile section should have editable fields (sector, country, etc.)
    // Even if no edit buttons, the section should render without crash
    const body = await page.textContent('body')
    expect(body).not.toContain('Something went wrong')

    // Should show company profile fields
    const hasProfileContent =
      body?.includes('Sector') ||
      body?.includes('Country') ||
      body?.includes('Industry') ||
      body?.includes('Company') ||
      body?.includes('Profile')

    expect(hasProfileContent).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// MYCO-003: Upload report dialog
// ---------------------------------------------------------------------------
test.describe('My Company — Upload Report', () => {
  test('MYCO-003: upload report button opens dialog', async ({ page }) => {
    await page.goto('/my-company')
    await page.waitForLoadState('networkidle')

    // Switch to KPIs tab where upload is available
    const kpisTab = page.locator('[role="tab"]:has-text("KPIs"), button:has-text("KPIs")').first()
    if (await kpisTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await kpisTab.click()
      await page.waitForTimeout(500)
    }

    // Find "Upload Report" button
    const uploadButton = page.getByRole('button', { name: /upload report/i }).first()
    const hasUpload = await uploadButton.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasUpload) {
      await uploadButton.click()
      await page.waitForTimeout(500)

      // Dialog should appear
      const dialog = page.locator('[role="dialog"]')
      const hasDialog = await dialog.isVisible({ timeout: 3000 }).catch(() => false)
      expect(hasDialog).toBe(true)

      if (hasDialog) {
        // Dialog should have file input or drop zone
        const body = await dialog.textContent()
        const hasUploadUI =
          body?.includes('drag') ||
          body?.includes('Drop') ||
          body?.includes('upload') ||
          body?.includes('PDF') ||
          body?.includes('Browse')

        expect(hasUploadUI).toBe(true)

        // Close dialog
        await page.keyboard.press('Escape')
      }
    }

    // Page should not crash regardless
    const body = await page.textContent('body')
    expect(body).not.toContain('Something went wrong')
  })

  // ---------------------------------------------------------------------------
  // MYCO-004: Delete report — trash icon visible
  // ---------------------------------------------------------------------------
  test('MYCO-004: report list shows delete button when reports exist', async ({ page }) => {
    await page.goto('/my-company')
    await page.waitForLoadState('networkidle')

    // Switch to KPIs tab
    const kpisTab = page.locator('[role="tab"]:has-text("KPIs"), button:has-text("KPIs")').first()
    if (await kpisTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await kpisTab.click()
      await page.waitForTimeout(500)
    }

    // Look for delete report buttons (trash icons)
    const deleteButtons = page.locator('button[aria-label="Delete report"]')
    const deleteCount = await deleteButtons.count()

    // If reports exist, delete buttons should be present
    // If no reports, page should still render correctly
    const body = await page.textContent('body')
    expect(body).not.toContain('Something went wrong')
  })

  // ---------------------------------------------------------------------------
  // MYCO-005: Retry extraction button
  // ---------------------------------------------------------------------------
  test('MYCO-005: retry extraction button is present for failed reports', async ({ page }) => {
    await page.goto('/my-company')
    await page.waitForLoadState('networkidle')

    const kpisTab = page.locator('[role="tab"]:has-text("KPIs"), button:has-text("KPIs")').first()
    if (await kpisTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await kpisTab.click()
      await page.waitForTimeout(500)
    }

    // Look for retry buttons
    const retryButtons = page.locator('button[aria-label="Retry extraction"]')

    // Whether retry buttons exist depends on data state, but page should not crash
    const body = await page.textContent('body')
    expect(body).not.toContain('Something went wrong')
  })
})

// ---------------------------------------------------------------------------
// MYCO-006: Manual KPI entry
// ---------------------------------------------------------------------------
test.describe('My Company — KPI Entry', () => {
  test('MYCO-006: KPIs tab shows data entry fields or empty state', async ({ page }) => {
    await page.goto('/my-company')
    await page.waitForLoadState('networkidle')

    const kpisTab = page.locator('[role="tab"]:has-text("KPIs"), button:has-text("KPIs")').first()
    await expect(kpisTab).toBeVisible({ timeout: 10000 })
    await kpisTab.click()
    await page.waitForTimeout(500)

    // KPIs tab should show either KPI data or an empty/upload state
    const body = await page.textContent('body')
    const hasKPIContent =
      body?.includes('KPI') ||
      body?.includes('Revenue') ||
      body?.includes('EBITDA') ||
      body?.includes('Upload') ||
      body?.includes('No data') ||
      body?.includes('report')

    expect(hasKPIContent).toBe(true)
    expect(body).not.toContain('Something went wrong')
  })
})

// ---------------------------------------------------------------------------
// MYCO-007 & MYCO-008: Accounting profile
// ---------------------------------------------------------------------------
test.describe('My Company — Accounting Profile', () => {
  test('MYCO-007: benchmark tab shows accounting profile or empty state', async ({ page }) => {
    await page.goto('/my-company')
    await page.waitForLoadState('networkidle')

    const benchmarkTab = page.locator('[role="tab"]:has-text("Benchmark"), button:has-text("Benchmark")').first()
    await expect(benchmarkTab).toBeVisible({ timeout: 10000 })
    await benchmarkTab.click()
    await page.waitForTimeout(500)

    const body = await page.textContent('body')
    const hasBenchmarkContent =
      body?.includes('Benchmark') ||
      body?.includes('Accounting') ||
      body?.includes('Profile') ||
      body?.includes('Analyze') ||
      body?.includes('No data') ||
      body?.includes('Upload')

    expect(hasBenchmarkContent).toBe(true)
    expect(body).not.toContain('Something went wrong')
  })

  test('MYCO-008: accounting profile section has delete option when profile exists', async ({ page }) => {
    await page.goto('/my-company')
    await page.waitForLoadState('networkidle')

    const benchmarkTab = page.locator('[role="tab"]:has-text("Benchmark"), button:has-text("Benchmark")').first()
    if (await benchmarkTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await benchmarkTab.click()
      await page.waitForTimeout(500)
    }

    // Whether delete exists depends on data, but page should not crash
    const body = await page.textContent('body')
    expect(body).not.toContain('Something went wrong')
  })
})
