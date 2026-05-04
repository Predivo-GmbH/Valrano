/**
 * Shared SMTP email module for BenchmarkSignal transactional emails.
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
  const from = Deno.env.get('SMTP_FROM') ?? 'BenchmarkSignal <noreply@benchmarksignal.predivo.ch>'

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
const APP_URL = Deno.env.get('APP_URL') ?? 'https://benchmarksignal.predivo.ch'

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
    '<title>BenchmarkSignal</title>',
    '</head>',
    '<body style="margin:0;padding:0;font-family:' + FONT + ';background-color:#f4f4f5;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">',
    '<!--[if mso | IE]><table role="presentation" width="100%" bgcolor="#f4f4f5"><tr><td align="center"><![endif]-->',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f4f5;">',
    '<tr>',
    '<td align="center" style="padding:40px 16px;">',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="480" style="max-width:480px;width:100%;">',
    '<tr>',
    '<td align="center" style="padding-bottom:28px;">',
    '<span style="font-family:' + FONT + ';font-size:20px;font-weight:700;color:#18181b;letter-spacing:-0.02em;">BenchmarkSignal</span>',
    '</td>',
    '</tr>',
    '<tr>',
    '<td style="background-color:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:36px 32px;" bgcolor="#ffffff">',
    body,
    '</td>',
    '</tr>',
    '<tr>',
    '<td align="center" style="padding-top:24px;">',
    '<p style="margin:0;font-family:' + FONT + ';font-size:12px;color:#a1a1aa;line-height:1.5;">&copy; ' + new Date().getFullYear() + ' BenchmarkSignal &middot; Predivo GmbH</p>',
    '<p style="margin:8px 0 0;font-family:' + FONT + ';font-size:12px;color:#a1a1aa;">You&rsquo;re receiving this because you have a BenchmarkSignal account.</p>',
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

// ─── Templates ───────────────────────────────────────────────────────────────

export function welcomeEmail(userName: string): { subject: string; html: string } {
  const firstName = userName.split(' ')[0]
  return {
    subject: 'Welcome to BenchmarkSignal, ' + firstName + '!',
    html: layout(
      '<h1 style="' + ST.h1 + '">Welcome aboard, ' + firstName + '!</h1>' +
      '<p style="' + ST.p + '">Your BenchmarkSignal account is ready. Here&rsquo;s how to get started:</p>' +
      '<ol style="margin:0 0 12px;padding-left:20px;font-family:' + FONT + ';font-size:15px;color:#3f3f46;line-height:1.8;">' +
      '<li>Upload your first annual report (PDF)</li>' +
      '<li>AI extracts and normalizes your KPIs automatically</li>' +
      '<li>Review benchmarks against industry peers</li>' +
      '</ol>' +
      button('Go to Dashboard', APP_URL + '/dashboard') +
      '<p style="' + ST.hint + '">Need help? Just reply to this email &mdash; we read every message.</p>'
    ),
  }
}

export function accountDeletedEmail(userName: string): { subject: string; html: string } {
  const firstName = userName.split(' ')[0]
  return {
    subject: 'Your BenchmarkSignal account has been deleted',
    html: layout(
      '<h1 style="' + ST.h1 + '">Account deleted, ' + firstName + '</h1>' +
      '<p style="' + ST.p + '">Your BenchmarkSignal account and all associated data have been permanently deleted as requested.</p>' +
      '<p style="' + ST.p + '">If this was a mistake or you&rsquo;d like to come back, you&rsquo;re welcome to sign up again anytime.</p>' +
      '<p style="' + ST.hint + '">We&rsquo;re sorry to see you go. If you have feedback, reply to this email &mdash; we&rsquo;d love to hear how we can improve.</p>'
    ),
  }
}
