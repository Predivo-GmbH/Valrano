import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders, corsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { logAnthropicUsage } from '../_shared/log-usage.ts'

/**
 * scan-ir-page — One-time deep scrape of a company's IR page
 *
 * Discovers all linked documents, classifies them by type via Gemini,
 * extracts metadata, and upserts into ir_catalog_items.
 *
 * Triggered:
 *   - Manually by user ("Scan IR Page" button)
 *   - Auto after suggest-ir-url resolves a URL (if IR catalog toggle enabled)
 *
 * NOT called periodically. New documents caught by check-publication.
 */

const GEMINI_MODEL = 'gemini-2.5-flash'
const MAX_DOCUMENTS = 50

/** SSRF prevention — reject private/internal URLs */
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

interface DocumentLink {
  url: string
  text: string
  context: string
}

interface ClassifiedDocument {
  url: string
  title: string
  document_type: string
  fiscal_year: number | null
  fiscal_quarter: number | null
  language: string | null
  confidence: number
}

/** Extract all document links from HTML content */
function extractDocumentLinks(html: string, baseUrl: string): DocumentLink[] {
  const links: DocumentLink[] = []
  const seen = new Set<string>()

  // Match href links to downloadable files
  const hrefRegex = /href=["']([^"']+)["'][^>]*>([^<]*)/gi
  let match: RegExpExecArray | null

  while ((match = hrefRegex.exec(html)) !== null) {
    let url = match[1]
    const text = match[2].trim()

    // Skip anchors, javascript, mailto
    if (url.startsWith('#') || url.startsWith('javascript:') || url.startsWith('mailto:')) continue

    // Resolve relative URLs
    try {
      url = new URL(url, baseUrl).href
    } catch {
      continue
    }

    if (!isPublicUrl(url)) continue
    if (seen.has(url)) continue
    seen.add(url)

    // STRICT filter: only include actual downloadable document files
    // Navigation links to webpages (e.g. "Sustainable Finance", "Management Team")
    // are NOT documents and must be excluded
    const lowerUrl = url.toLowerCase()
    const isDownloadable = /\.(pdf|xlsx|xls|pptx|ppt|docx|doc|zip)(\?|$)/i.test(lowerUrl)

    // Only accept downloadable files — reject plain webpage links
    if (!isDownloadable) continue

    // Get surrounding context (approximate: use link text + nearby text)
    const linkPos = match.index
    const contextStart = Math.max(0, linkPos - 100)
    const contextEnd = Math.min(html.length, linkPos + match[0].length + 100)
    const context = html.slice(contextStart, contextEnd).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

    links.push({ url, text: text || url.split('/').pop() || url, context })
  }

  return links.slice(0, MAX_DOCUMENTS)
}

/** Extract sub-page links that likely contain report downloads (one level deeper) */
function extractReportSubPages(html: string, baseUrl: string): string[] {
  const subPages: string[] = []
  const seen = new Set<string>()
  const hrefRegex = /href=["']([^"']+)["'][^>]*>([^<]*)/gi
  let match: RegExpExecArray | null

  // Patterns that indicate a reports/publications sub-page
  const reportPagePattern = /\b(report|publication|financial-report|annual-report|download|document|filing|ergebnis|bericht|geschaeftsbericht)\b/i

  while ((match = hrefRegex.exec(html)) !== null) {
    let url = match[1]
    const text = match[2].trim()

    if (url.startsWith('#') || url.startsWith('javascript:') || url.startsWith('mailto:')) continue

    try {
      url = new URL(url, baseUrl).href
    } catch {
      continue
    }

    if (!isPublicUrl(url)) continue
    if (seen.has(url)) continue
    // Only follow links on the same domain
    try {
      const base = new URL(baseUrl)
      const target = new URL(url)
      if (base.hostname !== target.hostname) continue
    } catch { continue }

    // Skip downloadable files — we want HTML pages
    if (/\.(pdf|xlsx|xls|pptx|ppt|docx|doc|zip|jpg|png|gif|svg|css|js)(\?|$)/i.test(url)) continue

    // Check if URL or link text suggests a reports page
    if (reportPagePattern.test(url) || reportPagePattern.test(text)) {
      seen.add(url)
      subPages.push(url)
    }
  }

  // Limit to 3 sub-pages to control Firecrawl credit usage
  return subPages.slice(0, 3)
}

/** Extract file format from URL */
function getFileFormat(url: string): string | null {
  const match = url.match(/\.(pdf|xlsx|xls|pptx|ppt|docx|doc|zip)(\?|$)/i)
  return match ? match[1].toLowerCase() : null
}

/** Classify documents using Gemini */
async function classifyDocuments(
  documents: DocumentLink[],
  companyName: string,
  apiKey: string,
): Promise<{ classified: ClassifiedDocument[]; usage: { input_tokens: number; output_tokens: number } }> {
  const documentList = documents.map((d, i) => `${i + 1}. URL: ${d.url}\n   Link text: ${d.text}\n   Context: ${d.context}`).join('\n\n')

  const prompt = `You are analyzing the investor relations page of "${companyName}".
Below is a list of document links found on their IR page. For each document, classify it and extract metadata.

Documents:
${documentList}

For each document, return a JSON object with:
- "index": the document number (1-based)
- "title": a clean, human-readable title (use link text if good, otherwise derive from URL)
- "document_type": one of: "annual_report", "quarterly_report", "half_year_report", "sustainability_report", "investor_presentation", "press_release", "financial_statements", "conference_call", "factsheet", "consensus", "other"
- "fiscal_year": the fiscal year as integer (e.g. 2025), or null if unclear
- "fiscal_quarter": quarter number 1-4 for quarterly reports, or null
- "language": ISO 639-1 code (e.g. "en", "de", "fr"), or null
- "confidence": 0.0 to 1.0 — how confident you are in the classification

Return a JSON array of objects. Only valid JSON, no markdown.`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
        },
      }),
    },
  )

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${await response.text()}`)
  }

  const result = await response.json()
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]'
  const usage = {
    input_tokens: result.usageMetadata?.promptTokenCount ?? 0,
    output_tokens: result.usageMetadata?.candidatesTokenCount ?? 0,
  }

  let parsed: Array<{
    index: number
    title: string
    document_type: string
    fiscal_year: number | null
    fiscal_quarter: number | null
    language: string | null
    confidence: number
  }>

  try {
    parsed = JSON.parse(text)
  } catch {
    console.error('Failed to parse Gemini response:', text)
    parsed = []
  }

  const validTypes = new Set([
    'annual_report', 'quarterly_report', 'half_year_report', 'sustainability_report',
    'investor_presentation', 'press_release', 'financial_statements',
    'conference_call', 'factsheet', 'consensus', 'other',
  ])

  const classified: ClassifiedDocument[] = parsed
    .filter((item) => item.index >= 1 && item.index <= documents.length)
    .map((item) => ({
      url: documents[item.index - 1].url,
      title: item.title || documents[item.index - 1].text,
      document_type: validTypes.has(item.document_type) ? item.document_type : 'other',
      fiscal_year: typeof item.fiscal_year === 'number' ? item.fiscal_year : null,
      fiscal_quarter: typeof item.fiscal_quarter === 'number' ? item.fiscal_quarter : null,
      language: item.language ?? null,
      confidence: typeof item.confidence === 'number' ? Math.min(1, Math.max(0, item.confidence)) : 0.5,
    }))

  return { classified, usage }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { user, adminClient } = await authenticateRequest(req)
    const { company_id } = await req.json()

    if (!company_id) {
      return jsonResponse({ error: 'company_id is required' }, 400)
    }

    // Load company
    const { data: company, error: companyErr } = await adminClient
      .from('companies')
      .select('id, name, ir_page_url, website_url')
      .eq('id', company_id)
      .single()

    if (companyErr || !company) {
      return jsonResponse({ error: 'Company not found' }, 404)
    }

    if (!company.ir_page_url) {
      return jsonResponse({ error: 'Company has no IR page URL set. Use suggest-ir-url first.' }, 400)
    }

    if (!isPublicUrl(company.ir_page_url)) {
      return jsonResponse({ error: 'IR page URL is not a valid public URL' }, 400)
    }

    // Fetch IR page HTML
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY')
    let pageContent: string
    let pageUrl = company.ir_page_url

    if (firecrawlKey) {
      // Use Firecrawl for JS-rendered pages
      const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: company.ir_page_url,
          formats: ['html'],
          waitFor: 3000,
        }),
      })

      if (scrapeRes.ok) {
        const scrapeData = await scrapeRes.json()
        pageContent = scrapeData.data?.html ?? ''
        pageUrl = scrapeData.data?.metadata?.sourceURL ?? company.ir_page_url

        // Log Firecrawl usage
        try {
          await adminClient.from('api_request_logs').insert({
            service: 'firecrawl',
            endpoint: '/v1/scrape',
            call_count: 1,
            user_id: user.id,
            edge_function: 'scan-ir-page',
          })
        } catch { /* non-blocking */ }
      } else {
        // Fallback to direct fetch
        const directRes = await fetch(company.ir_page_url, {
          headers: { 'User-Agent': 'Valrano/1.0 (IR Document Catalog)' },
          signal: AbortSignal.timeout(15000),
        })
        pageContent = await directRes.text()
      }
    } else {
      // No Firecrawl — direct fetch
      const directRes = await fetch(company.ir_page_url, {
        headers: { 'User-Agent': 'Valrano/1.0 (IR Document Catalog)' },
        signal: AbortSignal.timeout(15000),
      })
      pageContent = await directRes.text()
    }

    if (!pageContent) {
      return jsonResponse({ error: 'Failed to fetch IR page content' }, 502)
    }

    // Extract document links
    let documentLinks = extractDocumentLinks(pageContent, pageUrl)

    // If no downloadable files on landing page, follow report sub-pages one level deeper
    if (documentLinks.length === 0 && firecrawlKey) {
      const subPages = extractReportSubPages(pageContent, pageUrl)
      console.log(`[scan-ir-page] No PDFs on landing page, found ${subPages.length} report sub-pages to crawl`)

      for (const subUrl of subPages) {
        try {
          const subRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: subUrl, formats: ['html'], waitFor: 3000 }),
          })

          if (subRes.ok) {
            const subData = await subRes.json()
            const subHtml = subData.data?.html ?? ''
            const subBaseUrl = subData.data?.metadata?.sourceURL ?? subUrl
            const subLinks = extractDocumentLinks(subHtml, subBaseUrl)
            documentLinks.push(...subLinks)

            try {
              await adminClient.from('api_request_logs').insert({
                service: 'firecrawl',
                endpoint: '/v1/scrape',
                call_count: 1,
                user_id: user.id,
                edge_function: 'scan-ir-page',
              })
            } catch { /* non-blocking */ }
          }
        } catch (err) {
          console.error(`[scan-ir-page] Sub-page scrape failed for ${subUrl}:`, (err as Error).message)
        }

        // Stop once we have enough documents
        if (documentLinks.length >= MAX_DOCUMENTS) break
      }

      // Deduplicate by URL
      const seen = new Set<string>()
      documentLinks = documentLinks.filter(d => {
        if (seen.has(d.url)) return false
        seen.add(d.url)
        return true
      }).slice(0, MAX_DOCUMENTS)
    }

    if (documentLinks.length === 0) {
      return jsonResponse({
        success: true,
        items_found: 0,
        items_new: 0,
        items_updated: 0,
        message: 'No document links found on the IR page or report sub-pages',
      })
    }

    // Classify documents with Gemini
    const geminiKey = Deno.env.get('GOOGLE_AI_API_KEY')
    let classifiedDocs: ClassifiedDocument[]

    if (geminiKey) {
      const result = await classifyDocuments(documentLinks, company.name, geminiKey)
      classifiedDocs = result.classified

      // Log AI usage
      await logAnthropicUsage('Valrano', 'scan-ir-page', {
        model: GEMINI_MODEL,
        usage: result.usage,
      })

      // Track in ai_usage table
      try {
        await adminClient.from('ai_usage').insert({
          user_id: user.id,
          feature: 'scan_ir_page',
          model_used: GEMINI_MODEL,
          input_tokens: result.usage.input_tokens,
          output_tokens: result.usage.output_tokens,
        })
      } catch { /* non-blocking */ }
    } else {
      // No Gemini key — store unclassified
      classifiedDocs = documentLinks.map((d) => ({
        url: d.url,
        title: d.text,
        document_type: 'other',
        fiscal_year: null,
        fiscal_quarter: null,
        language: null,
        confidence: 0,
      }))
    }

    // Get file sizes via HEAD requests (parallel, with timeout)
    const fileSizes = await Promise.allSettled(
      classifiedDocs.map(async (doc) => {
        try {
          const res = await fetch(doc.url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(5000),
          })
          const size = res.headers.get('content-length')
          return size ? parseInt(size, 10) : null
        } catch {
          return null
        }
      }),
    )

    // Clean up stale non-document entries (e.g. navigation links from earlier scans)
    await adminClient
      .from('ir_catalog_items')
      .delete()
      .eq('company_id', company_id)
      .is('file_format', null)
      .eq('is_downloaded', false)

    // Upsert into ir_catalog_items
    let itemsNew = 0
    let itemsUpdated = 0

    for (let i = 0; i < classifiedDocs.length; i++) {
      const doc = classifiedDocs[i]
      const fileSize = fileSizes[i].status === 'fulfilled' ? fileSizes[i].value : null

      const row = {
        company_id,
        title: doc.title,
        document_url: doc.url,
        document_type: doc.document_type,
        fiscal_year: doc.fiscal_year,
        fiscal_quarter: doc.fiscal_quarter,
        language: doc.language,
        file_format: getFileFormat(doc.url),
        file_size_bytes: fileSize,
        ai_classified: !!geminiKey,
        classification_confidence: doc.confidence,
        detected_at: new Date().toISOString(),
      }

      const { error: upsertErr, status } = await adminClient
        .from('ir_catalog_items')
        .upsert(row, { onConflict: 'company_id,url_hash', ignoreDuplicates: false })

      if (!upsertErr) {
        // 201 = new row, 200 = updated
        if (status === 201) itemsNew++
        else itemsUpdated++
      }
    }

    return jsonResponse({
      success: true,
      items_found: classifiedDocs.length,
      items_new: itemsNew,
      items_updated: itemsUpdated,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : ''
    console.error('[scan-ir-page] Error:', msg, stack)
    // Return detailed error for debugging (not just "Internal server error")
    return new Response(
      JSON.stringify({ error: `IR page scan failed: ${msg}` }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  }
})
