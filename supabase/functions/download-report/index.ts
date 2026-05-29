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
    if (/^172\/(1[6-9]|2\d|3[01])\./.test(host)) return false
    if (host.startsWith('169.254.')) return false
    if (host === '0.0.0.0' || host.startsWith('0.')) return false
    return true
  } catch {
    return false
  }
}

/** Strategy 1: Direct fetch with browser-like headers */
async function directDownload(url: string): Promise<{ pdf: Uint8Array } | { error: string }> {
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/pdf,*/*',
      },
      signal: AbortSignal.timeout(30000),
    })

    const buf = await resp.arrayBuffer()
    const bytes = new Uint8Array(buf)

    // Check for PDF regardless of HTTP status (some CDNs return 404 but serve the PDF)
    const contentType = resp.headers.get('Content-Type') ?? ''
    const isPdf = contentType.includes('pdf') || contentType.includes('octet-stream')
    const hasMagic = bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
    if (isPdf || hasMagic) {
      return { pdf: bytes }
    }

    return { error: `HTTP ${resp.status}, not a PDF (Content-Type: ${contentType}, size: ${bytes.length})` }
  } catch (err) {
    return { error: (err as Error).message }
  }
}

/** Strategy 2: Direct fetch with Referer header (some CDNs require it) */
async function directDownloadWithReferer(url: string): Promise<{ pdf: Uint8Array } | { error: string }> {
  try {
    const origin = new URL(url).origin
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/pdf,application/octet-stream,*/*',
        'Referer': origin + '/',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
      },
      signal: AbortSignal.timeout(30000),
    })
    if (!resp.ok) {
      return { error: `HTTP ${resp.status} ${resp.statusText}` }
    }

    const buf = await resp.arrayBuffer()
    const bytes = new Uint8Array(buf)

    const contentType = resp.headers.get('Content-Type') ?? ''
    const isPdf = contentType.includes('pdf') || contentType.includes('octet-stream')
    const hasMagic = bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
    if (!isPdf && !hasMagic) {
      return { error: `Not a PDF (Content-Type: ${contentType}, size: ${bytes.length})` }
    }

    return { pdf: bytes }
  } catch (err) {
    return { error: (err as Error).message }
  }
}

/** Strategy 3: Firecrawl browser-based scrape — extracts text from PDFs behind Cloudflare */
async function firecrawlScrape(url: string, apiKey: string): Promise<{ text: string } | { error: string }> {
  try {
    const resp = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        timeout: 60000,
      }),
      signal: AbortSignal.timeout(90000),
    })

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      return { error: `Firecrawl ${resp.status}: ${errText.slice(0, 200)}` }
    }

    const data = await resp.json()
    const markdown = data?.data?.markdown ?? ''

    if (markdown.length < 500) {
      return { error: `Firecrawl returned insufficient content (${markdown.length} chars)` }
    }

    // Reject Cloudflare challenge pages that Firecrawl couldn't bypass
    if (markdown.includes("checking your browser") || markdown.includes("Ray ID:")) {
      return { error: 'Firecrawl could not bypass Cloudflare protection' }
    }

    return { text: markdown }
  } catch (err) {
    return { error: `Firecrawl error: ${(err as Error).message}` }
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
      .select('id, company_id, source_url, status, pdf_storage_path, fallback_text')
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

    // Skip if already downloaded (PDF or text fallback)
    if (report.pdf_storage_path || report.fallback_text) {
      return jsonResponse({
        success: true,
        already_downloaded: true,
        pdf_storage_path: report.pdf_storage_path,
        used_fallback: !!report.fallback_text,
      })
    }

    // 2. SSRF check
    if (!isPublicUrl(report.source_url)) {
      return jsonResponse({ error: 'Source URL targets a private/reserved network' }, 400)
    }

    const strategies: string[] = []

    // --- Strategy 1: Direct fetch ---
    console.log(`[download-report] Strategy 1: direct fetch for ${report.source_url}`)
    const direct = await directDownload(report.source_url)
    if ('pdf' in direct) {
      strategies.push('direct: success')
      const storagePath = `${report.company_id}/${report_id}.pdf`
      const { error: uploadError } = await adminClient.storage
        .from('reports')
        .upload(storagePath, direct.pdf, { contentType: 'application/pdf', upsert: true })
      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

      await adminClient.from('reports').update({ pdf_storage_path: storagePath, status: 'processing' }).eq('id', report_id)
      return jsonResponse({ success: true, pdf_storage_path: storagePath, size_bytes: direct.pdf.length, status: 'processing', strategy: 'direct' })
    }
    strategies.push(`direct: ${direct.error}`)

    // --- Strategy 2: Direct fetch with Referer ---
    console.log(`[download-report] Strategy 2: direct+referer for ${report.source_url}`)
    const withReferer = await directDownloadWithReferer(report.source_url)
    if ('pdf' in withReferer) {
      strategies.push('referer: success')
      const storagePath = `${report.company_id}/${report_id}.pdf`
      const { error: uploadError } = await adminClient.storage
        .from('reports')
        .upload(storagePath, withReferer.pdf, { contentType: 'application/pdf', upsert: true })
      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

      await adminClient.from('reports').update({ pdf_storage_path: storagePath, status: 'processing' }).eq('id', report_id)
      return jsonResponse({ success: true, pdf_storage_path: storagePath, size_bytes: withReferer.pdf.length, status: 'processing', strategy: 'referer' })
    }
    strategies.push(`referer: ${withReferer.error}`)

    // --- Strategy 3: Firecrawl (handles Cloudflare, JS redirects, bot protection) ---
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY')
    if (firecrawlKey) {
      console.log(`[download-report] Strategy 3: Firecrawl scrape for ${report.source_url}`)
      const fcResult = await firecrawlScrape(report.source_url, firecrawlKey)
      if ('text' in fcResult) {
        strategies.push(`firecrawl: success (${fcResult.text.length} chars)`)
        await adminClient.from('reports').update({
          fallback_text: fcResult.text,
          status: 'processing',
        }).eq('id', report_id)
        return jsonResponse({ success: true, fallback_text_length: fcResult.text.length, status: 'processing', strategy: 'firecrawl' })
      }
      strategies.push(`firecrawl: ${fcResult.error}`)
    } else {
      strategies.push('firecrawl: FIRECRAWL_API_KEY not set')
    }

    // All strategies failed
    console.error(`[download-report] All strategies failed for ${report.source_url}:`, strategies)
    await adminClient.from('reports').update({ status: 'error' }).eq('id', report_id)
    return jsonResponse({
      error: 'All download strategies failed',
      source_url: report.source_url,
      strategies,
    }, 502)
  } catch (err) {
    return errorResponse(err)
  }
})
