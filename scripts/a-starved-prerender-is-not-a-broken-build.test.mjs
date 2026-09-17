#!/usr/bin/env node
/**
 * A STARVED PRERENDER IS NOT A BROKEN BUILD - and a route that never goes idle still is.
 *
 * Guards scripts/lib/goto-with-retries.mjs, the helper scripts/prerender.mjs navigates through.
 * The failure it was written for: Valrano deploy run 34846497450 attempt 1 (2026-09-14 13:05Z)
 * reddened the whole staging deploy because the THIRD of four routes took longer than one fixed
 * 15s budget on a WSL runner that had already spent 36 minutes queued. Two routes of the same app
 * had rendered seconds earlier, and the same commit's prerender passed at 12:17Z.
 *
 * The danger in fixing that is fixing too much: a retry loop that swallows every error turns a
 * page which genuinely cannot render into a green deploy. So this suite pins BOTH halves, and the
 * last check is a mutation - it re-implements the helper WITHOUT the "only a timeout is retried"
 * rule and requires the suite's own expectation to break, so the check cannot pass by the rule
 * being absent.
 *
 * Run: node scripts/a-starved-prerender-is-not-a-broken-build.test.mjs
 */
import assert from 'node:assert/strict'
import { gotoWithRetries, isNavigationTimeout, NAVIGATION_BUDGETS_MS } from './lib/goto-with-retries.mjs'

let passed = 0
const checks = []
function check(name, fn) { checks.push([name, fn]) }

/** A fake Puppeteer page. `script` says what the Nth goto() does. */
function fakePage(script) {
  const calls = []
  return {
    calls,
    async goto(url, opts) {
      calls.push({ url, ...opts })
      const step = script[calls.length - 1]
      if (step === 'ok') return
      if (step === 'timeout') {
        const err = new Error(`Navigation timeout of ${opts.timeout} ms exceeded`)
        err.name = 'TimeoutError'
        throw err
      }
      throw step
    },
  }
}

const timeoutError = () => { const e = new Error('Navigation timeout of 15000 ms exceeded'); e.name = 'TimeoutError'; return e }

check('the first attempt still uses the budget this script always used (a healthy machine pays nothing)', async () => {
  assert.equal(NAVIGATION_BUDGETS_MS[0], 15000)
  const page = fakePage(['ok'])
  const attempt = await gotoWithRetries(page, 'http://localhost:1/terms')
  assert.equal(attempt, 1)
  assert.equal(page.calls.length, 1, 'a page that renders must be navigated exactly once')
  assert.equal(page.calls[0].timeout, 15000)
})

check('the assertion is unchanged: every attempt still waits for networkidle0', async () => {
  const page = fakePage(['timeout', 'timeout', 'ok'])
  await gotoWithRetries(page, 'http://localhost:1/terms')
  assert.equal(page.calls.length, 3)
  for (const c of page.calls) assert.equal(c.waitUntil, 'networkidle0')
})

check('a route that times out on a busy machine is retried with a BIGGER budget, not the same one', async () => {
  const page = fakePage(['timeout', 'timeout', 'ok'])
  const attempt = await gotoWithRetries(page, 'http://localhost:1/terms')
  assert.equal(attempt, 3, 'it should report which attempt actually rendered')
  const budgets = page.calls.map((c) => c.timeout)
  assert.deepEqual(budgets, [15000, 30000, 60000])
  for (let i = 1; i < budgets.length; i++) {
    assert.ok(budgets[i] > budgets[i - 1], 'each retry must get more wall clock than the last')
  }
})

check('the retry is announced, so a slow machine is visible in the log and never silent', async () => {
  const seen = []
  const page = fakePage(['timeout', 'ok'])
  await gotoWithRetries(page, 'http://localhost:1/terms', { onRetry: (i) => seen.push(i) })
  assert.equal(seen.length, 1)
  assert.equal(seen[0].attempt, 1)
  assert.equal(seen[0].spentMs, 15000)
  assert.equal(seen[0].nextMs, 30000)
  assert.match(seen[0].url, /\/terms$/)
})

check('A ROUTE THAT NEVER GOES IDLE STILL FAILS THE BUILD - the retry is not an excuse', async () => {
  const page = fakePage(['timeout', 'timeout', 'timeout'])
  await assert.rejects(
    () => gotoWithRetries(page, 'http://localhost:1/terms'),
    (err) => {
      assert.match(err.message, /\/terms/, 'the failure must name the route')
      assert.match(err.message, /15000ms, 30000ms, 60000ms/, 'it must say what it gave the page')
      assert.match(err.message, /never goes idle/i)
      return true
    },
  )
  assert.equal(page.calls.length, 3, 'it must not keep trying forever')
})

check('a REAL navigation error is not retried at all - it fails on the first attempt', async () => {
  const real = new Error('net::ERR_CONNECTION_REFUSED at http://localhost:1/terms')
  const page = fakePage([real, 'ok'])
  await assert.rejects(() => gotoWithRetries(page, 'http://localhost:1/terms'), /ERR_CONNECTION_REFUSED/)
  assert.equal(page.calls.length, 1, 'a broken page must not be handed a second chance')
})

check('the prerender guard errors this script raises itself are not mistaken for timeouts', () => {
  assert.equal(isNavigationTimeout(timeoutError()), true)
  assert.equal(isNavigationTimeout(new Error('prerender guard: terms.html still contains an absolute localhost URL')), false)
  assert.equal(isNavigationTimeout(null), false)
})

check('MUTATION: a retry loop that swallows EVERY error would let a broken page ship - and this suite catches that', async () => {
  // The helper as it would be WITHOUT the "only a timeout is retried" rule.
  async function mutated(page, url, budgets = NAVIGATION_BUDGETS_MS) {
    let last
    for (let i = 0; i < budgets.length; i++) {
      try { await page.goto(url, { waitUntil: 'networkidle0', timeout: budgets[i] }); return i + 1 } catch (e) { last = e }
    }
    throw last
  }
  const real = new Error('net::ERR_CONNECTION_REFUSED at http://localhost:1/terms')
  const page = fakePage([real, 'ok'])
  const attempt = await mutated(page, 'http://localhost:1/terms')
  assert.equal(attempt, 2, 'the mutant swallows the real error and reports success')
  assert.equal(page.calls.length, 2)
  // ...which is exactly what the check above forbids for the real helper.
  const page2 = fakePage([real, 'ok'])
  await assert.rejects(() => gotoWithRetries(page2, 'http://localhost:1/terms'))
})

check('scripts/prerender.mjs actually navigates through the helper (a fix nothing calls is not a fix)', async () => {
  const { readFileSync } = await import('node:fs')
  // Assert with ok(), not match(): a failing match() here would dump the whole 150-line source
  // into the log, which is how a red test becomes unreadable.
  const src = readFileSync(new URL('./prerender.mjs', import.meta.url), 'utf-8')
  assert.ok(
    /import \{ gotoWithRetries \} from '\.\/lib\/goto-with-retries\.mjs'/.test(src),
    "prerender.mjs does not import gotoWithRetries from './lib/goto-with-retries.mjs'",
  )
  assert.ok(
    /await gotoWithRetries\(page, url/.test(src),
    'prerender.mjs does not navigate through gotoWithRetries(page, url, ...)',
  )
  assert.ok(
    !/await page\.goto\(/.test(src),
    'prerender.mjs still calls page.goto() directly - that is the unguarded path this fix replaced',
  )
})

const run = async () => {
  for (const [name, fn] of checks) {
    try { await fn(); passed++; console.log(`  ok   - ${name}`) }
    catch (err) { console.error(`  FAIL - ${name}\n         ${err.message}`); process.exitCode = 1 }
  }
  console.log(`\n${passed}/${checks.length} check(s) passed`)
}
await run()
