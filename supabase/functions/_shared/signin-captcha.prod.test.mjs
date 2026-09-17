#!/usr/bin/env node
/**
 * signin-captcha.prod.test.mjs — production/staging regression guard for the sign-in
 * bot-protection fix on Valrano. Ported from ReplyFlow's
 * supabase/functions/_shared/signin-captcha.prod.test.mjs — diff them before changing either.
 *
 * THE VULNERABILITY (measured live 2026-09-14): Valrano production Supabase
 * (mkdeftmubrkseyrrbzvp) accepted a TOKENLESS, unauthenticated POST to /auth/v1/recover with
 * HTTP 200, and a tokenless POST to /auth/v1/otp reached the user-lookup (422 otp_disabled)
 * rather than being refused. security_captcha_enabled read false. So anyone on the internet who
 * knows a Valrano customer's email address could make Valrano email them a password-reset link
 * or a login code, unlimited, from the Postmark sending reputation the whole fleet shares.
 *
 * THE FIX has two halves that must land in this order:
 *   1. CLIENT: thread a Cloudflare Turnstile captchaToken through every captcha-protected auth
 *      endpoint (signInWithPassword, sendOtp, sendLoginOtp, resetPassword) and render the widget
 *      on login/signup/forgot-password. Proven by the unit suite
 *      src/test/auth-captcha-token.test.tsx. This is a NO-OP until half 2 — safe to deploy, and
 *      the widget itself does not even render until VITE_TURNSTILE_SITE_KEY is set (the fleet
 *      holds no Cloudflare API token for Valrano today, so no key exists yet).
 *   2. SERVER: enable CAPTCHA (Turnstile provider + secret) in the project's Auth settings. This
 *      is the switch that actually closes the hole. Enabling it is PROJECT-WIDE, so it is only
 *      safe once half 1 is live on every auth entry point. This is Roger's / a
 *      management-authorised session's call — not done by whoever ships the client half.
 *
 * WHY THIS TEST EXISTS AND NOT JUST THE DEPLOY: a green client deploy is NOT the fix — the
 * Auth-settings switch is. Only an unauthenticated probe against the LIVE GoTrue can tell whether
 * a tokenless request is actually refused. This guard is that probe. It is RED until half 2 is
 * flipped, and that is correct: it goes green the moment, and only the moment, the hole is truly
 * closed in production.
 *
 * WHY /otp AND NOT /recover, EVEN THOUGH /recover IS THE ENDPOINT MEASURED OPEN TODAY:
 * security_captcha_enabled is a single project-wide GoTrue flag that gates /token, /otp AND
 * /recover identically — there is no way to enable it for one and not the others. Probing /otp
 * (a direct port of the ReplyFlow guard's shape) proves the same flag /recover depends on,
 * without ever exercising the password-recovery flow itself.
 *
 * CREDENTIAL-FREE by design (like relay-auth.prod.test.mjs in this same repo): the anon/
 * publishable key it needs is PUBLIC — it ships in every visitor's browser. For prod it is
 * fetched from the live bundle at runtime; for staging (which this fleet does not expose the
 * same way) it is read from SUPABASE_STAGING_ANON_KEY when present (CI has it, matching
 * .env.example), or from the Supabase Management API as a fallback. A project whose key cannot
 * be obtained is SKIPPED LOUDLY — never a silent pass.
 *
 * STAGING IS DELIBERATELY LEFT OPEN, AND THAT IS ASSERTED, NOT ASSUMED. Enabling captcha is
 * project-wide, and e2e/staging/auth.setup.ts (staging's own Playwright auth setup) POSTs
 * straight to /auth/v1/token?grant_type=password with no captcha token — so switching staging on
 * would fail that setup and with it every authenticated staging spec, which gates production
 * promotions for the whole fleet. Until that sign-in is made captcha-proof (a service-role
 * admin/generate_link + /verify session, which GoTrue does not captcha-protect), staging stays
 * off ON PURPOSE. This guard therefore does not treat staging's open state as a failure — but it
 * DOES fail if staging starts ENFORCING captcha, because that means the fleet's staging gate is
 * about to go red and somebody should hear it from here first.
 *
 * The probe address uses the .local TLD (RFC 6762, guaranteed non-routable) and create_user:
 * false, so a still-open endpoint cannot actually mail a real person here.
 *
 * Run: node supabase/functions/_shared/signin-captcha.prod.test.mjs
 * Exit 0 = every ENFORCED project refuses a tokenless OTP request, and no un-enforced project has
 *          started enforcing behind our back.
 * Exit 1 = an enforced project still accepts a tokenless OTP request (the hole is NOT closed), or
 *          an un-enforced project turned itself on, or nothing could be probed at all.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const PROJECTS = [
  {
    name: 'production',
    ref: 'mkdeftmubrkseyrrbzvp',
    site: 'https://valrano.com',
    anonEnv: 'SUPABASE_ANON_KEY',
    enforced: true,
  },
  {
    name: 'staging',
    ref: 'vfwpcgdkrwqhdivfzmrg',
    site: null,
    anonEnv: 'SUPABASE_STAGING_ANON_KEY',
    enforced: false,
    whyNotEnforced:
      'e2e/staging/auth.setup.ts (staging\'s own Playwright auth setup) posts a tokenless password ' +
      'grant, so project-wide captcha here would fail that setup and every authenticated staging ' +
      'spec, blocking the whole fleet\'s promotions. Make that sign-in captcha-proof FIRST ' +
      '(admin/generate_link + /verify), then flip it and set enforced: true here.',
  },
]

const PROBE_EMAIL = 'signin-captcha-guard@valrano-test.local'

// Pull the public anon/publishable key out of a deployed frontend bundle — the same value every
// browser gets. Two formats: the newer `sb_publishable_...` key and the legacy anon JWT (role
// "anon").
function findKeyInSource(body) {
  const pub = body.match(/sb_publishable_[A-Za-z0-9_-]+/)
  if (pub) return pub[0]
  const jwts = body.match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []
  for (const jwt of jwts) {
    try {
      const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'))
      if (payload.role === 'anon') return jwt
    } catch { /* not a JWT we can decode — keep looking */ }
  }
  return null
}

async function anonKeyFromSite(siteUrl) {
  const html = await (await fetch(siteUrl, { redirect: 'follow' })).text()
  const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)].map((m) => new URL(m[1], siteUrl).href)
  const seen = new Set(scripts)
  for (const js of scripts) {
    const body = await (await fetch(js)).text()
    const key = findKeyInSource(body)
    if (key) return key
    // The key may live in a lazily-imported chunk; queue chunk names referenced from this script.
    for (const name of new Set(body.match(/[A-Za-z0-9_]+-[A-Za-z0-9]+\.js/g) || [])) {
      const url = new URL(`assets/${name}`, siteUrl).href
      if (!seen.has(url)) { seen.add(url); scripts.push(url) }
    }
  }
  return null
}

/**
 * A Supabase management token, from the environment in CI and from the gitignored credentials
 * file on a developer machine — the same shape this repo's other live guards use (see
 * scripts/the-recorded-*-mailbox-*.live.test.mjs). The value is never printed, never put on a
 * command line and never written anywhere; a missing file is simply "no token", so this stays
 * silent and harmless on a CI runner that has no such file.
 */
function managementToken() {
  const fromEnv = (process.env.SUPABASE_ACCESS_TOKEN || '').trim()
  if (fromEnv) return fromEnv
  try {
    const text = readFileSync(new URL('../../../docs/Credentials.txt', import.meta.url), 'utf-8')
    return (text.match(/sbp_[A-Za-z0-9_-]{20,}/) || [])[0] || ''
  } catch {
    return ''
  }
}

/**
 * The same PUBLIC publishable key, from the project itself rather than from the website. Used
 * only when the bundle scan cannot be reached (or for staging, which is not scanned by bundle).
 * `reveal=true` is required or the value comes back masked, and only the row whose type is
 * `publishable` is taken — a project can also carry a legacy `anon` JWT, and picking the wrong
 * one would turn a working guard into a confident "not a captcha refusal".
 */
async function anonKeyFromManagementApi(ref) {
  const token = managementToken()
  if (!token) return null
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Management API api-keys -> HTTP ${res.status}`)
  const rows = await res.json()
  const pub = (Array.isArray(rows) ? rows : []).find((r) => r.type === 'publishable')
  return pub?.api_key?.trim() || null
}

async function anonKeyFor(project) {
  const fromEnv = process.env[project.anonEnv]?.trim()
  if (fromEnv) return { key: fromEnv, source: `$${project.anonEnv}` }
  if (project.site) {
    try {
      const key = await anonKeyFromSite(project.site)
      if (key) return { key, source: project.site }
    } catch (err) {
      // The website being unreachable says nothing about GoTrue, which is what we are testing.
      console.error(`note - ${project.site} could not be read (${err.message}); trying the project itself.`)
    }
  }
  const key = await anonKeyFromManagementApi(project.ref)
  if (key) return { key, source: 'the Supabase Management API (publishable key)' }
  return null
}

// /recover IS THE SHARP ENDPOINT, NOT /otp — and reading /otp instead is what almost buried this.
// Measured live across the fleet 2026-09-15: a tokenless, unauthenticated POST /auth/v1/recover
// returns 200 and really does make the product email a password-reset link to any address a
// stranger names, 30/hour per project, on the Postmark sending reputation the whole fleet shares.
// /otp answers `422 otp_disabled "Signups not allowed for otp"`, which READS like a refusal and is
// the opposite of safe: it is GoTrue's USER-LOOKUP verdict, reached only AFTER the captcha
// middleware has already let the request through. So a 422 proves the gate is NOT there.
// `400` + a captcha error is the ONLY closed signal, and it is what this asserts.
//
// GoTrue carries the captcha token in gotrue_meta_security.captcha_token; we deliberately omit it.
// The probe address is reserved and undeliverable (.local TLD) — NEVER point this at a real
// mailbox. An open endpoint really does reach the mailer, which would make the test the attack.
async function tokenlessRecoverRefused(project, anon) {
  const res = await fetch(`https://${project.ref}.supabase.co/auth/v1/recover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anon, Authorization: `Bearer ${anon}` },
    body: JSON.stringify({ email: PROBE_EMAIL }),
  })
  const text = await res.text()
  // Closed state: GoTrue rejects for a captcha reason (400 + captcha in the error).
  const looksLikeCaptchaRefusal = res.status === 400 && /captcha/i.test(text)
  return { ok: looksLikeCaptchaRefusal, status: res.status, body: text.slice(0, 300) }
}

let failures = 0
let covered = 0
let coveredEnforced = 0
for (const p of PROJECTS) {
  let found
  try {
    found = await anonKeyFor(p)
  } catch (err) {
    console.error(`SKIP - ${p.name} (${p.ref}): could not fetch anon key: ${err.message}`)
    continue
  }
  if (!found) {
    console.error(
      `SKIP - ${p.name} (${p.ref}): no anon key (set ${p.anonEnv}, or SUPABASE_ACCESS_TOKEN / docs/Credentials.txt to read the ` +
        'project\'s own publishable key). NOT counted as passing.'
    )
    continue
  }
  const { key: anon, source } = found
  covered++
  if (p.enforced) coveredEnforced++
  console.log(`     ${p.name}: probing with the public key from ${source}`)
  try {
    const r = await tokenlessRecoverRefused(p, anon)
    assert.ok(
      r.status !== 401,
      `${p.name}: the key was REFUSED (401) — this run tested nothing about captcha. Use the ` +
        `current publishable key. Body: ${r.body}`
    )
    if (p.enforced) {
      assert.ok(r.ok, `${p.name}: tokenless /recover must be refused for captcha (400/captcha); got ${r.status}: ${r.body}`)
      console.log(`ok - ${p.name} (${p.ref}): tokenless /recover request refused (captcha enforced)`)
    } else {
      // Not a pass for doing nothing: this asserts the OPPOSITE state, and says why it is the
      // right one today and exactly what has to happen before it changes.
      assert.ok(
        !r.ok,
        `${p.name}: captcha is now ENFORCED here, and it was deliberately left OFF — ${p.whyNotEnforced}`
      )
      console.log(`ok - ${p.name} (${p.ref}): still OFF on purpose (${r.status}), as recorded. ${p.whyNotEnforced}`)
    }
  } catch (err) {
    failures++
    console.error(`FAIL - ${p.name} (${p.ref}): ${err.message}`)
  }
}

if (covered === 0) {
  console.error('\nNo project could be probed (no anon key obtained). This guard proved nothing.')
  process.exit(1)
}
// COVERING ONLY THE PROJECT THAT IS SUPPOSED TO BE OPEN IS NOT COVERAGE. Without this, a run that
// reached staging and could not reach production would print a green line about the one project
// where nothing is being defended — the exact shape of a job that reports success for doing
// nothing. The hole this guard exists for is on the ENFORCED projects.
if (coveredEnforced === 0) {
  console.error('\nNo ENFORCED project could be probed. The only projects reached were ones deliberately left')
  console.error('open, so nothing was proved about the vulnerability this guard exists for.')
  process.exit(1)
}
if (failures > 0) {
  console.error(`\n${failures} project(s) are in the wrong captcha state — sign-in bot protection is NOT as recorded.`)
  process.exit(1)
}
console.log(
  `\nAll ${covered} covered project(s) are in the recorded state: ${coveredEnforced} enforcing captcha on a ` +
    `tokenless /recover, ${covered - coveredEnforced} deliberately open. Sign-in bot protection is enforced where it must be.`
)
process.exit(0)
