/**
 * Supabase Auth Email Hook — sends all auth emails (OTP, magic link, recovery)
 * via Metanet SMTP instead of Supabase's built-in mailer.
 *
 * Configured in Supabase Auth -> Hooks -> Send Email Hook.
 */

import { sendEmail, getAuthEmailContent } from '../_shared/email.ts'

const HOOK_SECRET = Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? ''

// ── Webhook signature verification ────────────────────────────
async function verifySignature(payload: string, signature: string): Promise<boolean> {
  if (!HOOK_SECRET) {
    console.error('SEND_EMAIL_HOOK_SECRET not configured — rejecting request')
    return false
  }

  try {
    const secretBytes = Uint8Array.from(atob(HOOK_SECRET), c => c.charCodeAt(0))
    const key = await crypto.subtle.importKey(
      'raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
    const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
    const provided = signature.replace('v1,', '')
    return expected === provided
  } catch (err) {
    console.error('Signature verification error:', (err as Error).message)
    return false
  }
}

// ── Handler ───────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 })
  }

  const body = await req.text()

  const signature = req.headers.get('x-supabase-webhook-signature') ?? ''
  if (!(await verifySignature(body, signature))) {
    console.error('Invalid webhook signature')
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 })
  }

  let payload: {
    user: { email: string; user_metadata?: Record<string, unknown> }
    email_data: {
      token: string; token_hash: string; redirect_to: string
      email_action_type: string; site_url: string
    }
  }
  try {
    payload = JSON.parse(body)
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const email = payload.user?.email
  if (!email) {
    return new Response(JSON.stringify({ error: 'No email in payload' }), { status: 400 })
  }

  try {
    const { subject, html } = getAuthEmailContent(payload)
    await sendEmail({ to: email, subject, html })
    console.log(`Auth email sent: ${payload.email_data.email_action_type} -> ${email}`)
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(`Failed to send auth email to ${email}:`, (err as Error).message)
    return new Response(
      JSON.stringify({ error: 'Failed to send email' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
