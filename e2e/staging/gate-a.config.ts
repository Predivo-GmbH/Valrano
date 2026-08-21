/**
 * Valrano's Gate A config. Everything here is product-specific; the machinery lives in
 * @predivo-gmbh/gate-kit/crawl and is shared by the whole fleet.
 *
 * AUTH MODEL: staging sits behind HTTP basic auth (playwright.gate-a-crawl.config.ts carries
 * the credentials) and the app behind a PasswordGate whose bypass is localStorage
 * `bs_unlocked` (same as e2e/staging/auth.setup.ts). Two identities:
 *   - `base`: the authenticated e2e test user, a Supabase session injected into localStorage.
 *     CI sets STAGING_TEST_PASSWORD (password grant, exactly as auth.setup.ts does); locally
 *     VAL_SVC_KEY mints a magiclink (admin/generate_link) and exchanges it (verify) instead -
 *     NON-DESTRUCTIVE, no password is ever set or changed. Sweeps every swept route except
 *     `/`, which RedirectIfAuthenticated makes unreachable for a logged-in user.
 *   - `anon`: no session at all. Exists because the public landing page carries two dialog
 *     surfaces (the demo-request modal and the waitlist modal) that no authenticated crawl
 *     can ever see. Sweeps only `/`.
 *
 * SAFETY - the denylist is EVIDENCE, not a guess. A reconnaissance pass that clicked NOTHING
 * enumerated every visible trigger on all seven authenticated routes at both discovery
 * widths: 245 trigger instances, 56 distinct accessible names. The one that matters most is
 * not destructive, it is EXPENSIVE: the embedded AI assistant's suggested-question chips each
 * SEND a message, and every send is a paid Anthropic call, so those are denied under
 * `purchase` (they cost money) and the manifest says why. Commit controls inside a
 * discovered dialog are MEASURED, NEVER CLICKED.
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import type { Page } from '@playwright/test'
import { routesFromReactRouter } from '@predivo-gmbh/gate-kit/conformance'
import { VISIBLE_DIALOG, type GateAConfig } from '@predivo-gmbh/gate-kit/crawl'

const STAGING_URL = process.env.STAGING_URL || 'https://staging.valrano.com'
const SUPA = process.env.STAGING_SUPABASE_URL || 'https://vfwpcgdkrwqhdivfzmrg.supabase.co'
const ANON = process.env.STAGING_SUPABASE_ANON_KEY || ''
const SVC = process.env.VAL_SVC_KEY || ''
const STORAGE_KEY = 'sb-vfwpcgdkrwqhdivfzmrg-auth-token'
const TEST_EMAIL = process.env.STAGING_TEST_EMAIL || 'e2e-test@valrano-test.local'
const TEST_PASSWORD = process.env.STAGING_TEST_PASSWORD || ''

const routeData = JSON.parse(
  fs.readFileSync(path.resolve('e2e/staging/gate-a-routes.json'), 'utf8'),
) as { swept: string[]; exclusions: { route: string; reason: string; expires?: string }[]; routerSources: string[] }

/** Derived from the app's own router, so a new route cannot be silently left uncrawled. */
export function declaredRoutes(): string[] {
  return [
    ...new Set(
      routeData.routerSources.flatMap((src) =>
        routesFromReactRouter(fs.readFileSync(path.resolve(src), 'utf8'), { ts }),
      ),
    ),
  ]
}

export const routeExclusions = routeData.exclusions

/**
 * Session for the staging test user, two ways, because the password is a CI-only secret:
 *  - CI sets STAGING_TEST_PASSWORD, so the password grant is used, exactly as
 *    e2e/staging/auth.setup.ts already does for every other staging suite.
 *  - Locally, VAL_SVC_KEY mints a magiclink (admin/generate_link) and exchanges it
 *    (verify). NON-DESTRUCTIVE: no password is ever set or changed.
 */
async function userSession(email: string) {
  if (TEST_PASSWORD) {
    const res = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON },
      body: JSON.stringify({ email, password: TEST_PASSWORD }),
    })
    if (!res.ok) throw new Error(`user auth failed for ${email} (${res.status}): ${await res.text()}`)
    return res.json()
  }
  if (!SVC) throw new Error('set STAGING_TEST_PASSWORD (CI) or VAL_SVC_KEY (local magiclink) - see docs/Credentials.txt')
  const gl = await fetch(`${SUPA}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email }),
  })
  if (!gl.ok) throw new Error(`generate_link failed (${gl.status}): ${await gl.text()}`)
  const { hashed_token } = await gl.json()
  const ver = await fetch(`${SUPA}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: SVC, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: hashed_token }),
  })
  if (!ver.ok) throw new Error(`verify failed (${ver.status}): ${await ver.text()}`)
  return ver.json()
}

async function establishSession(page: Page) {
  if (!ANON) throw new Error('STAGING_SUPABASE_ANON_KEY is required - see docs/Credentials.txt')
  const session = await userSession(TEST_EMAIL)
  // Dismiss onboarding, or every authenticated route redirects to /onboarding and the crawl
  // enumerates the wrong page. Idempotent; auth.setup.ts:35-44 does it per run too.
  await fetch(`${SUPA}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      apikey: ANON || SVC,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: { onboarding_dismissed: true } }),
  }).catch(() => {})

  await page.goto(STAGING_URL)
  await page.evaluate(
    ({ s, key }) => {
      localStorage.clear()
      localStorage.setItem('bs_unlocked', 'true') // PasswordGate bypass, same as auth.setup.ts
      localStorage.setItem(key, JSON.stringify(s))
    },
    { s: session, key: STORAGE_KEY },
  )
}

/**
 * No session, no cookies: the public landing page. `/` is wrapped in RedirectIfAuthenticated,
 * so only THIS identity can ever render it - and it carries two of the seven dialog-class
 * surfaces (the demo-request modal, and the waitlist modal behind every sign-up CTA).
 */
async function establishAnonymous(page: Page) {
  await page.goto(STAGING_URL)
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('bs_unlocked', 'true') // PasswordGate bypass; no auth token anywhere
  })
}

/**
 * Controls that only CLOSE what is on screen. Escape alone is not enough on this product:
 * the YouTube "Authorization Required" modal auto-opens on /settings and survives three
 * Escapes (verified 2026-08-20), and a modal left open eats every later click on the route.
 *
 * Deliberately excludes "Do this later", also on that modal: it persists a dismissal for the
 * account, so it would change state for every later run instead of just closing the dialog.
 */
const DISMISS = /^(close|cancel|dismiss|not now|schliessen|schließen|abbrechen|×|✕|x)$/i

async function dismiss(page: Page) {
  const dialog = page.locator(VISIBLE_DIALOG).first()
  const closer = dialog.getByRole('button', { name: DISMISS }).first()
  if ((await closer.count()) > 0) {
    await closer.click({ timeout: 2500 }).catch(() => {})
    await page.waitForTimeout(600)
  }
}

const config: GateAConfig = {
  baseURL: STAGING_URL,

  identities: [
    {
      key: 'base',
      label: 'authenticated e2e user, onboarding suppressed',
      setup: establishSession,
      // RedirectIfAuthenticated bounces a logged-in user off `/`, so the landing page is
      // swept by the anon identity instead; sweeping it here would crawl /dashboard twice.
      routes: routeData.swept.filter((r) => r !== '/'),
    },
    {
      key: 'anon',
      label: 'no session; the only identity that can render the public landing page',
      setup: establishAnonymous,
      routes: ['/'],
    },
  ],

  routes: routeData.swept,

  deny: {
    // Destructive, off-site, or state-changing. Evidence-based, see SAFETY above.
    destructive:
      /(sign\s?out|log\s?out|delete|remove|change password|change email|manage subscription|checkout|subscribe|upgrade|downgrade|connect|disconnect|import|export|download|publish|invite)/i,
    // Never clicked because it COSTS MONEY. Every one of these sends a message to the AI
    // assistant, which is a paid Anthropic call:
    //   - the four suggested-question chips, all of which end in "?"
    //   - the explicit "Send message" control
    // Report generation is here too: "New Report" / "Create Custom Report" / "Next Report"
    // kick off report builds rather than opening an inert form.
    purchase: /(\?\s*$|send message|new report|create custom report|next report)/i,
    // No allowOpeners override: no denied trigger needs to open a dialog on this product
    // yet. The day one does, every entry needs written file+line proof in
    // e2e/staging/gate-a-openers.md (see replyflow's).
  },

  /** Commit-control names, per the framework's Gate A locate rule. */
  commit:
    /^(save|submit|confirm|create|add|apply|update|continue|next|start|ok|done|select|choose|change)\b/i,

  dismiss,

  /**
   * A run without a satisfied control assertion is not a result. Each of these names a
   * surface KNOWN to exist, and each covers a different way this crawl has actually died.
   */
  controls: [
    {
      // Verified by hand 2026-08-20 with a route reset before the click: "Add Peer" on
      // /competitors opens an "Add Company" dialog. Proves the crawl has a real
      // authenticated session and can open a trigger-driven modal.
      name: 'Add Company dialog ("Add Peer" on /competitors) - proves auth + a trigger-driven modal',
      match: (s) => s.route === '/competitors' && /^add peer$/i.test(s.trigger),
    },
    {
      // Recon 2026-08-20: "Open menu" appears on all seven routes at 390px and on NONE at
      // 1280px, so if this control ever goes missing the mobile pass has silently stopped
      // running. That blind spot hid a real bug in ReplyFlow (drawer, "Sign out"
      // unreachable in landscape) - and the same defect in THIS app's drawer.
      name: 'a mobile-only surface was reached - proves discovery still runs at a MOBILE width',
      match: (s) => s.width === 'mobile',
    },
    {
      // The landing page renders only for the anonymous identity. If RedirectIfAuthenticated
      // ever lets a session through (or basic auth breaks), this surface vanishes and the
      // crawl of `/` has silently enumerated the wrong page.
      name: 'landing demo modal (data-gate-a=LandingPage) - proves the anon identity renders the public page',
      match: (s) => s.surfaceId === 'LandingPage',
    },
  ],
}

export default config
