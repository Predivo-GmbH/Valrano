import { test, expect, type Page, type Locator } from '@playwright/test'

/**
 * v11 hardened audit gates — Valrano.
 * Drives the LIVE staging site (staging.valrano.com) as the authenticated e2e test
 * user (session injected by auth.setup.ts). Read-write against the STAGING Supabase
 * (vfwpcgdkrwqhdivfzmrg) via the Management API (superuser SQL — seeds/cleans rows and
 * bypasses the PostgREST 1000-cap). All secrets come from env:
 *   VAL_MGMT_TOKEN  = Supabase Management API token (DB seed + cleanup)
 *   STAGING_REF     = vfwpcgdkrwqhdivfzmrg (default)
 *   STAGING_URL / STAGING_HTTP_USER / STAGING_HTTP_PASS via config (Basic auth)
 *
 * Gate A   — constrained-viewport reachability (off-screen critical-control class):
 *            the Calendar "Create Event" dialog submit button at 4 viewports.
 * Gate B/J — mutation commit-boundary + zero-residue: creating a publication event
 *            writes NO row on dialog-open/abandon, exactly ONE on Save.
 * Gate I   — correctness under real data volume (>1000-row PostgREST cap): the company
 *            profile "Reports" count must reflect ALL reports, not silently cap at 1000.
 * Gate K   — fault-injected 500/empty data loads render gracefully (no white screen).
 * Gate M   — deployed-bundle identity — staging bundle talks to STAGING, never prod.
 *
 * A red run here IS the alert (same model as the fleet grant-drift/auth-email guards).
 * Valrano has no user-facing storage-object writes in these flows, so no service-role
 * key is needed — every seed/cleanup is a Management API SQL statement.
 */

const REF = process.env.STAGING_REF ?? 'vfwpcgdkrwqhdivfzmrg'
const PROD_REF = 'mkdeftmubrkseyrrbzvp'
const MGMT = process.env.VAL_MGMT_TOKEN ?? ''
const TEST_EMAIL = process.env.STAGING_TEST_EMAIL ?? 'e2e-test@valrano-test.local'
const MARKER = 'ZZ_V11GATE_DELETE_ME'

// ---- Management API helper (superuser SQL; bypasses RLS + PostgREST 1000-cap) ----
async function sql<T = Record<string, unknown>>(query: string): Promise<T[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MGMT}`,
      'Content-Type': 'application/json',
      'User-Agent': 'curl/8.5.0',
    },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error(`mgmt query ${res.status}: ${await res.text()}`)
  return res.json()
}

// SQL-literal escape (marker/ids only — never user input).
const q = (s: string) => s.replace(/'/g, "''")

let USER_ID = ''

async function loadUserId(): Promise<string> {
  const rows = await sql<{ id: string }>(
    `select id from auth.users where email = '${q(TEST_EMAIL)}' limit 1;`,
  )
  if (!rows.length) throw new Error(`test user ${TEST_EMAIL} not found on staging`)
  return rows[0].id
}

// Remove every marker row this suite may have created (children first, then parents).
async function cleanupMarkers() {
  await sql(`delete from public.publication_events
              where company_id in (select id from public.companies where name like '${MARKER}%');`)
  await sql(`delete from public.reports
              where company_id in (select id from public.companies where name like '${MARKER}%');`)
  await sql(`delete from public.my_companies where name like '${MARKER}%';`)
  await sql(`delete from public.companies where name like '${MARKER}%';`)
}

// Create a marker company AND grant the test user visibility to it (a my_companies row
// puts its id into visible_company_ids(), so RLS-gated selects/events/reports surface it).
// ir_page_url is preset so the create-event dialog skips its AI "auto-discover" call.
async function ensureVisibleMarkerCompany(): Promise<string> {
  const rows = await sql<{ id: string }>(
    `with c as (
       insert into public.companies (name, ticker, is_active, ir_page_url, website_url)
       values ('${MARKER} Co', 'ZZV11', true, 'https://example.com/investors', 'https://example.com')
       returning id
     ), m as (
       insert into public.my_companies (user_id, name, company_id)
       select '${q(USER_ID)}', '${MARKER} MyCo', c.id from c
       returning company_id
     )
     select id from c;`,
  )
  return rows[0].id
}

const markerEventCount = async (companyId: string) =>
  Number(
    (await sql<{ n: number }>(
      `select count(*)::int as n from public.publication_events where company_id='${q(companyId)}';`,
    ))[0].n,
  )
// -------------------------- GATE A: viewport reachability --------------------------
const VIEWPORTS = [
  { name: '390x844 portrait', w: 390, h: 844 },
  { name: '375x360 kb-open', w: 375, h: 360 },
  { name: '812x375 landscape', w: 812, h: 375 },
  { name: '667x375 landscape', w: 667, h: 375 },
]

type Reach = {
  rectTop: number; rectBottom: number; vh: number
  inViewport: boolean; visible: boolean; hitOk: boolean; hitTag: string | null
}

async function measure(control: Locator): Promise<Reach> {
  return control.evaluate((el: Element) => {
    const r = el.getBoundingClientRect()
    const vh = window.visualViewport?.height ?? window.innerHeight
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    const hit = document.elementFromPoint(cx, cy)
    const he = el as HTMLElement
    return {
      rectTop: Math.round(r.top), rectBottom: Math.round(r.bottom), vh: Math.round(vh),
      inViewport: r.bottom <= vh + 0.5 && r.top >= -0.5 && r.left >= -0.5 && r.right <= window.innerWidth + 0.5,
      visible: he.offsetParent !== null && r.width > 0 && r.height > 0,
      hitOk: hit === el || el.contains(hit) || (!!hit && hit.contains(el)),
      hitTag: hit ? `${hit.tagName}.${(typeof hit.className === 'string' ? hit.className.split(' ')[0] : '')}` : null,
    }
  })
}

async function runReachGate(
  page: Page, label: string, open: () => Promise<void>, control: () => Locator,
) {
  const rows: string[] = []
  await page.setViewportSize({ width: 900, height: 900 })
  await open()
  await expect(control()).toBeVisible({ timeout: 15_000 })

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.w, height: vp.h })
    await page.waitForTimeout(250)
    let m = await measure(control())
    // "Reachable" = in-viewport AND visible AND its own center hit-tests to the control.
    // A scrollable modal (max-h + overflow-y-auto) can leave the submit in-viewport by rect
    // yet clipped by the dialog's own overflow boundary -> hit-test lands on the overlay.
    // Framework allowance: that's normal scrollable-modal UX, so scroll it into view and
    // RE-assert. A control that stays off-screen or covered by a FOREIGN overlay after the
    // allowed scroll still fails (the true off-screen/obstructed-Save defect class).
    let ok = m.inViewport && m.visible && m.hitOk
    let viaScroll = false
    if (!ok) {
      await control().scrollIntoViewIfNeeded().catch(() => {})
      await page.waitForTimeout(150)
      const m2 = await measure(control())
      if (m2.inViewport && m2.visible && m2.hitOk) { m = m2; ok = true; viaScroll = true }
    }
    expect.soft(m.inViewport && m.visible, `${label} @ ${vp.name}: control in viewport`).toBe(true)
    expect.soft(m.hitOk, `${label} @ ${vp.name}: hit-test == control (reachable, unobstructed)`).toBe(true)
    rows.push(
      `  ${label.padEnd(16)} | ${vp.name.padEnd(18)} | reachable=${ok}${viaScroll ? '(scroll)' : ''}`.padEnd(64) +
      ` | hitTest=${m.hitOk} | top=${m.rectTop} bottom=${m.rectBottom} vh=${m.vh} | hit=${m.hitTag}`,
    )
    if (vp.name === '375x360 kb-open') {
      await page.screenshot({ path: `test-results/gateA-${label}-375x360.png` })
    }
  }
  console.log(`\n[GATE A] ${label}\n${rows.join('\n')}`)
}

test.describe('Valrano v11 gates', () => {
  test.beforeAll(async () => { USER_ID = await loadUserId() })

  // Open the embedded Calendar's "Create Event" dialog and measure the submit-button
  // reachability — the exact off-screen-Save defect class — across constrained viewports.
  test('Gate A — Create Event dialog "Create Event" reachability', async ({ page }) => {
    await runReachGate(
      page,
      'CreateEvent',
      async () => {
        await page.goto('/competitors?tab=calendar')
        await page.waitForLoadState('networkidle')
        await page.getByRole('button', { name: 'Add Event' }).first().click()
        await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 })
      },
      () => page.getByRole('dialog').getByRole('button', { name: 'Create Event' }),
    )
  })

  // -------------------------- GATE B/J: commit-boundary + zero-residue --------------------------
  // Creating a publication event is the cheapest real DB write (no external API, no email
  // once a saved IR URL is present). Opening/abandoning the dialog must write NO row;
  // Save must write exactly one — the commit-boundary + zero-residue contract.
  test('Gate B/J — create-event commit-boundary + zero-residue', async ({ page }) => {
    test.setTimeout(120_000)
    expect(MGMT, 'VAL_MGMT_TOKEN required').not.toBe('')

    // Pre-clean stale marker rows a prior/cancelled run may have left (shared staging).
    await cleanupMarkers()
    const companyId = await ensureVisibleMarkerCompany()
    console.log(`[GATE B/J] marker company ${companyId}; baseline events=${await markerEventCount(companyId)}`)

    try {
      await page.setViewportSize({ width: 1000, height: 900 })
      await page.goto('/competitors?tab=calendar')
      await page.waitForLoadState('networkidle')

      // (1) Commit boundary: OPENING the dialog writes no publication_events row.
      await page.getByRole('button', { name: 'Add Event' }).first().click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10_000 })
      await page.waitForTimeout(800)
      const onOpen = await markerEventCount(companyId)
      console.log(`[GATE B/J] after dialog open (NO Save): events=${onOpen}`)
      expect(onOpen, 'opening the dialog writes NO publication_events row').toBe(0)

      // (2) ABANDON (Escape) leaves zero residue.
      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden({ timeout: 5_000 })
      const onAbandon = await markerEventCount(companyId)
      console.log(`[GATE B/J] after abandon: events=${onAbandon}`)
      expect(onAbandon, 'abandon leaves 0 publication_events rows').toBe(0)

      // (3) Reopen, fill (company + future date), Save -> exactly one row.
      await page.getByRole('button', { name: 'Add Event' }).first().click()
      await expect(dialog).toBeVisible({ timeout: 10_000 })
      await dialog.locator('#event-company').click()
      await page.getByRole('option', { name: new RegExp(MARKER) }).first().click()
      const yearNext = new Date().getFullYear() + 1
      await dialog.locator('#event-expected-date').fill(`${yearNext}-06-15`)
      await dialog.getByRole('button', { name: 'Create Event' }).click()
      await expect(dialog).toBeHidden({ timeout: 15_000 })

      let saved = 0
      for (let i = 0; i < 20; i++) {
        saved = await markerEventCount(companyId)
        if (saved >= 1) break
        await page.waitForTimeout(500)
      }
      console.log(`[GATE B/J] after Create Event: events=${saved}`)
      expect(saved, 'exactly one publication_events row after Save').toBe(1)
    } finally {
      // CLEANUP — always remove marker rows even on failure.
      await cleanupMarkers()
      const leftover = await sql<{ n: number }>(
        `select count(*)::int as n from public.companies where name like '${MARKER}%';`,
      )
      console.log(`[GATE B/J] CLEANUP: marker companies leftover=${leftover[0].n}`)
      expect(Number(leftover[0].n), 'all marker rows removed').toBe(0)
    }
  })

  // -------------------------- GATE I: correctness under REAL data volume --------------------------
  // usePublicationEvents did `.select('*, companies(*)')` with no `.range()` -> PostgREST
  // silently caps at 1000 rows, and the calendar's "Suggest All Times (N)" control renders
  // N = events.filter(no time).length over the WHOLE fetched array -> a wrong count past
  // 1000 events. Seed >1000 (all missing a time) and assert the app's DISPLAYED count
  // reflects ALL of them (rendered output, not summed network).
  test('Gate I — calendar counts ALL events past the 1000-cap', async ({ page }) => {
    test.setTimeout(120_000)
    expect(MGMT, 'VAL_MGMT_TOKEN required').not.toBe('')
    const SEED = 1001

    await cleanupMarkers()
    const companyId = await ensureVisibleMarkerCompany()

    // "Suggest All Times (N)" renders the app's own count (events missing a time). Reading
    // the rendered number is implementation-agnostic (passes whether usePublicationEvents
    // one-shots or paginates), unlike summing network responses which masks a per-request cap.
    const readCount = async (): Promise<number> => {
      await page.setViewportSize({ width: 1000, height: 900 })
      await page.goto('/competitors?tab=calendar')
      await page.waitForLoadState('networkidle')
      const btn = page.getByRole('button', { name: /Suggest All Times/ })
      // Absent when 0 events miss a time; renders once the query settles — poll for stable.
      let last = -1, stable = 0
      for (let i = 0; i < 30; i++) {
        let v = 0
        if (await btn.isVisible().catch(() => false)) {
          const m = (await btn.innerText().catch(() => '')).match(/\((\d+)\)/)
          v = m ? parseInt(m[1], 10) : 0
        }
        if (v === last) { if (++stable >= 3) return v } else { stable = 0; last = v }
        await page.waitForTimeout(300)
      }
      return last
    }

    try {
      const before = await readCount()
      // All seeded events missing a time (expected_time NULL) and scheduled, so each counts
      // toward missingTimeCount; scoped to the marker company (the only one this user sees).
      await sql(
        `insert into public.publication_events (company_id, report_type, fiscal_year, expected_date, status)
         select '${q(companyId)}', 'annual', 1000 + g, (now() + (g || ' days')::interval)::date, 'scheduled'
         from generate_series(1, ${SEED}) g;`,
      )
      const total = await markerEventCount(companyId)
      console.log(`[GATE I] seeded ${SEED} events (company total ${total}; PostgREST default cap = 1000)`)

      const after = await readCount()
      console.log(`[GATE I] displayed missing-time count: before=${before} after=${after} (expected ${before + SEED})`)
      expect(after - before, `app must count all ${SEED} new rows, not silently cap at 1000`).toBe(SEED)
    } finally {
      // Clean up so a failure never leaves 1001 seed rows on staging.
      await cleanupMarkers()
    }
  })

  // -------------------------- GATE K: fault-injected data loads --------------------------
  for (const mode of ['500', 'empty'] as const) {
    for (const route of ['/dashboard', '/competitors'] as const) {
      test(`Gate K — ${route} graceful under ${mode}`, async ({ page }) => {
        await page.route(/\/rest\/v1\/.*/, (r) =>
          mode === '500'
            ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"injected"}' })
            : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '*/0' }, body: '[]' }),
        )
        await page.route(/\/rest\/v1\/rpc\/.*/, (r) =>
          mode === '500'
            ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"injected"}' })
            : r.fulfill({ status: 200, contentType: 'application/json', body: 'null' }),
        )
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(e.message))
        await page.goto(route)
        await page.waitForTimeout(6000) // allow react-query retry + settle

        // Brand from the app shell renders even when every data call fails.
        const shellVisible = await page.getByText('Valrano').first().isVisible().catch(() => false)
        const bodyText = (await page.locator('body').innerText().catch(() => '')).trim()
        const whiteScreen = bodyText.length < 20
        const brokeBoundary = bodyText.includes('Something went wrong') || bodyText.includes('An unexpected error occurred')
        console.log(`[GATE K] ${route} ${mode}: shell=${shellVisible} bodyLen=${bodyText.length} boundary=${brokeBoundary} pageerrors=${errors.length}`)
        expect.soft(shellVisible, `${route} ${mode}: app shell renders (no white screen)`).toBe(true)
        expect.soft(whiteScreen, `${route} ${mode}: not a white screen`).toBe(false)
        expect.soft(brokeBoundary, `${route} ${mode}: no crash error boundary`).toBe(false)
        expect.soft(errors.length, `${route} ${mode}: no uncaught page errors`).toBe(0)
      })
    }
  }

  // -------------------------- GATE M: deployed-bundle identity & backend origin --------------------------
  // Proves the deployed STAGING site talks to the STAGING Supabase (never prod). This is both
  // a deploy-identity check and the guard that makes the write-gates above safe: if staging
  // were built with prod env, Gate B/I would be mutating the PRODUCTION database.
  test('Gate M — staging bundle talks to the STAGING backend, never prod', async ({ page }) => {
    const hosts = new Set<string>()
    page.on('request', (r) => {
      const u = r.url()
      if (u.includes('.supabase.co')) hosts.add(new URL(u).host)
    })
    await page.goto('/dashboard')
    // Wait for the app to actually mount before judging network.
    await expect(page.getByText('Valrano').first()).toBeVisible({ timeout: 15_000 })
    // The data fetch can land after networkidle on a slow CI runner — poll for it.
    for (let i = 0; i < 25 && hosts.size === 0; i++) await page.waitForTimeout(300)
    const hostList = [...hosts]
    console.log(`[GATE M] supabase hosts contacted: ${JSON.stringify(hostList)}`)
    expect(hostList.some((h) => h.startsWith(REF)), `staging app talks to STAGING (${REF})`).toBe(true)
    expect(hostList.some((h) => h.startsWith(PROD_REF)), 'staging app must NOT touch PROD supabase').toBe(false)
  })
})
