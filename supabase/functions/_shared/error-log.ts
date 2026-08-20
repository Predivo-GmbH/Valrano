import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { reportToSentry } from './sentry.ts'

export async function logError(
  functionName: string,
  operation: string,
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  console.error(`[${functionName}] ${operation}:`, error)
  // Mirror to Sentry (no-ops unless the SENTRY_DSN edge secret is set).
  await reportToSentry(functionName, operation, error, context)
  try {
    const url = Deno.env.get('SUPABASE_URL')
    const key = (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
    if (!url || !key) return
    const client = createClient(url, key)
    await client.from('error_log').insert({
      function_name: functionName,
      operation,
      error_message: error instanceof Error ? error.message : String(error),
      // Pass the OBJECT, not a string. `context` is jsonb; JSON.stringify here
      // double-encoded it, so every row landed as the jsonb STRING "{}" rather than
      // the object {}, making `context->>'user_id'` permanently null. Verified on
      // ReplyFlow prod 2026-08-20. Same defect, same fix as ReplyFlow 3e353c6.
      context: context ?? {},
    })
  } catch { /* DB logging failed — console.error above is last resort */ }
}
