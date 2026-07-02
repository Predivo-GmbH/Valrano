import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'

/**
 * send-document-notification — Email notification for document events
 *
 * Sends email notifications via Metanet SMTP when:
 * - A benchmark document is ready for approval
 * - An approval step is assigned to a reviewer
 * - A document is approved or rejected
 */

interface SmtpConfig {
  host: string
  port: number
  user: string
  pass: string
  from: string
}

function getSmtpConfig(): SmtpConfig {
  const host = Deno.env.get('SMTP_HOST')
  const port = Deno.env.get('SMTP_PORT')
  const user = Deno.env.get('SMTP_USER')
  const pass = Deno.env.get('SMTP_PASS')
  const from = Deno.env.get('SMTP_FROM') ?? 'noreply@valrano.com'

  if (!host || !port || !user || !pass) {
    throw new Error('Missing SMTP configuration (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)')
  }

  return { host, port: parseInt(port, 10), user, pass, from }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { user, adminClient } = await authenticateRequest(req)

    const { document_id, notification_type, recipient_email, recipient_name } = await req.json()
    if (!document_id || !notification_type || !recipient_email) {
      return jsonResponse({
        error: 'Missing required fields: document_id, notification_type, recipient_email',
      }, 400)
    }

    // Load document info + ownership
    const { data: doc, error: docError } = await adminClient
      .from('benchmark_documents')
      .select('id, title, status, fiscal_year, trigger_company_id, companies:trigger_company_id(name), benchmark_rules(delivery_recipients, created_by)')
      .eq('id', document_id)
      .single()

    if (docError) throw new Error(`Document lookup failed: ${docError.message}`)

    // Ownership check: caller must own the benchmark rule
    const rule = doc.benchmark_rules as { delivery_recipients?: string[]; created_by?: string } | null
    if (rule?.created_by && rule.created_by !== user.id) {
      return jsonResponse({ error: 'You do not own this document' }, 403)
    }

    // Recipient must be in the configured delivery_recipients list
    const allowedRecipients = rule?.delivery_recipients ?? []
    if (!allowedRecipients.includes(recipient_email)) {
      return jsonResponse({ error: 'Recipient not in delivery recipients list' }, 403)
    }

    const companyName = (doc.companies as { name: string } | null)?.name ?? 'Unknown'
    const smtp = getSmtpConfig()

    // Build email content based on notification type
    let subject: string
    let bodyHtml: string

    switch (notification_type) {
      case 'approval_required':
        subject = `[Valrano] Review Required: ${doc.title}`
        bodyHtml = buildEmailHtml({
          heading: 'Document Awaiting Your Review',
          body: `A new benchmark document requires your approval.`,
          details: [
            `Document: ${doc.title}`,
            `Company: ${companyName}`,
            `Fiscal Year: ${doc.fiscal_year}`,
          ],
          ctaText: 'Review Document',
          ctaUrl: `https://valrano.com/documents/${document_id}`,
          recipientName: recipient_name,
        })
        break

      case 'document_approved':
        subject = `[Valrano] Document Approved: ${doc.title}`
        bodyHtml = buildEmailHtml({
          heading: 'Document Approved',
          body: `Your benchmark document has been fully approved and is ready for delivery.`,
          details: [
            `Document: ${doc.title}`,
            `Company: ${companyName}`,
          ],
          ctaText: 'View Document',
          ctaUrl: `https://valrano.com/documents/${document_id}`,
          recipientName: recipient_name,
        })
        break

      case 'changes_requested':
        subject = `[Valrano] Changes Requested: ${doc.title}`
        bodyHtml = buildEmailHtml({
          heading: 'Changes Requested',
          body: `A reviewer has requested changes on the benchmark document.`,
          details: [
            `Document: ${doc.title}`,
            `Company: ${companyName}`,
          ],
          ctaText: 'View Feedback',
          ctaUrl: `https://valrano.com/documents/${document_id}`,
          recipientName: recipient_name,
        })
        break

      default:
        return jsonResponse({ error: `Unknown notification_type: ${notification_type}` }, 400)
    }

    // Send via SMTP using Deno's native TLS connection
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const conn = await Deno.connectTls({
      hostname: smtp.host,
      port: smtp.port,
    })

    async function sendLine(line: string) {
      await conn.write(encoder.encode(line + '\r\n'))
    }

    async function readResponse(): Promise<string> {
      const buf = new Uint8Array(1024)
      const n = await conn.read(buf)
      return n ? decoder.decode(buf.subarray(0, n)) : ''
    }

    // SMTP handshake
    await readResponse() // greeting
    await sendLine(`EHLO valrano.com`)
    await readResponse()

    // AUTH LOGIN
    await sendLine('AUTH LOGIN')
    await readResponse()
    await sendLine(btoa(smtp.user))
    await readResponse()
    await sendLine(btoa(smtp.pass))
    await readResponse()

    // MAIL FROM / RCPT TO
    await sendLine(`MAIL FROM:<${smtp.from}>`)
    await readResponse()
    await sendLine(`RCPT TO:<${recipient_email}>`)
    await readResponse()

    // DATA
    await sendLine('DATA')
    await readResponse()

    const message = [
      `From: Valrano <${smtp.from}>`,
      `To: ${recipient_name ? `${recipient_name} <${recipient_email}>` : recipient_email}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      bodyHtml,
    ].join('\r\n')

    await sendLine(message)
    await sendLine('.')
    await readResponse()
    await sendLine('QUIT')
    conn.close()

    return jsonResponse({
      success: true,
      notification_type,
      recipient: recipient_email,
    })
  } catch (err) {
    return errorResponse(err)
  }
})

function buildEmailHtml(opts: {
  heading: string
  body: string
  details: string[]
  ctaText: string
  ctaUrl: string
  recipientName?: string
}): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<div style="max-width:480px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
  <div style="padding:24px 32px;background:#0f172a;text-align:center">
    <span style="font-size:14px;font-weight:600;color:#3b82f6;letter-spacing:0.05em">VALRANO</span>
  </div>
  <div style="padding:32px">
    ${opts.recipientName ? `<p style="font-size:14px;color:#64748b;margin:0 0 16px 0">Hi ${opts.recipientName},</p>` : ''}
    <h1 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 12px 0">${opts.heading}</h1>
    <p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 20px 0">${opts.body}</p>
    <div style="background:#f1f5f9;border-radius:6px;padding:16px;margin-bottom:24px">
      ${opts.details.map(d => `<div style="font-size:13px;color:#475569;margin-bottom:4px">${d}</div>`).join('')}
    </div>
    <div style="text-align:center">
      <a href="${opts.ctaUrl}" style="display:inline-block;padding:12px 24px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600">${opts.ctaText}</a>
    </div>
  </div>
  <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
    <span style="font-size:11px;color:#94a3b8">&copy; ${new Date().getFullYear()} Valrano by Predivo GmbH. All rights reserved.</span>
    <br><span style="font-size:10px;color:#94a3b8">Swiss-made</span>
  </div>
</div>
</body>
</html>`
}
