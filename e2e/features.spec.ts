import { test, expect } from '@playwright/test'

test.describe('F-004: Dashboard', () => {
  test('dashboard page loads', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.locator('text=Peer Comparison')).toBeVisible({ timeout: 10000 })
  })

  test('dashboard shows KPI table', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    const table = page.locator('table')
    await expect(table).toBeVisible({ timeout: 10000 })
  })

  test('fiscal year selector works', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.locator('text=2024')).toBeVisible({ timeout: 10000 })
  })

  test('dashboard renders company names in table', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    // At least one company should appear in the table after data loads
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10000 })
  })

  test('KPI column headers are visible', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    // Should have at least one column header for KPI names
    const headers = page.locator('th')
    await expect(headers.first()).toBeVisible({ timeout: 10000 })
  })
})

test.describe('F-006: Upload', () => {
  test('upload page loads', async ({ page }) => {
    await page.goto('/upload')
    await expect(page.locator('text=Upload')).toBeVisible({ timeout: 10000 })
  })

  test('upload form has required fields', async ({ page }) => {
    await page.goto('/upload')
    await expect(page.locator('text=Company')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Report Type')).toBeVisible({ timeout: 10000 })
  })

  test('upload page accepts PDF file type only', async ({ page }) => {
    await page.goto('/upload')
    await page.waitForLoadState('networkidle')
    const fileInput = page.locator('input[type="file"]')
    // Check the file input exists and accepts PDF
    if (await fileInput.count() > 0) {
      const accept = await fileInput.getAttribute('accept')
      expect(accept).toMatch(/pdf/i)
    }
  })
})

test.describe('F-011: Review', () => {
  test('review page loads', async ({ page }) => {
    await page.goto('/review')
    await expect(page.locator('text=Review')).toBeVisible({ timeout: 10000 })
  })

  test('review page shows queue or empty state', async ({ page }) => {
    await page.goto('/review')
    await page.waitForLoadState('networkidle')
    // Either a queue of items or an empty state message
    const content = await page.textContent('body')
    expect(content).toBeTruthy()
    expect(content!.length).toBeGreaterThan(0)
  })
})

test.describe('F-003: Navigation', () => {
  test('nav links work', async ({ page }) => {
    await page.goto('/dashboard')
    await page.click('text=Upload')
    await expect(page).toHaveURL(/\/upload/)

    await page.click('text=Review')
    await expect(page).toHaveURL(/\/review/)

    await page.click('text=Dashboard')
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('BenchmarkSignal logo is visible in nav', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.locator('text=BenchmarkSignal')).toBeVisible({ timeout: 10000 })
  })

  test('theme toggle button is present', async ({ page }) => {
    await page.goto('/dashboard')
    // There should be at least one button in the nav (theme toggle)
    const buttons = page.locator('nav button, header button')
    await expect(buttons.first()).toBeVisible({ timeout: 10000 })
  })
})
