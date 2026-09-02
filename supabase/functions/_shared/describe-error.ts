/**
 * Turn any thrown value into a sentence a human can act on.
 *
 * `String(error)` on a plain object yields "[object Object]", and that is exactly what
 * three ChannelMover lifecycle failures wrote into Sentry, into `error_log.error_message`
 * and into the console on 2026-08-28 and 08-29:
 *
 *   lifecycle-send / read_kill_switch -> "Error: [object Object]"
 *
 * A supabase-js failure is a PostgrestError - a plain object with `message`, `code`,
 * `details` and `hint`, NOT an Error - so every one of those channels lost the only
 * information that could have explained the failure, and the kill-switch read that
 * silently disabled a tick of live customer email became undiagnosable.
 *
 * This adds nothing and hides nothing: an Error still reports its own message, and an
 * object now reports the fields it actually carries instead of its type name.
 */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error === null || error === undefined) return String(error)

  if (typeof error === 'object') {
    const e = error as Record<string, unknown>
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
    const parts = [
      str(e.message),
      e.code !== undefined && e.code !== null ? `code=${String(e.code)}` : null,
      str(e.details) ? `details=${str(e.details)}` : null,
      str(e.hint) ? `hint=${str(e.hint)}` : null,
    ].filter((p): p is string => p !== null)

    if (parts.length > 0) return parts.join(' | ')
    // Nothing recognisable — dump it rather than print "[object Object]".
    try {
      const json = JSON.stringify(error)
      if (json && json !== '{}') return json
    } catch { /* circular or non-serialisable */ }
  }
  return String(error)
}

/** The exception TYPE Sentry groups by. A PostgrestError should not read as "Error". */
export function describeErrorName(error: unknown): string {
  if (error instanceof Error) return error.name
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>
    if (typeof e.name === 'string' && e.name.trim()) return e.name.trim()
    // supabase-js shape: message + code (+ details/hint) and no name.
    if ('message' in e && 'code' in e) return 'PostgrestError'
  }
  return 'Error'
}
