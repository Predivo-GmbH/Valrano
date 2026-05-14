import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

/**
 * google-auth-url: Generates the Google OAuth consent URL.
 * The frontend redirects the user to this URL to authorize access.
 *
 * Required env vars: GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI
 */
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    await authenticateRequest(req)

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI')

    if (!clientId || !redirectUri) {
      return jsonResponse({ error: 'Google OAuth not configured' }, 500)
    }

    const scopes = [
      'https://www.googleapis.com/auth/presentations',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.email',
    ]

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      // Pass Supabase JWT in state so callback can identify the user
      state: req.headers.get('Authorization')?.replace('Bearer ', '') ?? '',
    })

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

    return jsonResponse({ url })
  } catch (err) {
    return errorResponse(err)
  }
})
