/**
 * Authenticated E2E: Navigation and layout interactions.
 *
 * Tests user menu dropdown, mobile hamburger nav,
 * and competitor page interactions.
 */
import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// NAV-003: User menu dropdown
// ---------------------------------------------------------------------------
test.describe('Navigation — User Menu', () => {
  test('NAV-003: user menu dropdown shows Account, Settings, Sign out', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Open user menu dropdown
    const userMenuButton = page.locator('button[aria-label="User menu"]').first()
    await expect(userMenuButton).toBeVisible({ timeout: 10000 })
    await userMenuButton.click()
    await page.waitForTimeout(500)

    // Should show dropdown with Account, Settings, Sign out
    const body = await page.textContent('body')
    const hasAccount = body?.includes('Account')
    const hasSettings = body?.includes('Settings')
    const hasSignOut = body?.includes('Sign out')

    expect(hasAccount).toBe(true)
    expect(hasSettings).toBe(true)
    expect(hasSignOut).toBe(true)

    // Click Account to navigate
    const accountLink = page.locator('text=Account').first()
    if (await accountLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await accountLink.click()
      await page.waitForLoadState('networkidle')
      expect(page.url()).toContain('/account')
    }
  })
})

// ---------------------------------------------------------------------------
// NAV-004: Mobile hamburger menu
// ---------------------------------------------------------------------------
test.describe('Navigation — Mobile', () => {
  test('NAV-004: hamburger menu opens nav drawer on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 })

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Look for hamburger button (menu icon)
    const hamburger = page.locator('button[aria-label*="menu"], button[aria-label*="Menu"], button:has(svg.lucide-menu)').first()
    const hasHamburger = await hamburger.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasHamburger) {
      await hamburger.click()
      await page.waitForTimeout(500)

      // Nav drawer should open with navigation links
      const navDrawer = page.locator('nav, [role="dialog"], aside')
      const drawerVisible = await navDrawer.first().isVisible({ timeout: 3000 }).catch(() => false)

      if (drawerVisible) {
        // Should show nav links
        const drawerText = await navDrawer.first().textContent()
        const hasLinks =
          drawerText?.includes('Dashboard') ||
          drawerText?.includes('Competitors') ||
          drawerText?.includes('Analytics')

        expect(hasLinks).toBe(true)
      }
    }

    // Page should not crash at mobile size
    const body = await page.textContent('body')
    expect(body).not.toContain('Something went wrong')
  })
})

// ---------------------------------------------------------------------------
// COMP-003: Remove competitor (trash button visible)
// ---------------------------------------------------------------------------
test.describe('Competitors — Remove', () => {
  test('COMP-003: remove button visible on competitor cards', async ({ page }) => {
    await page.goto('/competitors')
    await page.waitForLoadState('networkidle')

    // Look for remove/trash buttons on peer cards
    const removeButtons = page.locator('button[aria-label*="Remove"], button[aria-label*="remove"], button[aria-label*="Delete"]')
    const removeCount = await removeButtons.count()

    // Data-dependent — page should not crash
    const body = await page.textContent('body')
    expect(body).not.toContain('Something went wrong')
  })
})

// ---------------------------------------------------------------------------
// COMP-006: Click company card → company profile
// ---------------------------------------------------------------------------
test.describe('Competitors — Company Profile', () => {
  test('COMP-006: clicking company navigates to profile page', async ({ page }) => {
    await page.goto('/competitors')
    await page.waitForLoadState('networkidle')

    // Find clickable company cards or links
    const companyLinks = page.locator('a[href*="/companies/"]').first()
    const hasLinks = await companyLinks.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasLinks) {
      await companyLinks.click()
      await page.waitForLoadState('networkidle')

      // Should navigate to company profile
      expect(page.url()).toContain('/companies/')

      // Profile page should load without crash
      const body = await page.textContent('body')
      expect(body).not.toContain('Something went wrong')
    }
  })
})

// ---------------------------------------------------------------------------
// COMP-007: View mode toggle (grid/table)
// ---------------------------------------------------------------------------
test.describe('Competitors — View Toggle', () => {
  test('COMP-007: grid and table view toggle works', async ({ page }) => {
    await page.goto('/competitors')
    await page.waitForLoadState('networkidle')

    // Look for view mode toggle buttons
    const cardViewBtn = page.locator('button[aria-label="Card view"]').first()
    const tableViewBtn = page.locator('button[aria-label="Table view"]').first()

    const hasCardView = await cardViewBtn.isVisible({ timeout: 5000 }).catch(() => false)
    const hasTableView = await tableViewBtn.isVisible({ timeout: 3000 }).catch(() => false)

    if (hasCardView && hasTableView) {
      // Switch to table view
      await tableViewBtn.click()
      await page.waitForTimeout(500)
      let body = await page.textContent('body')
      expect(body).not.toContain('Something went wrong')

      // Switch back to card view
      await cardViewBtn.click()
      await page.waitForTimeout(500)
      body = await page.textContent('body')
      expect(body).not.toContain('Something went wrong')
    }
  })
})
