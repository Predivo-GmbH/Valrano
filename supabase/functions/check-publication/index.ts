import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { logError } from '../_shared/error-log.ts'

/** Reject URLs targeting internal/private networks (SSRF prevention) */
function isPublicUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (!['http:', 'https:'].includes(u.protocol)) return false
    const host = u.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return false
    if (host.endsWith('.local') || host.endsWith('.internal')) return false
    if (/^10\./.test(host) || /^192\.168\./.test(host)) return false
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false
    if (host.startsWith('169.254.')) return false
    if (host === '0.0.0.0' || host.startsWith('0.')) return false
    return true
  } catch {
    return false
  }
}

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
      if (!isPublicUrl(event.direct_pdf_url)) {
        errorMessage = 'URL targets a private/reserved network'
      } else try {
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
    // 3. Else check IR page — extract ALL PDFs, upsert to catalog, match event
    else {
      const irPageUrl = event.ir_page_url ?? company.ir_page_url
      if (irPageUrl && !isPublicUrl(irPageUrl)) {
        errorMessage = 'IR page URL targets a private/reserved network'
      } else if (irPageUrl) {
        try {
          const pageResp = await fetch(irPageUrl)
          if (pageResp.ok) {
            const html = await pageResp.text()

            // Extract ALL PDF links from the page
            const allPdfUrls = new Set<string>()
            for (const pattern of PDF_PATTERNS) {
              pattern.lastIndex = 0
              let match: RegExpExecArray | null
              while ((match = pattern.exec(html)) !== null) {
                if (match[1]) {
                  const resolved = match[1].startsWith('http')
                    ? match[1]
                    : new URL(match[1], irPageUrl).href
                  if (isPublicUrl(resolved)) allPdfUrls.add(resolved)
                }
              }
            }

            // Also catch generic .pdf hrefs not matched by named patterns
            const genericPdf = /href=["']([^"']+\.pdf)(?:[?#][^"']*)?["']/gi
            let gMatch: RegExpExecArray | null
            while ((gMatch = genericPdf.exec(html)) !== null) {
              if (gMatch[1]) {
                const resolved = gMatch[1].startsWith('http')
                  ? gMatch[1]
                  : new URL(gMatch[1], irPageUrl).href
                if (isPublicUrl(resolved)) allPdfUrls.add(resolved)
              }
            }

            // Upsert discovered PDFs into ir_catalog_items (incremental catalog update)
            if (allPdfUrls.size > 0) {
              const catalogRows = [...allPdfUrls].slice(0, 50).map((url) => {
                // Derive title from filename
                const filename = decodeURIComponent(url.split('/').pop() ?? '').replace(/\.pdf$/i, '').replace(/[-_]/g, ' ')
                return {
                  company_id: company.id,
                  document_url: url,
                  title: filename.slice(0, 200),
                  document_type: 'other' as const,
                  file_format: 'pdf' as const,
                  detected_at: new Date().toISOString(),
                  ai_classified: false,
                }
              })

              await adminClient
                .from('ir_catalog_items')
                .upsert(catalogRows, { onConflict: 'company_id,url_hash', ignoreDuplicates: true })
            }

            // Match against event criteria: report_type + fiscal_year in URL/filename
            const yearStr = String(event.fiscal_year)
            const typeKeywords: Record<string, string[]> = {
              annual: ['annual', 'jahres', 'geschaeft', 'yearly'],
              quarterly: ['quarterly', 'quartals', 'halbjahres', 'q1', 'q2', 'q3', 'q4'],
              half_year: ['half', 'halbjahr', 'h1', 'h2', 'semi'],
              sustainability: ['sustain', 'esg', 'csr', 'nachhaltig'],
            }
            const keywords = typeKeywords[event.report_type] ?? [event.report_type]

            for (const url of allPdfUrls) {
              const lower = url.toLowerCase()
              const hasYear = lower.includes(yearStr)
              const hasType = keywords.some((k) => lower.includes(k))
              if (hasYear && hasType) {
                foundUrl = url
                detected = true
                break
              }
            }

            // Fallback: if no exact match, use first PDF containing the year
            if (!detected) {
              for (const url of allPdfUrls) {
                if (url.toLowerCase().includes(yearStr)) {
                  foundUrl = url
                  detected = true
                  break
                }
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

      // Auto-trigger pipeline (download → extract → normalize → generate)
      if (report && event.auto_pipeline !== false) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const serviceKey = (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
        if (supabaseUrl && serviceKey) {
          fetch(`${supabaseUrl}/functions/v1/pipeline-orchestrator`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ report_id: report.id }),
          }).catch(err => logError('check-publication', 'pipeline_trigger', err, { eventId: publication_event_id }))
        }
      }

      return jsonResponse({
        success: true,
        detected: true,
        report_id: report?.id,
        found_url: foundUrl,
        pipeline_triggered: true,
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
