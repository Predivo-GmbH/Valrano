import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { sendEmail } from '../_shared/email.ts'

/**
 * request-demo — Handles demo request form submissions from the landing page.
 *
 * No auth required (public endpoint for unauthenticated visitors).
 * Sends notification to hello@valrano.com and confirmation to the requester.
 */

const DEMO_INBOX = 'hello@valrano.com'

interface DemoRequest {
  name: string
  email: string
  company: string
  role?: string
  message?: string
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  const headers = getCorsHeaders(req)

  try {
    const body: DemoRequest = await req.json()

    // Validate required fields
    if (!body.name?.trim() || !body.email?.trim() || !body.company?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Name, email, and company are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...headers } },
      )
    }

    if (!validateEmail(body.email.trim())) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...headers } },
      )
    }

    const name = escapeHtml(body.name.trim())
    const email = body.email.trim().toLowerCase()
    const company = escapeHtml(body.company.trim())
    const role = body.role ? escapeHtml(body.role.trim()) : null
    const message = body.message ? escapeHtml(body.message.trim()) : null

    // 1. Send notification email to hello@valrano.com
    const internalHtml = [
      '<h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#18181b;">New Demo Request</h2>',
      '<table style="width:100%;border-collapse:collapse;font-size:14px;color:#3f3f46;">',
      `<tr><td style="padding:8px 12px;font-weight:600;color:#18181b;border-bottom:1px solid #e4e4e7;width:100px;">Name</td><td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;">${name}</td></tr>`,
      `<tr><td style="padding:8px 12px;font-weight:600;color:#18181b;border-bottom:1px solid #e4e4e7;">Email</td><td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;"><a href="mailto:${email}" style="color:#3B82F6;">${email}</a></td></tr>`,
      `<tr><td style="padding:8px 12px;font-weight:600;color:#18181b;border-bottom:1px solid #e4e4e7;">Company</td><td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;">${company}</td></tr>`,
      role ? `<tr><td style="padding:8px 12px;font-weight:600;color:#18181b;border-bottom:1px solid #e4e4e7;">Role</td><td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;">${role}</td></tr>` : '',
      message ? `<tr><td style="padding:8px 12px;font-weight:600;color:#18181b;vertical-align:top;">Message</td><td style="padding:8px 12px;">${message}</td></tr>` : '',
      '</table>',
      `<p style="margin:16px 0 0;font-size:12px;color:#a1a1aa;">Submitted at ${new Date().toISOString()}</p>`,
    ].join('\n')

    await sendEmail({
      to: DEMO_INBOX,
      subject: `Demo Request: ${body.company.trim()} — ${body.name.trim()}`,
      html: internalHtml,
      text: `New demo request from ${body.name.trim()} (${email}) at ${body.company.trim()}`,
    })

    // 2. Send confirmation email to requester
    const confirmHtml = [
      '<h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#18181b;">Thank you for your interest</h2>',
      `<p style="margin:0 0 12px;font-size:15px;color:#3f3f46;line-height:1.6;">Hi ${name},</p>`,
      '<p style="margin:0 0 12px;font-size:15px;color:#3f3f46;line-height:1.6;">We received your demo request for Valrano. A member of our team will reach out to you within one business day to schedule a personalized walkthrough.</p>',
      '<p style="margin:0 0 12px;font-size:15px;color:#3f3f46;line-height:1.6;">In the meantime, you can already create a free account to explore the platform:</p>',
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:20px auto;">',
      '<tr>',
      '<td align="center" bgcolor="#3B82F6" style="background-color:#3B82F6;border-radius:8px;">',
      '<a href="https://valrano.com/signup" target="_blank" style="display:inline-block;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;padding:14px 40px;">Create Free Account</a>',
      '</td>',
      '</tr>',
      '</table>',
      '<p style="margin:16px 0 0;font-size:13px;color:#a1a1aa;">If you have questions before the demo, reply directly to this email.</p>',
    ].join('\n')

    try {
      await sendEmail({
        to: email,
        subject: 'Valrano — Demo request received',
        html: confirmHtml,
        text: `Hi ${body.name.trim()}, we received your demo request. We'll reach out within one business day. Visit https://valrano.com/signup to explore the platform.`,
      })
    } catch (confirmErr) {
      // Non-blocking — internal notification already sent
      console.warn('[request-demo] Confirmation email failed:', confirmErr)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...headers } },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[request-demo] Error:', msg)
    return new Response(
      JSON.stringify({ error: 'Failed to process demo request' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...headers } },
    )
  }
})
