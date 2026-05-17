import { test, expect } from '@playwright/test'

test.describe('Critical Path', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Valrano/)
  })

  test('login page accessible', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading')).toBeVisible()
  })

  test('unauthenticated redirect works', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL(/\/(login|auth)/)
    expect(page.url()).toMatch(/\/(login|auth)/)
  })

  test('signup page accessible', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByRole('heading')).toBeVisible()
  })
})
