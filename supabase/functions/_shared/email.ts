/**
 * Shared SMTP email module for Valrano transactional emails.
 * Uses Metanet's native SMTP service via Deno's smtp client.
 *
 * Required env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */

import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

// ─── Config ──────────────────────────────────────────────────────────────────

interface SmtpConfig {
  hostname: string
  port: number
  username: string
  password: string
  from: string
}

function getSmtpConfig(): SmtpConfig {
  const hostname = Deno.env.get('SMTP_HOST')
  const port = Deno.env.get('SMTP_PORT')
  const username = Deno.env.get('SMTP_USER')
  const password = Deno.env.get('SMTP_PASS')
  const from = Deno.env.get('SMTP_FROM') ?? 'Valrano <noreply@valrano.com>'

  if (!hostname || !port || !username || !password) {
    throw new Error('Missing SMTP configuration (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)')
  }

  return { hostname, port: parseInt(port, 10), username, password, from }
}

// ─── Send ────────────────────────────────────────────────────────────────────

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  replyTo?: string
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const config = getSmtpConfig()

  const client = new SMTPClient({
    connection: {
      hostname: config.hostname,
      port: config.port,
      tls: true,
      auth: {
        username: config.username,
        password: config.password,
      },
    },
  })

  try {
    await client.send({
      from: config.from,
      to: options.to,
      replyTo: options.replyTo,
      subject: options.subject,
      content: options.text ?? options.subject,
      html: options.html,
    })
  } finally {
    await client.close()
  }
}

// ─── Brand constants ─────────────────────────────────────────────────────────

const ACCENT = '#3B82F6'
const FONT = "'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,'Helvetica Neue',Arial,sans-serif"
const APP_URL = Deno.env.get('APP_URL') ?? 'https://valrano.com'

// ─── Shared inline styles ────────────────────────────────────────────────────

const ST = {
  h1: 'margin:0 0 16px;font-family:' + FONT + ';font-size:22px;font-weight:700;color:#18181b;',
  p: 'margin:0 0 12px;font-family:' + FONT + ';font-size:15px;color:#3f3f46;line-height:1.6;',
  hint: 'margin:16px 0 0;font-family:' + FONT + ';font-size:13px;color:#a1a1aa;',
  strong: 'font-weight:600;color:#18181b;',
} as const

// ─── Layout ──────────────────────────────────────────────────────────────────

function layout(body: string): string {
  return [
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
    '<html xmlns="http://www.w3.org/1999/xhtml">',
    '<head>',
    '<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    '<title>Valrano</title>',
    '</head>',
    '<body style="margin:0;padding:0;font-family:' + FONT + ';background-color:#f4f4f5;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">',
    '<!--[if mso | IE]><table role="presentation" width="100%" bgcolor="#f4f4f5"><tr><td align="center"><![endif]-->',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f4f5;">',
    '<tr>',
    '<td align="center" style="padding:40px 16px;">',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="480" style="max-width:480px;width:100%;">',
    '<tr>',
    '<td align="center" style="padding-bottom:28px;">',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">',
    '<tr>',
    '<td style="vertical-align:middle;padding-right:10px;">',
    '<img src="https://valrano.com/apple-touch-icon.png" alt="" width="28" height="28" style="display:block;width:28px;height:28px;border-radius:6px;" />',
    '</td>',
    '<td style="vertical-align:middle;">',
    '<span style="font-family:' + FONT + ';font-size:20px;font-weight:700;color:#18181b;letter-spacing:-0.02em;">Valrano</span>',
    '</td>',
    '</tr>',
    '</table>',
    '</td>',
    '</tr>',
    '<tr>',
    '<td style="background-color:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:36px 32px;" bgcolor="#ffffff">',
    body,
    '</td>',
    '</tr>',
    '<tr>',
    '<td align="center" style="padding-top:24px;">',
    '<p style="margin:0;font-family:' + FONT + ';font-size:12px;color:#a1a1aa;line-height:1.5;">&copy; ' + new Date().getFullYear() + ' Valrano by Predivo GmbH. All rights reserved.</p>',
    '<p style="margin:6px 0 0;font-family:' + FONT + ';font-size:11px;color:#a1a1aa;">Swiss-made &middot; Software that Thinks Ahead</p>',
    '<p style="margin:8px 0 0;font-family:' + FONT + ';font-size:12px;color:#a1a1aa;">You&rsquo;re receiving this because you have a Valrano account.</p>',
    '</td>',
    '</tr>',
    '</table>',
    '</td>',
    '</tr>',
    '</table>',
    '<!--[if mso | IE]></td></tr></table><![endif]-->',
    '</body>',
    '</html>',
  ].join('\n')
}

// ─── Button ──────────────────────────────────────────────────────────────────

function button(text: string, href: string): string {
  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:24px auto 0;">',
    '<tr>',
    '<td align="center" bgcolor="' + ACCENT + '" style="background-color:' + ACCENT + ';border-radius:8px;mso-padding-alt:14px 40px;">',
    '<a href="' + href + '" target="_blank" style="display:inline-block;font-family:' + FONT + ';font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;padding:14px 40px;mso-line-height-rule:exactly;line-height:normal;">',
    '<!--[if mso]>&nbsp;&nbsp;&nbsp;<![endif]-->' + text + '<!--[if mso]>&nbsp;&nbsp;&nbsp;<![endif]-->',
    '</a>',
    '</td>',
    '</tr>',
    '</table>',
  ].join('')
}

// ─── OTP block ──────────────────────────────────────────────────────────────

function otpBlock(token: string): string {
  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0;">',
    '<tr>',
    '<td style="background-color:#EFF6FF;border:1px solid ' + ACCENT + '44;border-left:4px solid ' + ACCENT + ';border-radius:8px;padding:24px;text-align:center;" bgcolor="#EFF6FF">',
    '<p style="font-size:36px;font-weight:700;letter-spacing:10px;color:#18181b;margin:0;font-family:\'Courier New\',monospace;">' + token + '</p>',
    '</td>',
    '</tr>',
    '</table>',
    '<p style="margin:4px 0 0;font-family:' + FONT + ';font-size:13px;color:#a1a1aa;text-align:center;">Valid for 10 minutes.</p>',
  ].join('')
}

// ─── Auth Email Templates ───────────────────────────────────────────────────

export interface AuthEmailPayload {
  user: {
    email: string
    user_metadata?: Record<string, unknown>
  }
  email_data: {
    token: string
    token_hash: string
    redirect_to: string
    email_action_type: string
    site_url: string
    token_new?: string
    token_hash_new?: string
  }
}

function buildActionUrl(payload: AuthEmailPayload): string {
  const { token_hash, email_action_type, redirect_to, site_url } = payload.email_data
  const type = email_action_type === 'signup' ? 'signup' :
               email_action_type === 'recovery' ? 'recovery' :
               email_action_type === 'magiclink' ? 'magiclink' :
               email_action_type === 'email_change' ? 'email_change' :
               email_action_type
  // Use SUPABASE_URL env var, NOT site_url — GoTrue's site_url includes '/auth/v1'
  // which would produce a doubled path: /auth/v1/auth/v1/verify
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const redirectTo = redirect_to || APP_URL
  return supabaseUrl + '/auth/v1/verify?token=' + token_hash + '&type=' + type + '&redirect_to=' + encodeURIComponent(redirectTo)
}

export function getAuthEmailContent(payload: AuthEmailPayload): { subject: string; html: string } {
  const { email_action_type, token } = payload.email_data
  const actionUrl = buildActionUrl(payload)

  switch (email_action_type) {
    case 'signup':
      return {
        subject: 'Valrano \u2013 Your verification code: ' + token,
        html: layout(
          '<h1 style="' + ST.h1 + '">Confirm your email</h1>' +
          '<p style="' + ST.p + '">Enter this code on the signup page to verify your email and create your Valrano account.</p>' +
          otpBlock(token) +
          '<p style="' + ST.hint + '">If you didn&rsquo;t create an account, you can safely ignore this email.</p>'
        ),
      }

    case 'magiclink':
      return {
        subject: 'Your Valrano login code: ' + token,
        html: layout(
          '<h1 style="' + ST.h1 + '">Sign in</h1>' +
          '<p style="' + ST.p + '">Enter this code on the login page to sign in to your Valrano account.</p>' +
          otpBlock(token) +
          '<p style="' + ST.hint + '">If you didn&rsquo;t request this, you can safely ignore this email.</p>'
        ),
      }

    case 'recovery':
      return {
        subject: 'Valrano \u2013 Reset your password',
        html: layout(
          '<h1 style="' + ST.h1 + '">Reset your password</h1>' +
          '<p style="' + ST.p + '">Click the button below to reset your password.</p>' +
          button('Reset Password', actionUrl) +
          '<p style="' + ST.hint + '">If you didn&rsquo;t request this, you can safely ignore this email.</p>'
        ),
      }

    case 'email_change':
      return {
        subject: 'Valrano \u2013 Confirm email change',
        html: layout(
          '<h1 style="' + ST.h1 + '">Confirm email change</h1>' +
          '<p style="' + ST.p + '">Confirm the change to your email address.</p>' +
          button('Confirm Email', actionUrl) +
          '<p style="' + ST.hint + '">If you didn&rsquo;t make this change, secure your account immediately.</p>'
        ),
      }

    default:
      return {
        subject: 'Valrano \u2013 Action required',
        html: layout(
          '<h1 style="' + ST.h1 + '">Action required</h1>' +
          '<p style="' + ST.p + '">Your verification code:</p>' +
          otpBlock(token) +
          button('Continue', actionUrl)
        ),
      }
  }
}

// ─── Transactional Templates ────────────────────────────────────────────────

export function welcomeEmail(userName: string): { subject: string; html: string } {
  const firstName = userName.split(' ')[0]
  return {
    subject: 'Welcome to Valrano, ' + firstName + '!',
    html: layout(
      '<h1 style="' + ST.h1 + '">Welcome to Valrano, ' + firstName + '</h1>' +
      '<p style="' + ST.p + '">Your benchmarking workspace is ready. Valrano automates peer benchmarking &mdash; from report ingestion to board-ready briefings.</p>' +
      '<p style="' + ST.p + 'margin-bottom:4px;">Here&rsquo;s what happens next:</p>' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px;">' +
      '<tr>' +
      '<td style="padding:12px 0;border-bottom:1px solid #f4f4f5;font-family:' + FONT + ';font-size:15px;color:#3f3f46;line-height:1.6;">' +
      '<span style="' + ST.strong + '">1. Set up your peer group</span><br />' +
      'Select your accounting framework and add the companies you benchmark against.' +
      '</td>' +
      '</tr>' +
      '<tr>' +
      '<td style="padding:12px 0;border-bottom:1px solid #f4f4f5;font-family:' + FONT + ';font-size:15px;color:#3f3f46;line-height:1.6;">' +
      '<span style="' + ST.strong + '">2. Upload or schedule reports</span><br />' +
      'Drop a PDF or let Valrano monitor IR pages automatically.' +
      '</td>' +
      '</tr>' +
      '<tr>' +
      '<td style="padding:12px 0;font-family:' + FONT + ';font-size:15px;color:#3f3f46;line-height:1.6;">' +
      '<span style="' + ST.strong + '">3. Get AI-powered benchmarks</span><br />' +
      'KPIs are extracted, normalized, and compared across your peer group.' +
      '</td>' +
      '</tr>' +
      '</table>' +
      button('Complete Setup', APP_URL + '/dashboard') +
      '<p style="' + ST.hint + '">Questions? Contact us at <a href="mailto:hello@valrano.com" style="color:' + ACCENT + ';text-decoration:none;">hello@valrano.com</a></p>'
    ),
  }
}

export function demoConfirmationEmail(userName: string): { subject: string; html: string } {
  const firstName = userName.split(' ')[0]
  return {
    subject: 'Valrano — Your demo request has been received',
    html: layout(
      '<h1 style="' + ST.h1 + '">Thank you for your interest in Valrano</h1>' +
      '<p style="' + ST.p + '">Dear ' + firstName + ',</p>' +
      '<p style="' + ST.p + '">We have received your demo request and appreciate your interest in our platform. A member of our team will reach out to you within one business day to schedule a personalized walkthrough tailored to your organization.</p>' +
      '<p style="' + ST.p + '">During the demo, we will walk you through how Valrano automates peer benchmarking for your specific peer group and KPI taxonomy &mdash; from automated report detection to board-ready briefings.</p>' +
      '<p style="' + ST.hint + '">If you have any questions in the meantime, please contact us at <a href="mailto:hello@valrano.com" style="color:' + ACCENT + ';text-decoration:none;">hello@valrano.com</a>.</p>'
    ),
  }
}

export function accountDeletedEmail(userName: string): { subject: string; html: string } {
  const firstName = userName.split(' ')[0]
  return {
    subject: 'Your Valrano account has been deleted',
    html: layout(
      '<h1 style="' + ST.h1 + '">Account deleted, ' + firstName + '</h1>' +
      '<p style="' + ST.p + '">Your Valrano account and all associated data have been permanently deleted as requested.</p>' +
      '<p style="' + ST.p + '">If this was a mistake or you&rsquo;d like to come back, you&rsquo;re welcome to sign up again anytime.</p>' +
      '<p style="' + ST.hint + '">We&rsquo;re sorry to see you go. If you have feedback, reply to this email &mdash; we&rsquo;d love to hear how we can improve.</p>'
    ),
  }
}
