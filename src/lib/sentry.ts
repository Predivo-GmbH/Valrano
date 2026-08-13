/**
 * Sentry error/crash monitoring (PILOT, re-added 2026-08-13, fleet rollout from ReplyFlow).
 *
 * Error monitoring ONLY — no performance tracing, no session replay — so the
 * pilot measures exactly one thing: real user errors our GH-Actions monitors +
 * Playwright smoke tests miss. Complements PostHog/analytics (if any), which
 * captures *what* users do, not *why* the app broke.
 *
 * No-ops entirely unless VITE_SENTRY_DSN is set (injected at build from a GitHub
 * Actions secret). Unlike host-gated analytics it is NOT prod-host-gated: we WANT
 * staging errors during the pilot, and tag each event with `environment` = hostname
 * so staging vs production stay distinguishable in one project.
 *
 * The DSN is a PUBLIC client key — safe to ship in the bundle.
 *
 * Loaded via DYNAMIC import so @sentry/react stays OUT of the entry chunk (the
 * first attempt used a static `import * as Sentry from '@sentry/react'`, which
 * bloated the entry bundle 19KB -> 104KB raw and changed the chunk-loading order
 * enough to trip Valrano's strict `script-src 'self'` CSP — see docs/Credentials.txt
 * Sentry section for the root-cause note). The DSN gate below means the chunk is
 * only ever fetched when Sentry is actually configured.
 */

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined
const RELEASE = import.meta.env.VITE_SENTRY_RELEASE as string | undefined

let started = false
let sentryPromise: Promise<typeof import('@sentry/react')> | null = null

function loadSentry(): Promise<typeof import('@sentry/react')> {
  if (!sentryPromise) sentryPromise = import('@sentry/react')
  return sentryPromise
}

/** Initialize Sentry as early as possible. No-ops unless VITE_SENTRY_DSN is set. */
export function initSentry(): void {
  if (started || !DSN || typeof window === 'undefined') return
  started = true
  void loadSentry().then((Sentry) =>
    Sentry.init({
      dsn: DSN,
      release: RELEASE,
      environment:
        window.location.hostname === 'valrano.com' ? 'production' : window.location.hostname,
      // Errors-only pilot: no performance transactions (keeps us clearly inside the
      // free Errors quota and off the separate Spans/tracing product).
      tracesSampleRate: 0,
      // GDPR / Swiss nFADP: never attach IP address, cookies, or request bodies.
      sendDefaultPii: false,
      // Non-actionable browser/extension noise that would otherwise burn quota.
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications.',
        'Non-Error promise rejection captured',
      ],
    }),
  )
}

/** Report an exception to Sentry. Never throws (reporting must never cascade a crash). */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!started) return
  void loadSentry()
    .then((Sentry) => Sentry.captureException(error, context ? { extra: context } : undefined))
    .catch(() => {
      /* swallow — reporting failure must never surface to the user */
    })
}
