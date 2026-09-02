/**
 * Supabase Auth Email Hook — sends all auth emails (OTP, magic link, recovery)
 * via Metanet SMTP instead of Supabase's built-in mailer.
 *
 * Configured in Supabase Auth -> Hooks -> Send Email Hook.
 */

import { sendEmail, getAuthEmailContent } from '../_shared/email.ts'

/** Constant-time string comparison — prevents timing attacks on secret comparison. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const encoder = new TextEncoder()
  const ab = encoder.encode(a)
  const bb = encoder.encode(b)
  let result = 0
  for (let i = 0; i < ab.length; i++) result |= ab[i] ^ bb[i]
  return result === 0
}

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
    return timingSafeEqual(expected, provided)
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

  // ── Authenticate the caller (fleet:send-auth-email:unauthenticated-relay) ──────────────
  // This project's Send-Email hook is a Postgres hook (pg-functions://…/handle_send_email),
  // which calls this function via pg_net with ONLY the public anon key as bearer and NO
  // Standard-Webhooks signature. So the signature can't be the guard, and accepting every
  // unsigned call means any anon-key holder (the key ships in the frontend) could POST a
  // crafted payload and make us relay auth-templated mail to arbitrary addresses.
  //
  // Fix: a shared secret. handle_send_email sends `x-send-email-secret`; we require it.
  // Two accepted modes so a future switch to the GoTrue HTTP hook still works:
  //   • a valid Standard-Webhooks signature, OR
  //   • the internal shared secret.
  // Enforcement is GATED on SEND_EMAIL_INTERNAL_SECRET being set — until it is provisioned
  // (and handle_send_email updated to send the header) behaviour is unchanged, so deploying
  // this code is a no-op and the cutover is outage-free. Do NOT change this to a bare
  // `if (!signature) 401` — the pg_net hook is unsigned by design and that flip has broken
  // OTP delivery on ReplyFlow and SignalScore before (framework PROTECTED-PATTERN).
  const signature = req.headers.get('x-supabase-webhook-signature') ?? ''
  const internalSecret = Deno.env.get('SEND_EMAIL_INTERNAL_SECRET') ?? ''
  const providedSecret = req.headers.get('x-send-email-secret') ?? ''

  const signatureOk = signature.length > 0 && (await verifySignature(body, signature))
  const secretOk = internalSecret.length > 0 && providedSecret.length > 0 &&
    timingSafeEqual(providedSecret, internalSecret)

  if (signature.length > 0 && !signatureOk) {
    console.error('Invalid webhook signature')
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 })
  }
  if (internalSecret.length > 0 && !signatureOk && !secretOk) {
    console.error('Missing/invalid internal secret — rejecting unsigned relay attempt')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
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
