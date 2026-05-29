import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'

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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { user, adminClient } = await authenticateRequest(req)

    const { report_id } = await req.json()
    if (!report_id) {
      return jsonResponse({ error: 'Missing required field: report_id' }, 400)
    }

    // 1. Load report with source_url
    const { data: report, error: reportError } = await adminClient
      .from('reports')
      .select('id, company_id, source_url, status, pdf_storage_path')
      .eq('id', report_id)
      .single()

    if (reportError) throw new Error(`Report lookup failed: ${reportError.message}`)
    if (!report) return jsonResponse({ error: `Report not found: ${report_id}` }, 404)

    // Data isolation: verify report's company is in user's peer groups
    const { data: visibleIds } = await adminClient
      .rpc('visible_company_ids_for_user', { p_user_id: user.id })
    const visible = new Set((visibleIds ?? []) as string[])
    if (!visible.has(report.company_id)) {
      return jsonResponse({ error: 'Report belongs to a company not in your peer groups' }, 403)
    }

    if (!report.source_url) {
      return jsonResponse({ error: 'Report has no source_url' }, 400)
    }

    // Skip if already downloaded
    if (report.pdf_storage_path) {
      return jsonResponse({
        success: true,
        already_downloaded: true,
        pdf_storage_path: report.pdf_storage_path,
      })
    }

    // 2. SSRF check + Fetch the PDF
    if (!isPublicUrl(report.source_url)) {
      return jsonResponse({ error: 'Source URL targets a private/reserved network' }, 400)
    }
    const pdfResponse = await fetch(report.source_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/pdf,*/*',
      },
    })
    if (!pdfResponse.ok) {
      // Mark report as error so it doesn't stay pending forever
      await adminClient.from('reports').update({ status: 'error' }).eq('id', report_id)
      return jsonResponse({ error: `PDF download failed: ${pdfResponse.status} ${pdfResponse.statusText}`, source_url: report.source_url }, 502)
    }

    const pdfBuffer = await pdfResponse.arrayBuffer()
    const pdfBytes = new Uint8Array(pdfBuffer)

    // Validate we got an actual PDF, not an HTML error page
    const contentType = pdfResponse.headers.get('Content-Type') ?? ''
    const isPdfContentType = contentType.includes('pdf') || contentType.includes('octet-stream')
    const hasPdfMagic = pdfBytes.length >= 4 && pdfBytes[0] === 0x25 && pdfBytes[1] === 0x50 && pdfBytes[2] === 0x44 && pdfBytes[3] === 0x46 // %PDF
    if (!isPdfContentType && !hasPdfMagic) {
      await adminClient.from('reports').update({ status: 'error' }).eq('id', report_id)
      return jsonResponse({ error: `Downloaded file is not a PDF (Content-Type: ${contentType}, size: ${pdfBytes.length} bytes)`, source_url: report.source_url }, 422)
    }

    // 3. Upload to Supabase Storage bucket 'reports'
    const storagePath = `${report.company_id}/${report_id}.pdf`

    const { error: uploadError } = await adminClient.storage
      .from('reports')
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

    // 4. Update report row
    const { error: updateError } = await adminClient
      .from('reports')
      .update({
        pdf_storage_path: storagePath,
        status: 'processing',
      })
      .eq('id', report_id)

    if (updateError) throw new Error(`Report update failed: ${updateError.message}`)

    return jsonResponse({
      success: true,
      pdf_storage_path: storagePath,
      size_bytes: pdfBytes.length,
      status: 'processing',
    })
  } catch (err) {
    return errorResponse(err)
  }
})
