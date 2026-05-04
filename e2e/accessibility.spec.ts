import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const publicRoutes = ['/']

for (const route of publicRoutes) {
  test(`a11y: ${route}`, async ({ page }) => {
    await page.goto(route)
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()

    expect(results.violations).toEqual([])
  })
}
