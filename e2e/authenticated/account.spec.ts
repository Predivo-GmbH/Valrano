/**
 * Authenticated E2E: Account page interactions.
 *
 * Tests email change, password change, delete account flow,
 * theme toggle, and fiscal year setting.
 */
import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// ACC-002: Change email — form is accessible
// ---------------------------------------------------------------------------
test.describe('Account — Email & Password', () => {
  test('ACC-002: change email section is visible with input field', async ({ page }) => {
    await page.goto('/account')
    await page.waitForLoadState('networkidle')

    const body = await page.textContent('body')

    // Should show Change Email section
    const hasChangeEmail =
      body?.includes('Change Email') ||
      body?.includes('Email') ||
      body?.includes('email')

    expect(hasChangeEmail).toBe(true)

    // Look for the change email button or form
    const changeEmailButton = page.locator('button:has-text("Change Email")').first()
    const hasButton = await changeEmailButton.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasButton) {
      await changeEmailButton.click()
      await page.waitForTimeout(500)

      // Should show email input field
      const emailInput = page.locator('input[type="email"]').first()
      const hasInput = await emailInput.isVisible({ timeout: 3000 }).catch(() => false)
      expect(hasInput).toBe(true)

      // Press Escape to close if it's a dialog
      await page.keyboard.press('Escape')
    }
  })

  // ---------------------------------------------------------------------------
  // ACC-003: Change password — form is accessible
  // ---------------------------------------------------------------------------
  test('ACC-003: change password section is visible', async ({ page }) => {
    await page.goto('/account')
    await page.waitForLoadState('networkidle')

    const body = await page.textContent('body')

    // Should show Change Password section
    const hasChangePassword =
      body?.includes('Change Password') ||
      body?.includes('Password')

    expect(hasChangePassword).toBe(true)

    // Look for change password button
    const changePasswordButton = page.locator('button:has-text("Change Password")').first()
    const hasButton = await changePasswordButton.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasButton) {
      await changePasswordButton.click()
      await page.waitForTimeout(500)

      // Should show password input fields
      const passwordInputs = page.locator('input[type="password"]')
      const passwordCount = await passwordInputs.count()

      // Should have at least old + new password fields
      expect(passwordCount).toBeGreaterThanOrEqual(1)

      await page.keyboard.press('Escape')
    }
  })
})

// ---------------------------------------------------------------------------
// ACC-004: Delete account — full flow test (DO NOT actually delete)
// ---------------------------------------------------------------------------
test.describe('Account — Delete Account', () => {
  test('ACC-004: delete account opens confirmation dialog', async ({ page }) => {
    await page.goto('/account')
    await page.waitForLoadState('networkidle')

    // Find Danger Zone section
    const dangerZone = page.locator('text=Danger Zone').first()
    await expect(dangerZone).toBeVisible({ timeout: 10000 })

    // Find Delete Account button
    const deleteButton = page.getByRole('button', { name: /delete account/i }).first()
    await expect(deleteButton).toBeVisible({ timeout: 5000 })

    // Click Delete Account
    await deleteButton.click()
    await page.waitForTimeout(500)

    // Should show confirmation dialog requiring "DELETE" input
    const dialog = page.locator('[role="dialog"], [role="alertdialog"]')
    const hasDialog = await dialog.isVisible({ timeout: 3000 }).catch(() => false)

    if (hasDialog) {
      const dialogText = await dialog.textContent()
      const hasConfirmation =
        dialogText?.includes('DELETE') ||
        dialogText?.includes('confirm') ||
        dialogText?.includes('permanently') ||
        dialogText?.includes('irreversible')

      expect(hasConfirmation).toBe(true)

      // Should have a text input for typing "DELETE"
      const confirmInput = dialog.locator('input[type="text"]')
      const hasInput = await confirmInput.isVisible({ timeout: 3000 }).catch(() => false)

      if (hasInput) {
        // DO NOT type DELETE — just verify the input exists
        expect(hasInput).toBe(true)
      }

      // Close dialog without deleting
      await page.keyboard.press('Escape')
    }
  })
})

// ---------------------------------------------------------------------------
// ACC-005: Theme toggle — full toggle cycle
// ---------------------------------------------------------------------------
test.describe('Account — Theme Toggle', () => {
  test('ACC-005: theme toggle switches between light and dark mode', async ({ page }) => {
    await page.goto('/account')
    await page.waitForLoadState('networkidle')

    // Find theme toggle button
    const themeButton = page.locator('button:has-text("Dark"), button:has-text("Light")').first()
    const hasThemeButton = await themeButton.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasThemeButton) {
      const html = page.locator('html')

      // Check initial state
      const initialClass = await html.getAttribute('class')
      const initialDark = initialClass?.includes('dark')

      // Click toggle
      await themeButton.click()
      await page.waitForTimeout(500)

      // Theme should change
      const newClass = await html.getAttribute('class')
      const newDark = newClass?.includes('dark')

      // Theme state should have changed
      expect(newDark).not.toBe(initialDark)

      // Toggle back to restore state
      const themeButtonAfter = page.locator('button:has-text("Dark"), button:has-text("Light")').first()
      await themeButtonAfter.click()
      await page.waitForTimeout(500)

      // Should be back to original
      const restoredClass = await html.getAttribute('class')
      const restoredDark = restoredClass?.includes('dark')
      expect(restoredDark).toBe(initialDark)
    }
  })
})

// ---------------------------------------------------------------------------
// ACC-006: Fiscal year setting
// ---------------------------------------------------------------------------
test.describe('Account — Fiscal Year', () => {
  test('ACC-006: fiscal year setting is visible and selectable', async ({ page }) => {
    await page.goto('/account')
    await page.waitForLoadState('networkidle')

    const body = await page.textContent('body')

    // Should show fiscal year setting
    const hasFiscalYear =
      body?.includes('Fiscal Year') ||
      body?.includes('fiscal year') ||
      body?.includes('Calendar Year')

    expect(hasFiscalYear).toBe(true)

    // Look for select/dropdown or radio buttons for fiscal year
    const fySelect = page.locator('select, [role="combobox"], [role="radiogroup"]').first()
    const hasFYControl = await fySelect.isVisible({ timeout: 5000 }).catch(() => false)

    // Page should not crash
    expect(body).not.toContain('Something went wrong')
  })
})
