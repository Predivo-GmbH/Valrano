#!/usr/bin/env node
/**
 * fill-staging-demo — give the staging TEST user real content, through Valrano's own screens, so the
 * product screens on predivo.ch show real numbers (Roger, 2026-09-24: "Real reports").
 *
 * Own company: Geberit (its 2025 annual report, onboarding step 1). Peers: Sika and Belimo, each with its
 * 2025 annual report uploaded and extracted. Then one custom report is generated for the reports list.
 * All three are public reports of Swiss listed companies; nothing is typed in by hand.
 *
 * COST GUARD: the first extraction's token usage is read from Valrano's own response and priced; if the
 * one report costs more than CHF 3 the script stops before the peers. IDEMPOTENT: a step that is already
 * done is skipped, so a rerun never pays for the same extraction twice.
 * Writes debug screenshots of each step to fill-debug/ (no sign-in page is ever photographed).
 */
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.env.STAGING_URL || 'https://staging.valrano.com'
const STATE = 'playwright/.auth/staging-user.json'
const PDF = { own: 'pdfs/geberit-2025.pdf', peers: [['Sika', 'pdfs/sika-2025.pdf'], ['Belimo', 'pdfs/belimo-2025.pdf']] }
/* Gemini 2.5 Pro list prices per million tokens (input <=200k / >200k, output) - UNVERIFIED against the
   bill; used only to decide whether to continue. USD ~ CHF at this precision. */
const PRICE = (inTok, outTok) => (inTok > 200000 ? 2.5 : 1.25) * inTok / 1e6 + (inTok > 200000 ? 15 : 10) * outTok / 1e6
const LIMIT_CHF = 3
mkdirSync('fill-debug', { recursive: true })
const log = []
const note = (s) => { log.push(s); console.log(s) }

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 }, storageState: STATE,
  httpCredentials: { username: process.env.STAGING_HTTP_USER || 'staging', password: process.env.STAGING_HTTP_PASS || '' },
})
const page = await ctx.newPage()
page.on('dialog', d => d.accept())   // the duplicate-upload confirm
let shot = 0
const snap = async (name) => { if (!/\/login/.test(page.url())) await page.screenshot({ path: `fill-debug/${String(++shot).padStart(2, '0')}-${name}.png` }) }
const usage = []
page.on('response', async r => {
  if (!/functions\/v1\/(analyze-accounting-profile|extract-kpis)/.test(r.url())) return
  try { const j = await r.json(); const u = j.usage || j.usageMetadata; if (u) usage.push({ fn: r.url().split('/').pop(), u }) } catch {}
})
/* the pop-up messages Valrano shows (sonner toasts) - the only place its errors appear */
const toasts = async () => (await page.locator('[data-sonner-toast], [role="status"], [role="alert"]').allInnerTexts()).map(t => t.replace(/s+/g, ' ').trim()).filter(Boolean).join(' | ')
const go = async (p) => { await page.goto(BASE + p, { waitUntil: 'load', timeout: 60000 }); await page.waitForTimeout(3000) }

try {
  /* ---- 1. own company: onboarding step 1 with Geberit's report ---- */
  await go('/my-company?tab=profile')
  /* wait until the page has decided: the empty state, or the company's own Upload Report button */
  await page.getByText(/No company configured/i).or(page.getByRole('button', { name: /Upload Report/i })).first().waitFor({ timeout: 45000 })
  await snap('my-company')
  const hasCompany = !(await page.getByText(/No company configured/i).count())
  if (hasCompany) note('own company: already set up - skipped')
  else {
    await go('/onboarding')
    await snap('onboarding')
    /* as a person does it: click the drop zone, pick the file in the chooser (setting the hidden input
       directly left the drop zone untouched on the first run, 2026-09-24) */
    const zone = page.getByRole('button', { name: /Upload PDF file/i }).or(page.getByText(/Drop your latest annual report/i)).first()
    await zone.waitFor({ timeout: 30000 })
    const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 15000 }), zone.click()])
    await chooser.setFiles(PDF.own)
    await page.waitForTimeout(8000)
    await snap('onboarding-uploading')
    note('own company: messages after upload: ' + (await toasts() || 'none'))
    if (await page.getByText(/Drop your latest annual report/i).count()) { note('own company: the drop zone did not take the file'); throw new Error('upload did not start') }
    note('own company: Geberit report uploaded, waiting for the analysis')
    await page.getByText(/Report analyzed/i).first().waitFor({ timeout: 12 * 60000 })
    await snap('onboarding-analyzed')
    const u = usage.map(x => x.u)
    const inTok = u.reduce((a, x) => a + (x.input_tokens || x.promptTokenCount || 0), 0)
    const outTok = u.reduce((a, x) => a + (x.output_tokens || x.candidatesTokenCount || 0), 0)
    const cost = PRICE(inTok, outTok)
    note(`own company: analysed. usage seen: ${usage.length} response(s), ${inTok} input / ${outTok} output tokens => about CHF ${cost.toFixed(2)} (list price, unverified)`)
    if (usage.length && cost > LIMIT_CHF) { note(`STOP: one report cost more than CHF ${LIMIT_CHF}`); throw new Error('cost guard') }
    /* step 2: peers by search, then leave the wizard */
    await page.getByRole('button', { name: /^Continue$/ }).click()
    await page.waitForTimeout(2500); await snap('onboarding-step2')
    for (const [name] of PDF.peers) {
      const box = page.getByPlaceholder(/Type a company name to search/i)
      await box.fill(name); await page.waitForTimeout(3500)
      const opt = page.locator('[role="option"], li, button').filter({ hasText: new RegExp(name, 'i') }).first()
      if (await opt.count()) { await opt.click(); note(`peer ${name}: picked from search`) } else note(`peer ${name}: not found in the wizard search`)
      await page.waitForTimeout(1500)
    }
    await snap('onboarding-peers')
    for (let i = 0; i < 4; i++) {
      const fin = page.getByRole('button', { name: /Finish Setup|Skip this step|^Continue$/ }).last()
      if (!(await fin.count())) break
      await fin.click(); await page.waitForTimeout(2500)
      if (/\/dashboard/.test(page.url())) break
    }
    await snap('after-onboarding')
  }

  /* ---- 2. peers: make sure both exist, then upload and extract each report ---- */
  await go('/competitors'); await snap('competitors')
  for (const [name, file] of PDF.peers) {
    let link = page.locator('a[href*="/companies/"]').filter({ hasText: new RegExp(name, 'i') }).first()
    if (!(await link.count())) {
      await page.getByRole('button', { name: /Add Peer/i }).first().click()
      const input = page.getByPlaceholder(/Start typing to search/i)
      await input.fill(name); await page.waitForTimeout(3500)
      const opt = page.locator('ul[role="listbox"] li[role="option"]').filter({ hasText: new RegExp(name, 'i') }).first()
      if (await opt.count()) await opt.dispatchEvent('mousedown')
      await page.waitForTimeout(4000)
      await snap(`add-peer-${name}-form`)
      await page.getByRole('button', { name: /^Add Company$/ }).click()
      await page.waitForTimeout(6000); await snap(`add-peer-${name}-after`)
      note(`peer ${name}: "Add Company" pressed - messages: ` + (await toasts() || 'none'))
      await go('/competitors')
      link = page.locator('a[href*="/companies/"]').filter({ hasText: new RegExp(name, 'i') }).first()
    }
    const href = await link.getAttribute('href')
    const id = href && href.split('/companies/')[1]
    if (!id) { note(`peer ${name}: no company id found - skipped`); continue }
    await go(`/companies/${id}`)
    if (await page.getByText(/FY ?2025|2025/).count() && await page.getByText(/Revenue|Umsatz|EBITDA/i).count()) { note(`peer ${name}: already has 2025 figures - skipped`); continue }
    await go(`/competitors?tab=upload&company=${id}`)
    const dlg = page.locator('[role="dialog"]').first()
    await dlg.waitFor({ timeout: 20000 })
    await dlg.locator('input[type="file"]').setInputFiles(file)
    await dlg.getByRole('button', { name: /Upload & Extract/i }).click()
    note(`peer ${name}: report uploaded, extracting`)
    await dlg.getByText(/reports? processed/i).first().waitFor({ timeout: 12 * 60000 })
    await snap(`peer-${name}-extracted`)
    note(`peer ${name}: ${((await dlg.innerText()).match(/\d+ KPIs[^\n]*/) || ['extracted'])[0]}`)
    const done = dlg.getByRole('button', { name: /^Done$/ })
    if (await done.count()) await done.click()
    await page.waitForTimeout(1500)
  }

  /* ---- 3. one generated report, so the reports list shows a result ---- */
  await go('/reports')
  if (await page.getByText(/No reports yet/i).count()) {
    await page.getByRole('button', { name: /Create Custom Report/i }).first().click()
    await page.waitForTimeout(1500)
    const title = page.locator('[role="dialog"] input').first()
    await title.fill('Geberit vs. peers - FY 2025')
    await snap('custom-report-form')
    await page.getByRole('button', { name: /^Generate/i }).last().click()
    await page.waitForTimeout(20000)
    await snap('custom-report-generated')
    note('reports: custom report generated')
  } else note('reports: already has reports - skipped')
  await go('/dashboard'); await snap('dashboard-after')
} catch (e) {
  note('FAILED: ' + String(e.message || e).split('\n')[0])
  await snap('failure')
  process.exitCode = 1
} finally {
  writeFileSync('fill-debug/fill-log.txt', log.join('\n') + '\n')
  await browser.close()
}
