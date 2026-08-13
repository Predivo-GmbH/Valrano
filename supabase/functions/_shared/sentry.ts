/**
 * Dependency-free Sentry reporter for Supabase edge functions (Deno).
 *
 * DELIBERATELY NO SDK IMPORT. This module is pulled in by _shared/error-log.ts,
 * which multiple edge functions import. A bad/remote SDK import here would break
 * every one of them (Rule 54 blast radius; cf. the documented "edge runtime 503s
 * on dynamic remote imports" trap). Instead we build a minimal Sentry event
 * envelope and POST it with fetch. Never throws, never hangs (2s timeout).
 *
 * No-ops unless the SENTRY_DSN edge secret is set. The DSN is a PUBLIC client key.
 * environment is derived from SUPABASE_URL so staging vs production separate
 * automatically with no extra secret.
 */

// deno-lint-ignore no-explicit-any
const denoEnv = (globalThis as any).Deno?.env

function env(name: string): string | undefined {
  try {
    return denoEnv?.get?.(name)
  } catch {
    return undefined
  }
}

const DSN = env('SENTRY_DSN')
const SUPABASE_URL = env('SUPABASE_URL') ?? ''
// Staging project ref = vfwpcgdkrwqhdivfzmrg; anything else (incl. prod
// mkdeftmubrkseyrrbzvp) is treated as production.
const ENVIRONMENT = env('SENTRY_ENVIRONMENT')
  ?? (SUPABASE_URL.includes('vfwpcgdkrwqhdivfzmrg') ? 'staging' : 'production')

interface ParsedDsn {
  envelopeUrl: string
  publicKey: string
}

function parseDsn(dsn: string): ParsedDsn | null {
  try {
    // DSN form: https://<publicKey>@<host>/<projectId>
    const u = new URL(dsn)
    const publicKey = u.username
    const projectId = u.pathname.replace(/^\//, '')
    if (!publicKey || !projectId) return null
    return { envelopeUrl: `${u.protocol}//${u.host}/api/${projectId}/envelope/`, publicKey }
  } catch {
    return null
  }
}

const parsed = DSN ? parseDsn(DSN) : null

function eventId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, '')
  } catch {
    // Fallback: 32 hex chars from Math.random (event_id only needs to be unique-ish).
    let s = ''
    while (s.length < 32) s += Math.floor(Math.random() * 16).toString(16)
    return s.slice(0, 32)
  }
}

/**
 * Send an exception to Sentry. Never throws; resolves even on failure. Bounded to
 * ~2s so it can be awaited on an error path without risk of hanging the function.
 */
export async function reportToSentry(
  functionName: string,
  operation: string,
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  if (!parsed) return // SENTRY_DSN not set → no-op

  // Skip expected client errors (4xx). AuthError and any error carrying a numeric
  // `status` in the 4xx range is a handled request-validation / auth / business-rule
  // outcome, NOT an app fault. It still lands in the DB error_log via logError; it
  // just does not belong in crash monitoring. Genuine 5xx / uncaught errors (no
  // status, or 5xx) still report.
  const status = (error as { status?: unknown })?.status
  if (typeof status === 'number' && status >= 400 && status < 500) return

  try {
    const id = eventId()
    const nowSec = Date.now() / 1000
    const errName = error instanceof Error ? error.name : 'Error'
    const errMsg = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error && error.stack ? String(error.stack).slice(0, 4000) : undefined

    const event = {
      event_id: id,
      timestamp: nowSec,
      platform: 'javascript',
      level: 'error',
      environment: ENVIRONMENT,
      logger: functionName,
      transaction: functionName,
      server_name: functionName,
      tags: { function: functionName, operation, runtime: 'supabase-edge' },
      exception: {
        values: [
          {
            type: errName,
            value: errMsg,
            mechanism: { type: 'generic', handled: true },
          },
        ],
      },
      extra: { ...(context ?? {}), ...(stack ? { stack } : {}) },
    }

    const body =
      JSON.stringify({ event_id: id, sent_at: new Date().toISOString(), dsn: DSN }) +
      '\n' +
      JSON.stringify({ type: 'event' }) +
      '\n' +
      JSON.stringify(event)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2000)
    try {
      await fetch(parsed.envelopeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-sentry-envelope',
          'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=valrano-edge/1.0`,
        },
        body,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }
  } catch {
    // Reporting must never surface — the console.error in logError is the fallback.
  }
}
