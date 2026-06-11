import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { getCorsHeaders } from '../_shared/cors.ts'

/**
 * google-auth-callback: Handles the OAuth callback from Google.
 * Exchanges the authorization code for tokens and stores them.
 *
 * Called via redirect: GET /google-auth-callback?code=xxx&state=jwt
 *
 * Required env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
 */
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state') // JWT token
    const error = url.searchParams.get('error')

    const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'https://valrano.com'

    if (error) {
      return Response.redirect(
        `${frontendUrl}/settings?tab=templates&google_error=${encodeURIComponent(error)}`,
        302,
      )
    }

    if (!code || !state) {
      return Response.redirect(
        `${frontendUrl}/settings?tab=templates&google_error=missing_params`,
        302,
      )
    }

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
    const redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI')
    const sbUrl = Deno.env.get('SUPABASE_URL')!
    const sbAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const sbServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!clientId || !clientSecret || !redirectUri) {
      return Response.redirect(
        `${frontendUrl}/settings?tab=templates&google_error=not_configured`,
        302,
      )
    }

    // Verify the user from the JWT in state
    const userClient = createClient(sbUrl, sbAnonKey, {
      global: { headers: { Authorization: `Bearer ${state}` } },
    })
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) {
      return Response.redirect(
        `${frontendUrl}/settings?tab=templates&google_error=invalid_session`,
        302,
      )
    }

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      const body = await tokenRes.text()
      console.error('Token exchange failed:', body)
      return Response.redirect(
        `${frontendUrl}/settings?tab=templates&google_error=token_exchange_failed`,
        302,
      )
    }

    const tokens = await tokenRes.json()

    // Get user's Google email
    const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const userinfo = await userinfoRes.json()

    // Store tokens in DB
    const adminClient = createClient(sbUrl, sbServiceKey)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    await adminClient
      .from('google_connections')
      .upsert({
        user_id: user.id,
        google_email: userinfo.email ?? 'unknown',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
        scopes: tokens.scope?.split(' ') ?? [],
      }, { onConflict: 'user_id' })

    return Response.redirect(
      `${frontendUrl}/settings?tab=templates&google_connected=true`,
      302,
    )
  } catch (err) {
    console.error('Google auth callback error:', err)
    const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'https://valrano.com'
    return Response.redirect(
      `${frontendUrl}/settings?tab=templates&google_error=unexpected`,
      302,
    )
  }
})
