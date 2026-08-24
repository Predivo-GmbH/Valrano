import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { sendEmail } from '../_shared/email.ts'
import { logError } from '../_shared/error-log.ts'

/**
 * send-document-notification — Email notification for document events
 *
 * Sends email notifications through the SHARED sendEmail() in _shared/email.ts when:
 * - A benchmark document is ready for approval
 * - An approval step is assigned to a reviewer
 * - A document is approved or rejected
 */

/*
 * This function used to read SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS itself and
 * hand-roll the SMTP conversation over Deno.connectTls. Two defects, both removed on
 * 2026-08-24:
 *
 * 1. A SECOND MAILER INHERITING A FIRST MAILER'S VARIABLES. _shared/email.ts owns those
 *    four secrets. This file borrowed them, so any change made for the shared mailer
 *    silently moved this one too. That is exactly how BackOffice support mail went dark
 *    for four days (2026-08-20 to 2026-08-24): commit 89f024a repointed a shared
 *    SMTP_HOST/SMTP_PORT at Postmark for one mailer, and a second mailer reading them as
 *    a fallback followed it onto a port its TLS mode could not speak. A shared env var is
 *    an undeclared dependency. There is now ONE mailer in this project.
 *
 * 2. IT REPORTED SUCCESS NO MATTER WHAT THE SERVER SAID. Every readResponse() result was
 *    discarded, so a rejected AUTH, a refused RCPT TO or a 5xx on DATA all ended in
 *    `{ success: true }`. Nothing was written anywhere and nobody was told. denomailer,
 *    used by the shared sendEmail(), throws on a bad reply code - so a failure is now a
 *    500 to the caller plus an error_log row and a Sentry event (Rule 67).
 */

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

    // One mailer, one config: _shared/email.ts owns the SMTP secrets and validates that
    // the port matches its TLS mode. It throws on any bad SMTP reply code, so a failure
    // here reaches the catch below instead of being reported as a successful send.
    try {
      await sendEmail({
        to: recipient_email,
        subject,
        html: bodyHtml,
      })
    } catch (sendErr) {
      // A customer or reviewer is waiting on a document notification that did not go out.
      // Record it where a human can find it (error_log + Sentry via logError) and return a
      // 500 - never a success.
      await logError('send-document-notification', 'sendEmail', sendErr, {
        document_id,
        notification_type,
        recipient_email,
      })
      throw sendErr
    }

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
