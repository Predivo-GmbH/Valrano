#!/usr/bin/env node
/**
 * capture-product-screens — Valrano's real screens for its page on predivo.ch.
 *
 * Roger, 2026-09-24 (plan PLAN-redesign-step10-four-changes, part 4, option A): the product page shows the
 * product's own interface, captured from the product with a browser - never drawn or generated. Valrano's
 * core view and results exist only behind sign-in, so this runs INSIDE GitHub Actions on the TEST copy
 * (staging) as the test user the staging checks already use: the password never leaves GitHub, and no
 * customer's data can reach the public site. Any e-mail address on screen is blanked before the capture.
 *
 * Reads the signed-in state written by the staging auth setup (playwright/.auth/staging-user.json).
 * Writes PNGs to screens/ at 1440x900 and 390x844; nothing else is kept.
 */
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.env.STAGING_URL || 'https://staging.valrano.com'
const STATE = 'playwright/.auth/staging-user.json'
const ROUTES = ['/dashboard', '/competitors', '/my-company/benchmark', '/analytics', '/trends', '/reports']
const SIZES = [{ name: 'laptop', viewport: { width: 1440, height: 900 } }, { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]
mkdirSync('screens', { recursive: true })

/* blank every e-mail address and anything in an input, so no account detail is photographed */
async function scrub(page) {
  await page.evaluate(() => {
    const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = w.nextNode(); n; n = w.nextNode()) if (EMAIL.test(n.textContent)) n.textContent = n.textContent.replace(EMAIL, '••••••')
    document.querySelectorAll('input').forEach(i => { i.value = '' })
  })
}

const browser = await chromium.launch()
const log = []
for (const s of SIZES) {
  const ctx = await browser.newContext({
    viewport: s.viewport, isMobile: !!s.isMobile, hasTouch: !!s.hasTouch, deviceScaleFactor: 2, storageState: STATE,
    httpCredentials: { username: process.env.STAGING_HTTP_USER || 'staging', password: process.env.STAGING_HTTP_PASS || '' },
  })
  const page = await ctx.newPage()
  const routes = [...ROUTES]
  for (let i = 0; i < routes.length; i++) {
    const r = routes[i]
    try {
      await page.goto(BASE + r, { waitUntil: 'networkidle', timeout: 45000 })
    } catch { await page.waitForTimeout(3000) }
    await page.waitForTimeout(2500)
    if (/\/login/.test(page.url())) { log.push(`${s.name} ${r}: redirected to sign-in - not captured`); continue }
    await scrub(page)
    const file = `screens/valrano-${s.name}${r.replace(/[/:?=]+/g, '-')}.png`
    await page.screenshot({ path: file })
    log.push(`${s.name} ${r}: ${file}`)
    /* the first report behind the list is the "result" screen */
    if (r === '/reports' && s.name === 'laptop') {
      const href = await page.evaluate(() => { const a = [...document.querySelectorAll('a[href*="/reports/"]')][0]; return a ? new URL(a.href).pathname : null })
      if (href) { routes.push(href); ROUTES.push(href) }
    }
  }
  await ctx.close()
}
await browser.close()
writeFileSync('screens/capture-log.txt', log.join('\n') + '\n')
console.log(log.join('\n'))
