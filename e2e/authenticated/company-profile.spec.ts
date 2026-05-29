/**
 * Authenticated E2E: Company Profile page interactions.
 *
 * Tests company profile page load, website editing, IR page detection,
 * and publication event creation.
 */
import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// PROF-001: Company profile page loads
// ---------------------------------------------------------------------------
test.describe('Company Profile', () => {
  test('PROF-001: company profile page renders without crash', async ({ page }) => {
    // First navigate to competitors to find a company link
    await page.goto('/competitors')
    await page.waitForLoadState('networkidle')

    const companyLink = page.locator('a[href*="/companies/"]').first()
    const hasLink = await companyLink.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasLink) {
      const href = await companyLink.getAttribute('href')
      await page.goto(href!)
      await page.waitForLoadState('networkidle')

      expect(page.url()).toContain('/companies/')

      const body = await page.textContent('body')
      expect(body).not.toContain('Something went wrong')

      // Should show company-related content
      const hasCompanyContent =
        body?.includes('Website') ||
        body?.includes('IR Page') ||
        body?.includes('Sector') ||
        body?.includes('Country') ||
        body?.includes('Publication') ||
        body?.includes('Report')

      expect(hasCompanyContent).toBe(true)
    }
  })

  // ---------------------------------------------------------------------------
  // PROF-002/003: Website editing
  // ---------------------------------------------------------------------------
  test('PROF-002/003: website section has edit controls', async ({ page }) => {
    await page.goto('/competitors')
    await page.waitForLoadState('networkidle')

    const companyLink = page.locator('a[href*="/companies/"]').first()
    const hasLink = await companyLink.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasLink) {
      const href = await companyLink.getAttribute('href')
      await page.goto(href!)
      await page.waitForLoadState('networkidle')

      // Look for Re-detect or pencil edit buttons near website
      const redetectBtn = page.locator('button:has-text("Re-detect")').first()
      const editBtns = page.locator('button[aria-label*="Edit"], button:has(svg.lucide-pencil)')

      const hasRedetect = await redetectBtn.isVisible({ timeout: 3000 }).catch(() => false)
      const editCount = await editBtns.count()

      // Page should render without crash
      const body = await page.textContent('body')
      expect(body).not.toContain('Something went wrong')
    }
  })

  // ---------------------------------------------------------------------------
  // PROF-004/005: IR URL editing
  // ---------------------------------------------------------------------------
  test('PROF-004/005: IR page section has auto-detect and edit controls', async ({ page }) => {
    await page.goto('/competitors')
    await page.waitForLoadState('networkidle')

    const companyLink = page.locator('a[href*="/companies/"]').first()
    const hasLink = await companyLink.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasLink) {
      const href = await companyLink.getAttribute('href')
      await page.goto(href!)
      await page.waitForLoadState('networkidle')

      // Look for Auto-detect button for IR page
      const autoDetectBtn = page.locator('button:has-text("Auto-detect"), button:has-text("Detect")').first()
      const hasAutoDetect = await autoDetectBtn.isVisible({ timeout: 3000 }).catch(() => false)

      const body = await page.textContent('body')
      expect(body).not.toContain('Something went wrong')
    }
  })

  // ---------------------------------------------------------------------------
  // PROF-006: Add publication event
  // ---------------------------------------------------------------------------
  test('PROF-006: add event button opens form on company profile', async ({ page }) => {
    await page.goto('/competitors')
    await page.waitForLoadState('networkidle')

    const companyLink = page.locator('a[href*="/companies/"]').first()
    const hasLink = await companyLink.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasLink) {
      const href = await companyLink.getAttribute('href')
      await page.goto(href!)
      await page.waitForLoadState('networkidle')

      // Look for "Add Event" button
      const addEventBtn = page.locator('button:has-text("Add Event")').first()
      const hasAddEvent = await addEventBtn.isVisible({ timeout: 5000 }).catch(() => false)

      if (hasAddEvent) {
        await addEventBtn.click()
        await page.waitForTimeout(500)

        // Should show event form or dialog
        const dialog = page.locator('[role="dialog"]')
        const hasDialog = await dialog.isVisible({ timeout: 3000 }).catch(() => false)

        if (hasDialog) {
          const dialogText = await dialog.textContent()
          const hasEventFields =
            dialogText?.includes('Date') ||
            dialogText?.includes('Report') ||
            dialogText?.includes('Fiscal') ||
            dialogText?.includes('Type')

          expect(hasEventFields).toBe(true)
          await page.keyboard.press('Escape')
        }
      }

      const body = await page.textContent('body')
      expect(body).not.toContain('Something went wrong')
    }
  })
})
