import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Current user's id from the JWT claims. With the project's ES256 (asymmetric)
 * auth keys, getClaims() verifies the token locally — no /auth/v1/user network
 * round-trip like getUser() — and falls back to getUser() when local
 * verification isn't possible, so it is always at least as safe. Returns null
 * when there is no authenticated user.
 *
 * NOTE: use getUser() (not this) when you need fields absent from the JWT claims
 * (e.g. last_sign_in_at) or the full User object.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getClaims()
  return (data?.claims?.sub as string | undefined) ?? null
}
