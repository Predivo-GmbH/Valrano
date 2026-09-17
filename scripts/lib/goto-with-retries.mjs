/**
 * A NAVIGATION THAT RAN OUT OF TIME ON A BUSY MACHINE IS NOT A BROKEN PAGE (2026-09-14).
 *
 * WHY THIS EXISTS. Valrano deploy run 34846497450 attempt 1 (2026-09-14 13:05Z) failed the
 * whole staging deploy at `npm run build`, with:
 *
 *     Rendering /...        Done: index.html      (3.5s)
 *     Rendering /privacy... Done: privacy.html    (4.4s)
 *     Rendering /terms...   Prerender failed: TimeoutError: Navigation timeout of 15000 ms exceeded
 *
 * `vite build` had already printed "built in 26.36s". Nothing about the product was wrong: two
 * routes of the same app rendered seconds earlier on the same page load, and the same commit's
 * prerender had passed at 12:17Z (run 34842610529, deploy-staging success). What changed was the
 * machine. These runners are WSL runners on Roger's laptop, shared by the whole fleet, and the
 * job spent 12:59->13:35 merely waiting to be picked up. A single fixed 15s budget for a headless
 * Chrome navigation on a box in that state is a coin toss, and losing the toss published
 * "Valrano: the staging deploy is failing" - a sentence about the product, caused by the load on
 * our own hardware.
 *
 * WHAT THIS DOES NOT DO. It does not weaken the assertion. `waitUntil: 'networkidle0'` is
 * unchanged, so a route still has to reach a genuinely idle network before its HTML is kept, and
 * every non-timeout failure - a navigation error, a crashed tab, a bad URL - is rethrown on the
 * FIRST attempt with no retry at all. The only thing that earns another go is the one error that
 * means "I ran out of wall clock", and each retry gets a larger budget rather than the same one
 * again. When every attempt has been spent the build still fails, loudly, naming the route and
 * every budget it was given - so a route that genuinely cannot render can never pass as slow.
 */

/** Puppeteer signals an exhausted navigation budget by error name, not by class identity. */
export function isNavigationTimeout(err) {
  if (!err) return false
  if (err.name === 'TimeoutError') return true
  return /Navigation timeout of \d+ ms exceeded/i.test(String(err.message || ''))
}

/**
 * Wall-clock budgets, in order. The first is the budget this script used before today, so a
 * healthy machine behaves exactly as it always did and pays nothing; the later ones exist only
 * for a machine that is busy, and are never reached otherwise.
 */
export const NAVIGATION_BUDGETS_MS = [15000, 30000, 60000]

/**
 * Navigate `page` to `url`, giving a starved machine more wall clock before calling the page
 * broken. Returns the 1-based attempt number that succeeded.
 *
 * @param {{goto: (url: string, opts: object) => Promise<unknown>}} page  a Puppeteer page
 * @param {string} url
 * @param {{budgets?: number[], waitUntil?: string, onRetry?: (info: object) => void}} [opts]
 */
export async function gotoWithRetries(page, url, opts = {}) {
  const budgets = opts.budgets || NAVIGATION_BUDGETS_MS
  const waitUntil = opts.waitUntil || 'networkidle0'
  if (!Array.isArray(budgets) || budgets.length === 0) {
    throw new Error('gotoWithRetries: at least one navigation budget is required')
  }

  for (let i = 0; i < budgets.length; i++) {
    try {
      await page.goto(url, { waitUntil, timeout: budgets[i] })
      return i + 1
    } catch (err) {
      // Anything that is not "out of time" is a real answer about the page. Fail now.
      if (!isNavigationTimeout(err)) throw err
      const isLast = i === budgets.length - 1
      if (isLast) {
        throw new Error(
          `prerender: ${url} did not reach ${waitUntil} within any of its navigation budgets ` +
          `(${budgets.map((b) => `${b}ms`).join(', ')}), over ${budgets.length} attempts. ` +
          'Every attempt ended in a navigation timeout, so this is not a slow machine any more: ' +
          'the route itself never goes idle. Original error: ' + String(err.message || err)
        )
      }
      if (typeof opts.onRetry === 'function') {
        opts.onRetry({ url, attempt: i + 1, spentMs: budgets[i], nextMs: budgets[i + 1], error: err })
      }
    }
  }
  /* c8 ignore next */
  throw new Error('gotoWithRetries: unreachable')
}
