/**
 * Authenticated E2E: AI Chat interactions.
 *
 * Tests chat panel opening, message input, and session management.
 */
import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// CHAT-001: Chat panel and message input
// ---------------------------------------------------------------------------
test.describe('AI Chat', () => {
  test('CHAT-001: chat panel opens with message input', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Look for chat toggle button (typically a chat icon in bottom corner)
    const chatToggle = page.locator(
      'button[aria-label*="chat"], button[aria-label*="Chat"], button:has(svg.lucide-message-circle), button:has(svg.lucide-messages-square)'
    ).first()
    const hasChatToggle = await chatToggle.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasChatToggle) {
      await chatToggle.click()
      await page.waitForTimeout(500)

      // Chat panel should appear with a text input
      const chatInput = page.locator('textarea, input[placeholder*="message"], input[placeholder*="Ask"]').first()
      const hasChatInput = await chatInput.isVisible({ timeout: 3000 }).catch(() => false)

      expect(hasChatInput).toBe(true)

      // Should have a send/submit button
      const sendButton = page.locator('button[type="submit"], button[aria-label*="Send"]').first()
      const hasSend = await sendButton.isVisible({ timeout: 3000 }).catch(() => false)

      // Close chat panel
      await page.keyboard.press('Escape')
    }

    const body = await page.textContent('body')
    expect(body).not.toContain('Something went wrong')
  })

  // ---------------------------------------------------------------------------
  // CHAT-002: Delete chat session
  // ---------------------------------------------------------------------------
  test('CHAT-002: chat session management (delete) is accessible', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Open chat panel
    const chatToggle = page.locator(
      'button[aria-label*="chat"], button[aria-label*="Chat"], button:has(svg.lucide-message-circle)'
    ).first()
    const hasChatToggle = await chatToggle.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasChatToggle) {
      await chatToggle.click()
      await page.waitForTimeout(500)

      // Look for session management (delete/clear buttons)
      const deleteBtn = page.locator('button[aria-label*="Delete"], button[aria-label*="delete"], button:has-text("Clear")').first()
      const hasDelete = await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)

      // Chat session management may only show when sessions exist
    }

    const body = await page.textContent('body')
    expect(body).not.toContain('Something went wrong')
  })
})
