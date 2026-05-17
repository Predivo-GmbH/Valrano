import { test, expect } from '@playwright/test'

test.describe('Smoke Tests', () => {
  test('homepage redirects to dashboard', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('app loads with correct title', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveTitle(/Valrano/)
  })

  test('no console errors on dashboard', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    // Filter out expected errors (Supabase auth when not logged in, env var warnings)
    const realErrors = errors.filter(
      (e) =>
        !e.includes('supabase') &&
        !e.includes('auth') &&
        !e.includes('VITE_') &&
        !e.includes('401') &&
        !e.includes('403'),
    )
    expect(realErrors).toHaveLength(0)
  })

  test('dark mode is default', async ({ page }) => {
    await page.goto('/dashboard')
    const html = page.locator('html')
    await expect(html).toHaveClass(/dark/)
  })

  test('upload page is reachable', async ({ page }) => {
    await page.goto('/upload')
    await expect(page).toHaveTitle(/Valrano/)
  })

  test('review page is reachable', async ({ page }) => {
    await page.goto('/review')
    await expect(page).toHaveTitle(/Valrano/)
  })

  test('unknown route does not crash app', async ({ page }) => {
    await page.goto('/nonexistent-route-xyz')
    // Should either redirect or show a not-found page — not a blank page
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
  })
})
