import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { corsHeaders } from './cors.ts'

interface AuthResult {
  user: { id: string; email?: string }
  userClient: SupabaseClient
  adminClient: SupabaseClient
}

/** Verify JWT and return user + both clients */
export async function authenticateRequest(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    throw new AuthError('Missing authorization header', 401)
  }

  const sbUrl = Deno.env.get('SUPABASE_URL')
  const sbAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const sbServiceKey = (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
  if (!sbUrl || !sbAnonKey || !sbServiceKey) {
    throw new AuthError('Missing Supabase environment variables', 500)
  }

  const userClient = createClient(sbUrl, sbAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error } = await userClient.auth.getUser()
  if (error || !user) {
    throw new AuthError('Invalid or expired session', 401)
  }

  const adminClient = createClient(sbUrl, sbServiceKey)

  return { user: { id: user.id, email: user.email }, userClient, adminClient }
}

export class AuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** Standard JSON error response */
export function errorResponse(err: unknown): Response {
  if (err instanceof AuthError) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: err.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  console.error('Unexpected error:', err)
  return new Response(
    JSON.stringify({ error: 'Internal server error' }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/** Standard JSON success response */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(
    JSON.stringify(data),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
