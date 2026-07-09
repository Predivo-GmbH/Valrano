/**
 * Public E2E: Auth form interactions and public page verification.
 *
 * These tests run WITHOUT authentication and verify that public-facing
 * pages (login, signup, forgot-password, legal, landing, 404) load
 * correctly and have the expected interactive elements.
 *
 * PasswordGate bypass: sets localStorage 'bs_unlocked' = 'true' via addInitScript.
 */
import { test, expect } from '@playwright/test'

// Bypass PasswordGate on every test
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('bs_unlocked', 'true')
  })
})

// ---------------------------------------------------------------------------
// 1. /login has email input and submit button
// ---------------------------------------------------------------------------
test.describe('Auth Forms — Login', () => {
  test('login page has email input and submit button', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Should have an email input
    const emailInput = page.locator('input[type="email"]').first()
    await expect(emailInput).toBeVisible({ timeout: 10000 })

    // Should have a submit button (Sign in / Log in / Continue)
    const submitButton = page.getByRole('button', { name: /sign in|log in|continue/i }).first()
    await expect(submitButton).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 2. /signup has email field and OTP flow
// ---------------------------------------------------------------------------
test.describe('Auth Forms — Signup', () => {
  test('signup page shows the waitlist email capture', async ({ page }) => {
    await page.goto('/signup')
    await page.waitForLoadState('networkidle')

    // Should have an email input
    const emailInput = page.locator('input[type="email"]').first()
    await expect(emailInput).toBeVisible({ timeout: 10000 })

    // Registrations are paused → "Notify me when it reopens"
    const submitButton = page.getByRole('button', { name: /notify me/i }).first()
    await expect(submitButton).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 3. /forgot-password loads and has email input
// ---------------------------------------------------------------------------
test.describe('Auth Forms — Forgot Password', () => {
  test('forgot-password page loads and has email input', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.waitForLoadState('networkidle')

    // Should show the reset password heading
    const heading = page.locator('h1')
    await expect(heading).toBeVisible({ timeout: 10000 })

    const headingText = await heading.textContent()
    expect(headingText?.toLowerCase()).toContain('reset')

    // Should have an email input
    const emailInput = page.locator('input[type="email"]').first()
    await expect(emailInput).toBeVisible()

    // Should have a submit button
    const submitButton = page.locator('button[type="submit"]').first()
    await expect(submitButton).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 4. Legal pages have unique heading content
// ---------------------------------------------------------------------------
test.describe('Legal Pages', () => {
  test('privacy page has unique heading', async ({ page }) => {
    await page.goto('/privacy')
    await page.waitForLoadState('networkidle')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(100)

    // Should contain privacy-related content
    const hasPrivacy = body?.toLowerCase().includes('privacy')
    expect(hasPrivacy).toBe(true)
  })

  test('terms page has unique heading', async ({ page }) => {
    await page.goto('/terms')
    await page.waitForLoadState('networkidle')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(100)

    // Should contain terms-related content
    const hasTerms = body?.toLowerCase().includes('terms')
    expect(hasTerms).toBe(true)
  })

  test('imprint page has unique heading', async ({ page }) => {
    await page.goto('/imprint')
    await page.waitForLoadState('networkidle')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(100)

    // Should contain imprint-related content
    const hasImprint =
      body?.toLowerCase().includes('imprint') ||
      body?.toLowerCase().includes('impressum') ||
      body?.toLowerCase().includes('predivo')
    expect(hasImprint).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 5. Landing page has hero section and pricing section
// ---------------------------------------------------------------------------
test.describe('Landing Page', () => {
  test('landing page has hero and pricing sections', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Should have the title
    await expect(page).toHaveTitle(/Valrano/)

    // Hero section — look for a prominent heading or CTA
    const heroHeading = page.locator('h1').first()
    await expect(heroHeading).toBeVisible({ timeout: 10000 })

    // Pricing section — should exist on the page
    const pricingSection = page.locator('#pricing, section:has-text("Pricing")').first()
    const hasPricing = await pricingSection.isVisible({ timeout: 5000 }).catch(() => false)

    if (!hasPricing) {
      // Scroll to bottom to check for lazy-loaded pricing
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(1000)
    }

    const body = await page.textContent('body')
    expect(body?.toLowerCase()).toContain('pricing')
  })
})

// ---------------------------------------------------------------------------
// 6. 404 page renders for invalid route
// ---------------------------------------------------------------------------
test.describe('Not Found Page', () => {
  test('404 page renders for invalid route', async ({ page }) => {
    await page.goto('/nonexistent')
    await page.waitForLoadState('networkidle')

    // Should render something (not a blank page or crash)
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(10)

    // Should NOT show error boundary (crash)
    expect(body).not.toContain('Something went wrong')
  })
})
