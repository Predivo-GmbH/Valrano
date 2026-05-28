import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function logError(
  functionName: string,
  operation: string,
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  console.error(`[${functionName}] ${operation}:`, error)
  try {
    const url = Deno.env.get('SUPABASE_URL')
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !key) return
    const client = createClient(url, key)
    await client.from('error_log').insert({
      function_name: functionName,
      operation,
      error_message: error instanceof Error ? error.message : String(error),
      context: context ? JSON.stringify(context) : '{}',
    })
  } catch { /* DB logging failed — console.error above is last resort */ }
}
