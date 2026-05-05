import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'

// PDF link detection patterns for annual/quarterly reports
const PDF_PATTERNS = [
  /href=["']([^"']*(?:annual|jahres|geschaefts)[\w-]*report[^"']*\.pdf)/gi,
  /href=["']([^"']*(?:quarterly|quartals|halbjahres)[\w-]*report[^"']*\.pdf)/gi,
  /href=["']([^"']*(?:financial|finanz)[\w-]*(?:report|bericht)[^"']*\.pdf)/gi,
  /href=["']([^"']*(?:FY|Q[1-4]|H[12])[\w-]*\d{4}[^"']*\.pdf)/gi,
  /href=["']([^"']*\d{4}[\w-]*(?:annual|report|bericht)[^"']*\.pdf)/gi,
]

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { adminClient } = await authenticateRequest(req)

    const { publication_event_id } = await req.json()
    if (!publication_event_id) {
      return jsonResponse({ error: 'Missing required field: publication_event_id' }, 400)
    }

    // 1. Load the publication event + company
    const { data: event, error: eventError } = await adminClient
      .from('publication_events')
      .select('*, companies(id, name, ir_page_url)')
      .eq('id', publication_event_id)
      .single()

    if (eventError) throw new Error(`Publication event lookup failed: ${eventError.message}`)
    if (!event) return jsonResponse({ error: `Publication event not found: ${publication_event_id}` }, 404)

    const company = event.companies as { id: string; name: string; ir_page_url: string | null }

    let detected = false
    let foundUrl: string | null = null
    let checkMethod: 'head_request' | 'html_scrape' | 'ai_parse' = 'html_scrape'
    let errorMessage: string | null = null
    const startTime = Date.now()

    // 2. If direct_pdf_url exists -> HEAD request, check Content-Type
    if (event.direct_pdf_url) {
      checkMethod = 'head_request'
      try {
        const headResp = await fetch(event.direct_pdf_url, { method: 'HEAD' })
        const contentType = headResp.headers.get('content-type') ?? ''
        if (contentType.includes('pdf')) {
          detected = true
          foundUrl = event.direct_pdf_url
        } else {
          errorMessage = `Wrong content-type: ${contentType}`
        }
      } catch (fetchErr) {
        errorMessage = `Fetch error: ${(fetchErr as Error).message}`
      }
    }
    // 3. Else check IR page for new PDF links
    else {
      const irPageUrl = event.ir_page_url ?? company.ir_page_url
      if (irPageUrl) {
        try {
          const pageResp = await fetch(irPageUrl)
          if (pageResp.ok) {
            const html = await pageResp.text()

            for (const pattern of PDF_PATTERNS) {
              pattern.lastIndex = 0
              const match = pattern.exec(html)
              if (match?.[1]) {
                const resolvedUrl = match[1].startsWith('http')
                  ? match[1]
                  : new URL(match[1], irPageUrl).href
                foundUrl = resolvedUrl
                detected = true
                break
              }
            }
          } else {
            errorMessage = `IR page returned ${pageResp.status}`
          }
        } catch (fetchErr) {
          errorMessage = `IR page fetch error: ${(fetchErr as Error).message}`
        }
      } else {
        errorMessage = 'No IR page URL configured'
      }
    }

    const responseTimeMs = Date.now() - startTime

    // 4. Log result to monitor_checks table
    await adminClient.from('monitor_checks').insert({
      publication_event_id,
      check_method: checkMethod,
      result: detected ? 'found' : (errorMessage ? 'error' : 'not_found'),
      found_url: foundUrl,
      error_message: errorMessage,
      response_time_ms: responseTimeMs,
    })

    // 5. If found: update event status
    if (detected && foundUrl) {
      await adminClient
        .from('publication_events')
        .update({
          status: 'detected',
          actual_detected_at: new Date().toISOString(),
          direct_pdf_url: foundUrl,
        })
        .eq('id', publication_event_id)

      // Create a report entry
      const { data: report } = await adminClient
        .from('reports')
        .insert({
          company_id: company.id,
          report_type: event.report_type,
          fiscal_year: event.fiscal_year,
          fiscal_quarter: event.fiscal_quarter,
          source_url: foundUrl,
          status: 'pending',
        })
        .select()
        .single()

      // Link report to event
      if (report) {
        await adminClient
          .from('publication_events')
          .update({ report_id: report.id })
          .eq('id', publication_event_id)
      }

      // Notify if configured
      if (event.notify_on_detection && event.created_by) {
        await adminClient.from('notifications').insert({
          user_id: event.created_by,
          type: 'report_detected',
          title: `Report detected: ${company.name}`,
          body: `${event.report_type} report for FY${event.fiscal_year} was found.`,
          link: report ? `/review/${report.id}` : null,
          related_report_id: report?.id ?? null,
        })
      }

      return jsonResponse({
        success: true,
        detected: true,
        report_id: report?.id,
        found_url: foundUrl,
      })
    }

    return jsonResponse({
      success: true,
      detected: false,
      error_message: errorMessage,
    })
  } catch (err) {
    return errorResponse(err)
  }
})
