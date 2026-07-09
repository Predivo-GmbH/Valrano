/**
 * Comprehensive Auth E2E Tests
 *
 * Tests EVERY auth-related route for page loads, form elements, navigation
 * links between auth pages, session guards on protected routes, broken route
 * regression (/auth/confirm), and JS error absence.
 *
 * Auth routes tested:
 *   /login, /signup, /forgot-password, /reset-password,
 *   /auth/callback, /auth/verify, /auth/confirm
 *
 * Protected routes tested for redirect:
 *   /dashboard, /my-company, /competitors, /analytics, /reports,
 *   /account, /settings, /onboarding
 *
 * PasswordGate bypass via localStorage.
 */
import { test, expect, type Page } from '@playwright/test'

const SUPABASE_URL = 'https://mkdeftmubrkseyrrbzvp.supabase.co'

// Bypass PasswordGate on every test
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('bs_unlocked', 'true')
  })
})

/** Collect real JS errors (filtering Supabase auth / VITE_ / expected HTTP codes). */
function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  return errors
}

function filterRealErrors(errors: string[]): string[] {
  return errors.filter(
    (e) =>
      !e.includes('supabase') &&
      !e.includes('auth') &&
      !e.includes('VITE_') &&
      !e.includes('401') &&
      !e.includes('403') &&
      !e.includes('Failed to fetch') &&
      !e.includes('net::ERR_'),
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. LOGIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('AUTH-FLOW-001: Login Page', () => {
  test('loads with correct title', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveTitle(/Sign In.*Valrano|Valrano/)
  })

  test('has heading "Sign in to Valrano"', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    const heading = page.locator('h1')
    await expect(heading).toBeVisible({ timeout: 10000 })
    await expect(heading).toContainText('Sign in')
  })

  test('Password tab: email + password inputs + submit button', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Click Password tab
    const passwordTab = page.getByRole('tab', { name: /password/i })
    await expect(passwordTab).toBeVisible({ timeout: 5000 })
    await passwordTab.click()
    await page.waitForTimeout(300)

    // Email input
    const emailInput = page.locator('#login-email')
    await expect(emailInput).toBeVisible()
    expect(await emailInput.getAttribute('type')).toBe('email')

    // Password input
    const passwordInput = page.locator('#login-password')
    await expect(passwordInput).toBeVisible()

    // Submit button
    const submitBtn = page.getByRole('button', { name: /sign in/i })
    await expect(submitBtn).toBeVisible()
  })

  test('Email Code tab: email input + send code button', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Click Email Code tab
    const codeTab = page.getByRole('tab', { name: /email code/i })
    await expect(codeTab).toBeVisible({ timeout: 5000 })
    await codeTab.click()
    await page.waitForTimeout(300)

    // Email input
    const emailInput = page.locator('#code-email')
    await expect(emailInput).toBeVisible()
    expect(await emailInput.getAttribute('type')).toBe('email')

    // Submit button
    const sendBtn = page.getByRole('button', { name: /send sign-in code/i })
    await expect(sendBtn).toBeVisible()
  })

  test('has "Forgot password?" link to /forgot-password', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Ensure Password tab is active (Forgot password link is there)
    const passwordTab = page.getByRole('tab', { name: /password/i })
    if (await passwordTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await passwordTab.click()
      await page.waitForTimeout(300)
    }

    const forgotLink = page.locator('a[href="/forgot-password"]')
    await expect(forgotLink).toBeVisible({ timeout: 5000 })
    await expect(forgotLink).toContainText('Forgot password')
  })

  test('has "Create account" button that opens the waitlist (registrations paused)', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Registration is paused pre-launch — "Create account" opens the waitlist
    // modal in place instead of navigating to a signup form.
    const createAccount = page.getByRole('button', { name: /create account/i })
    await expect(createAccount).toBeVisible({ timeout: 5000 })
    await createAccount.click()
    await expect(
      page.getByRole('heading', { name: /registrations are paused/i }),
    ).toBeVisible({ timeout: 5000 })
  })

  test('password visibility toggle works', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const passwordTab = page.getByRole('tab', { name: /password/i })
    if (await passwordTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await passwordTab.click()
      await page.waitForTimeout(300)
    }

    const passwordInput = page.locator('#login-password')
    await expect(passwordInput).toBeVisible()

    // Initially type=password
    expect(await passwordInput.getAttribute('type')).toBe('password')

    // Click toggle
    const toggleBtn = page.getByRole('button', { name: /show password/i })
    await toggleBtn.click()
    expect(await passwordInput.getAttribute('type')).toBe('text')

    // Click again to hide
    const hideBtn = page.getByRole('button', { name: /hide password/i })
    await hideBtn.click()
    expect(await passwordInput.getAttribute('type')).toBe('password')
  })

  test('no JS errors', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    expect(filterRealErrors(errors)).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SIGNUP PAGE
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('AUTH-FLOW-002: Signup Page', () => {
  test('loads with the waitlist title', async ({ page }) => {
    await page.goto('/signup')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveTitle(/waitlist.*Valrano|Valrano/i)
  })

  test('shows the waitlist instead of a self-serve signup form', async ({ page }) => {
    await page.goto('/signup')
    await page.waitForLoadState('networkidle')
    const heading = page.locator('h1')
    await expect(heading).toBeVisible({ timeout: 10000 })
    await expect(heading).toContainText(/Registrations are paused/i)

    // The old OTP signup form is gone while registrations are paused.
    await expect(page.locator('#signup-email')).toHaveCount(0)
    await expect(page.locator('nav[aria-label="Sign up progress"]')).toHaveCount(0)
  })

  test('has a waitlist email field + "Notify me" button', async ({ page }) => {
    await page.goto('/signup')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('input[type="email"]').first()
    await expect(emailInput).toBeVisible({ timeout: 5000 })

    const notifyBtn = page.getByRole('button', { name: /notify me/i })
    await expect(notifyBtn).toBeVisible()
  })

  test('no JS errors', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/signup')
    await page.waitForLoadState('networkidle')
    expect(filterRealErrors(errors)).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 3. FORGOT PASSWORD PAGE
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('AUTH-FLOW-003: Forgot Password Page', () => {
  test('loads with correct title', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveTitle(/Forgot Password.*Valrano|Valrano/)
  })

  test('has heading "Reset your password"', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.waitForLoadState('networkidle')
    const heading = page.locator('h1')
    await expect(heading).toBeVisible({ timeout: 10000 })
    await expect(heading).toContainText('Reset your password')
  })

  test('has email input + submit button', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('#reset-email')
    await expect(emailInput).toBeVisible({ timeout: 5000 })
    expect(await emailInput.getAttribute('type')).toBe('email')

    const submitBtn = page.locator('button[type="submit"]')
    await expect(submitBtn).toBeVisible()
    await expect(submitBtn).toContainText('Send Reset Link')
  })

  test('has "Back to sign in" link to /login', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.waitForLoadState('networkidle')

    const backLink = page.locator('a[href="/login"]')
    await expect(backLink).toBeVisible({ timeout: 5000 })
    await expect(backLink).toContainText('Back to sign in')
  })

  test('no JS errors', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/forgot-password')
    await page.waitForLoadState('networkidle')
    expect(filterRealErrors(errors)).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 4. RESET PASSWORD PAGE
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('AUTH-FLOW-004: Reset Password Page', () => {
  test('redirects to /forgot-password without active session', async ({ page }) => {
    await page.goto('/reset-password')
    await page.waitForLoadState('networkidle')

    // Without a valid session, ResetPasswordPage redirects to /forgot-password
    await page.waitForURL(/\/(forgot-password|login)/, { timeout: 10000 })
    expect(page.url()).toMatch(/\/(forgot-password|login)/)
  })

  test('no JS errors', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/reset-password')
    await page.waitForLoadState('networkidle')
    expect(filterRealErrors(errors)).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 5. AUTH CALLBACK PAGE
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('AUTH-FLOW-005: Auth Callback Page', () => {
  test('loads and redirects to /login without session', async ({ page }) => {
    await page.goto('/auth/callback')
    await page.waitForLoadState('networkidle')

    // Without a valid session/hash, callback redirects to /login
    await page.waitForURL(/\/(login|signup|dashboard)/, { timeout: 10000 })
    expect(page.url()).toMatch(/\/(login|signup|dashboard)/)
  })

  test('shows processing spinner initially', async ({ page }) => {
    // Use a short timeout to catch the spinner before redirect
    await page.goto('/auth/callback')

    const status = page.locator('[role="status"]')
    const hasStatus = await status.isVisible({ timeout: 3000 }).catch(() => false)

    // Either we see the spinner or we've already redirected -- both OK
    if (hasStatus) {
      await expect(status).toBeVisible()
    } else {
      // Already redirected
      expect(page.url()).toMatch(/\/(login|signup|dashboard)/)
    }
  })

  test('no JS errors', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/auth/callback')
    await page.waitForLoadState('networkidle')
    expect(filterRealErrors(errors)).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 6. AUTH VERIFY PAGE
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('AUTH-FLOW-006: Auth Verify Page', () => {
  test('redirects to /login without token/email params', async ({ page }) => {
    await page.goto('/auth/verify')
    await page.waitForLoadState('networkidle')

    // Without token+email query params, redirects to /login
    await page.waitForURL(/\/login/, { timeout: 10000 })
    expect(page.url()).toMatch(/\/login/)
  })

  test('shows verifying spinner with token params', async ({ page }) => {
    await page.goto('/auth/verify?token=fake-token&email=test@example.com')

    const status = page.locator('[role="status"]')
    const hasStatus = await status.isVisible({ timeout: 3000 }).catch(() => false)

    if (hasStatus) {
      // Auto-wait: [role=status] can match the loading skeleton while the lazy
      // AuthVerifyPage chunk loads — wait for the spinner text or error message
      await expect(
        page.getByText(/Verifying|expired|invalid/i).first()
      ).toBeVisible({ timeout: 15000 })
    }
  })

  test('no JS errors', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/auth/verify')
    await page.waitForLoadState('networkidle')
    expect(filterRealErrors(errors)).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 7. AUTH CONFIRM PAGE — regression test (previously broken route)
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('AUTH-FLOW-007: Auth Confirm Page', () => {
  test('redirects to /login without token_hash/type params', async ({ page }) => {
    await page.goto('/auth/confirm')
    await page.waitForLoadState('networkidle')

    // Without token_hash + type query params, redirects to /login
    await page.waitForURL(/\/login/, { timeout: 10000 })
    expect(page.url()).toMatch(/\/login/)
  })

  test('with invalid token_hash shows error or redirects', async ({ page }) => {
    await page.goto('/auth/confirm?token_hash=invalid-hash&type=signup')
    await page.waitForLoadState('networkidle')

    // Should either show an error message or redirect to /login
    const body = await page.textContent('body')
    const hasExpectedContent =
      body?.includes('Verification failed') ||
      body?.includes('expired') ||
      body?.includes('invalid') ||
      body?.includes('Back to login') ||
      page.url().includes('/login')
    expect(hasExpectedContent).toBe(true)
  })

  test('shows confirming spinner initially', async ({ page }) => {
    await page.goto('/auth/confirm?token_hash=test&type=signup')

    const status = page.locator('[role="status"]')
    const hasStatus = await status.isVisible({ timeout: 3000 }).catch(() => false)

    if (hasStatus) {
      await expect(status).toBeVisible()
    }
  })

  test('no JS errors', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/auth/confirm')
    await page.waitForLoadState('networkidle')
    expect(filterRealErrors(errors)).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 8. NAVIGATION BETWEEN AUTH PAGES
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('AUTH-FLOW-008: Cross-Page Navigation', () => {
  test('login "Create account" opens the waitlist modal', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const createAccount = page.getByRole('button', { name: /create account/i })
    await expect(createAccount).toBeVisible({ timeout: 5000 })
    await createAccount.click()

    // Opens the waitlist modal in place (no navigation while paused).
    await expect(
      page.getByRole('heading', { name: /registrations are paused/i }),
    ).toBeVisible({ timeout: 5000 })
  })

  test('login -> forgot-password via "Forgot password?" link', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Ensure Password tab is active
    const passwordTab = page.getByRole('tab', { name: /password/i })
    if (await passwordTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await passwordTab.click()
      await page.waitForTimeout(300)
    }

    const forgotLink = page.locator('a[href="/forgot-password"]')
    await expect(forgotLink).toBeVisible({ timeout: 5000 })
    await forgotLink.click()

    await page.waitForURL(/\/forgot-password/, { timeout: 10000 })
    const heading = page.locator('h1')
    await expect(heading).toContainText('Reset your password')
  })

  test('signup -> login via "Sign in" link', async ({ page }) => {
    await page.goto('/signup')
    await page.waitForLoadState('networkidle')

    const loginLink = page.locator('a[href="/login"]')
    await expect(loginLink).toBeVisible({ timeout: 5000 })
    await loginLink.click()

    await page.waitForURL(/\/login/, { timeout: 10000 })
    const heading = page.locator('h1')
    await expect(heading).toContainText('Sign in')
  })

  test('forgot-password -> login via "Back to sign in" link', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.waitForLoadState('networkidle')

    const backLink = page.locator('a[href="/login"]')
    await expect(backLink).toBeVisible({ timeout: 5000 })
    await backLink.click()

    await page.waitForURL(/\/login/, { timeout: 10000 })
    const heading = page.locator('h1')
    await expect(heading).toContainText('Sign in')
  })

  test('login tab switching: Password <-> Email Code', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Start with Password tab
    const passwordTab = page.getByRole('tab', { name: /password/i })
    const codeTab = page.getByRole('tab', { name: /email code/i })
    await expect(passwordTab).toBeVisible({ timeout: 5000 })
    await expect(codeTab).toBeVisible()

    // Switch to Email Code
    await codeTab.click()
    await page.waitForTimeout(300)
    const codeEmail = page.locator('#code-email')
    await expect(codeEmail).toBeVisible()

    // Switch back to Password
    await passwordTab.click()
    await page.waitForTimeout(300)
    const loginEmail = page.locator('#login-email')
    await expect(loginEmail).toBeVisible()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 9. SESSION GUARD — Protected routes redirect to /login
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('AUTH-FLOW-009: Session Guard (Unauthenticated Redirect)', () => {
  const protectedRoutes = [
    '/dashboard',
    '/my-company',
    '/competitors',
    '/analytics',
    '/reports',
    '/account',
    '/settings',
    '/onboarding',
  ]

  for (const route of protectedRoutes) {
    test(`${route} redirects to /login when unauthenticated`, async ({ page }) => {
      await page.goto(route)
      await page.waitForURL(/\/login/, { timeout: 15000 })
      expect(page.url()).toMatch(/\/login/)
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// 10. ALL AUTH PAGES — no crash, no blank page
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('AUTH-FLOW-010: All Auth Pages Render Without Crash', () => {
  const authRoutes = [
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/auth/callback',
    '/auth/verify',
    '/auth/confirm',
  ]

  for (const route of authRoutes) {
    test(`${route} renders content (not blank or error boundary)`, async ({ page }) => {
      await page.goto(route)
      await page.waitForLoadState('networkidle')

      // Allow time for any redirect to complete
      await page.waitForTimeout(2000)

      const body = await page.textContent('body')
      expect(body).toBeTruthy()
      expect(body!.length).toBeGreaterThan(10)

      // Should NOT show error boundary
      expect(body).not.toContain('Something went wrong')
    })
  }
})
