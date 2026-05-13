import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'

/**
 * deliver-document — Send approved benchmark document to recipients
 *
 * Takes a document_id, verifies it's approved, then:
 * 1. Renders PDF (if not already done)
 * 2. Sends email with PDF attachment to configured recipients
 * 3. Marks document as 'delivered'
 */

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { user, adminClient } = await authenticateRequest(req)
    const authHeader = req.headers.get('Authorization')!

    const { document_id } = await req.json()
    if (!document_id) {
      return jsonResponse({ error: 'Missing required field: document_id' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    if (!supabaseUrl) throw new Error('SUPABASE_URL not set')

    // 1. Load the benchmark document
    const { data: doc, error: docError } = await adminClient
      .from('benchmark_documents')
      .select(`
        id, title, status, pdf_storage_path,
        benchmark_rules(id, name, delivery_recipients, customer_company_id, created_by),
        trigger_company_id
      `)
      .eq('id', document_id)
      .single()

    if (docError) throw new Error(`Document lookup failed: ${docError.message}`)
    if (!doc) return jsonResponse({ error: 'Document not found' }, 404)

    // Ownership check: user must own the benchmark rule
    const ruleCreator = (doc.benchmark_rules as { created_by?: string } | null)?.created_by
    if (ruleCreator && ruleCreator !== user.id) {
      return jsonResponse({ error: 'You do not own this document' }, 403)
    }

    if (doc.status !== 'approved') {
      return jsonResponse({ error: `Document status is '${doc.status}', must be 'approved'` }, 400)
    }

    const rule = doc.benchmark_rules as {
      id: string
      name: string
      delivery_recipients: string[] | null
      customer_company_id: string
    } | null

    // 2. Render PDF if not already done
    if (!doc.pdf_storage_path) {
      const renderResp = await fetch(`${supabaseUrl}/functions/v1/render-benchmark-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ document_id }),
      })

      if (!renderResp.ok) {
        const errText = await renderResp.text()
        throw new Error(`PDF render failed: ${errText}`)
      }
    }

    // 3. Send email notification to delivery recipients
    const recipients = rule?.delivery_recipients ?? []
    const emailsSent: string[] = []

    for (const email of recipients) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-document-notification`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            document_id,
            notification_type: 'document_approved',
            recipient_email: email,
          }),
        })
        emailsSent.push(email)
      } catch (emailErr) {
        console.error(`Failed to send to ${email}:`, emailErr)
      }
    }

    // 4. Mark document as delivered
    await adminClient
      .from('benchmark_documents')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
      })
      .eq('id', document_id)

    // 5. Update linked publication event
    const { data: reports } = await adminClient
      .from('reports')
      .select('id')
      .eq('id', doc.trigger_company_id)

    if (reports && reports.length > 0) {
      await adminClient
        .from('publication_events')
        .update({ status: 'delivered' })
        .eq('report_id', reports[0].id)
    }

    return jsonResponse({
      success: true,
      document_id,
      status: 'delivered',
      emails_sent: emailsSent,
      pdf_storage_path: doc.pdf_storage_path,
    })
  } catch (err) {
    return errorResponse(err)
  }
})
