/**
 * Public E2E: Auth flow form verification.
 *
 * Tests that login, signup, and forgot-password forms have the correct
 * fields, tabs, and submit buttons for each auth method.
 * Does NOT submit real credentials — only verifies UI presence.
 *
 * PasswordGate bypass via localStorage.
 */
import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('bs_unlocked', 'true')
  })
})

// ---------------------------------------------------------------------------
// AUTH-001: Password login form fields
// ---------------------------------------------------------------------------
test.describe('Auth Flows — Login', () => {
  test('AUTH-001: password login form has email, password, and submit', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Switch to Password tab if present
    const passwordTab = page.locator('text=Password').first()
    if (await passwordTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await passwordTab.click()
      await page.waitForTimeout(300)
    }

    // Should have email input
    const emailInput = page.locator('input[type="email"]').first()
    await expect(emailInput).toBeVisible({ timeout: 5000 })

    // Should have password input
    const passwordInput = page.locator('input[type="password"]').first()
    await expect(passwordInput).toBeVisible()

    // Should have submit button
    const submitButton = page.getByRole('button', { name: /sign in|log in/i }).first()
    await expect(submitButton).toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // AUTH-002: OTP login form fields
  // ---------------------------------------------------------------------------
  test('AUTH-002: OTP login form has email input and submit', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Look for OTP/Magic Link tab
    const otpTab = page.locator('text=Magic Link').or(page.locator('text=OTP')).or(page.locator('text=Email')).first()
    const hasOtpTab = await otpTab.isVisible({ timeout: 3000 }).catch(() => false)

    if (hasOtpTab) {
      await otpTab.click()
      await page.waitForTimeout(300)
    }

    // Should have email input
    const emailInput = page.locator('input[type="email"]').first()
    await expect(emailInput).toBeVisible({ timeout: 5000 })

    // Should have submit button
    const submitButton = page.locator('button[type="submit"]').first()
    await expect(submitButton).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AUTH-003: Registration form fields
// ---------------------------------------------------------------------------
test.describe('Auth Flows — Registration', () => {
  test('AUTH-003: signup route shows the waitlist while registrations are paused', async ({ page }) => {
    await page.goto('/signup')
    await page.waitForLoadState('networkidle')

    // Registration is paused → the /signup route captures a waitlist email.
    const emailInput = page.locator('input[type="email"]').first()
    await expect(emailInput).toBeVisible({ timeout: 5000 })

    const notifyButton = page.getByRole('button', { name: /notify me/i }).first()
    await expect(notifyButton).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AUTH-004: Forgot password form
// ---------------------------------------------------------------------------
test.describe('Auth Flows — Forgot Password', () => {
  test('AUTH-004: forgot password form has email and submit', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.waitForLoadState('networkidle')

    // Should show reset password heading
    const heading = page.locator('h1')
    await expect(heading).toBeVisible({ timeout: 5000 })

    // Should have email input
    const emailInput = page.locator('input[type="email"]').first()
    await expect(emailInput).toBeVisible()

    // Should have submit button
    const submitButton = page.locator('button[type="submit"]').first()
    await expect(submitButton).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AUTH-005: Reset password page (via direct URL)
// ---------------------------------------------------------------------------
test.describe('Auth Flows — Reset Password', () => {
  test('AUTH-005: reset-password page renders form or redirect', async ({ page }) => {
    // Navigate to reset-password (without a valid token, it should show a form or error)
    await page.goto('/reset-password')
    await page.waitForLoadState('networkidle')

    const body = await page.textContent('body')
    expect(body).toBeTruthy()

    // Should show either a password form or a redirect/error message
    const hasPasswordContent =
      body?.includes('password') ||
      body?.includes('Password') ||
      body?.includes('Reset') ||
      body?.includes('expired') ||
      body?.includes('invalid') ||
      page.url().includes('/login')

    expect(hasPasswordContent).toBe(true)
  })
})
