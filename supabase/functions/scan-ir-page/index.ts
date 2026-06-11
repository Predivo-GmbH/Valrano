import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { getCorsHeaders, corsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, AuthError, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { logAnthropicUsage } from '../_shared/log-usage.ts'
import { logError } from '../_shared/error-log.ts'

/**
 * scan-ir-page — Deep scrape of a company's IR page to build document catalog
 *
 * Strategy:
 *   1. Scrape the IR landing page via Firecrawl (markdown + links)
 *   2. Extract document links from Firecrawl's links response
 *   3. ALWAYS follow report sub-pages (annual-reports, publications, downloads, etc.)
 *   4. Classify all discovered documents via Gemini
 *   5. Upsert into ir_catalog_items
 *   6. Store scan metadata on company for UI explanations
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

/** Check if a URL points to a downloadable document */
function isDocumentUrl(url: string): boolean {
  const lower = url.toLowerCase()
  // Direct file extension
  if (/\.(pdf|xlsx|xls|pptx|ppt|docx|doc|zip)(\?|$)/i.test(lower)) return true
  // CMS-style document URLs (Liferay /documents/d/, Drupal /sites/files/, etc.)
  if (/\/(documents?|download|media|files?)\//i.test(lower) &&
      !/\.(html?|php|aspx?|jsp|css|js|jpg|png|gif|svg|ico|woff|ttf)(\?|$)/i.test(lower)) return true
  return false
}

/** Extract document links from HTML content */
function extractDocumentLinks(html: string, baseUrl: string): DocumentLink[] {
  const links: DocumentLink[] = []
  const seen = new Set<string>()

  const hrefRegex = /href=["']([^"']+)["'][^>]*>([^<]*)/gi
  let match: RegExpExecArray | null

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
    seen.add(url)

    if (!isDocumentUrl(url)) continue

    const linkPos = match.index
    const contextStart = Math.max(0, linkPos - 100)
    const contextEnd = Math.min(html.length, linkPos + match[0].length + 100)
    const context = html.slice(contextStart, contextEnd).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

    links.push({ url, text: text || url.split('/').pop() || url, context })
  }

  return links.slice(0, MAX_DOCUMENTS)
}

/** Extract document links from Firecrawl's links array */
function extractDocumentLinksFromUrls(urls: string[]): DocumentLink[] {
  const links: DocumentLink[] = []
  const seen = new Set<string>()

  for (const url of urls) {
    if (!isPublicUrl(url)) continue
    if (seen.has(url)) continue
    seen.add(url)
    if (!isDocumentUrl(url)) continue

    const filename = url.split('/').pop()?.split('?')[0] || url
    links.push({ url, text: filename, context: '' })
  }

  return links.slice(0, MAX_DOCUMENTS)
}

/** Extract sub-page links that likely contain report downloads */
function extractReportSubPages(html: string, baseUrl: string, firecrawlLinks: string[] = []): string[] {
  const subPages: string[] = []
  const seen = new Set<string>()

  const reportPagePattern = /\b(reports?|publications?|financial-reports?|annual-reports?|downloads?|documents?|filings?|results?|presentations?|ergebnis|berichte?|geschaeftsbericht|geschaeftsbericht|rapports?|comptes|resultats?)\b/i

  // From HTML
  const hrefRegex = /href=["']([^"']+)["'][^>]*>([^<]*)/gi
  let match: RegExpExecArray | null

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

    try {
      const base = new URL(baseUrl)
      const target = new URL(url)
      if (base.hostname !== target.hostname) continue
    } catch { continue }

    if (/\.(pdf|xlsx|xls|pptx|ppt|docx|doc|zip|jpg|png|gif|svg|css|js)(\?|$)/i.test(url)) continue

    if (reportPagePattern.test(url) || reportPagePattern.test(text)) {
      seen.add(url)
      subPages.push(url)
    }
  }

  // Also check Firecrawl links for report sub-pages
  for (const url of firecrawlLinks) {
    if (seen.has(url)) continue
    if (!isPublicUrl(url)) continue
    if (/\.(pdf|xlsx|xls|pptx|ppt|docx|doc|zip|jpg|png|gif|svg|css|js)(\?|$)/i.test(url)) continue

    try {
      const base = new URL(baseUrl)
      const target = new URL(url)
      if (base.hostname !== target.hostname) continue
    } catch { continue }

    if (reportPagePattern.test(url)) {
      seen.add(url)
      subPages.push(url)
    }
  }

  // Limit to 5 sub-pages (up from 3)
  return subPages.slice(0, 5)
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
  const documentList = documents.map((d, i) => `${i + 1}. URL: ${d.url}\n   Link text: ${d.text}${d.context ? `\n   Context: ${d.context}` : ''}`).join('\n\n')

  const prompt = `You are analyzing the investor relations page of "${companyName}".
Below is a list of document links found on their IR page. For each document, classify it and extract metadata.

Documents:
${documentList}

For each document, return a JSON object with:
- "index": the document number (1-based)
- "title": a clean, human-readable title (e.g. "Annual Report 2024", "Q3 2024 Results")
- "document_type": one of: "annual_report", "quarterly_report", "half_year_report", "sustainability_report", "investor_presentation", "press_release", "financial_statements", "conference_call", "factsheet", "consensus", "other"
- "fiscal_year": the fiscal year as integer (e.g. 2025), or null if unclear
- "fiscal_quarter": quarter number 1-4 for quarterly reports, or null
- "language": ISO 639-1 code (e.g. "en", "de", "fr"), or null
- "confidence": 0.0 to 1.0 — how confident you are in the classification

IMPORTANT: Be generous with classification. If the URL contains "annual" or "geschaeftsbericht" or "rapport-annuel", classify as "annual_report" even if the link text is generic. Prefer "annual_report" for full-year comprehensive reports.

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

/** Scrape a page via Firecrawl and return HTML + links */
async function scrapeWithFirecrawl(
  url: string,
  firecrawlKey: string,
): Promise<{ html: string; links: string[]; markdown: string; sourceUrl: string } | null> {
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['html', 'links'],
        waitFor: 3000,
      }),
      signal: AbortSignal.timeout(20000),
    })

    if (!res.ok) {
      console.error(`[scan-ir-page] Firecrawl ${res.status} for ${url}`)
      return null
    }

    const data = await res.json()
    return {
      html: data.data?.html ?? '',
      links: data.data?.links ?? [],
      markdown: data.data?.markdown ?? '',
      sourceUrl: data.data?.metadata?.sourceURL ?? url,
    }
  } catch (err) {
    console.error(`[scan-ir-page] Firecrawl error for ${url}:`, (err as Error).message)
    return null
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    // Support both user JWT (frontend) and service_role key (server-to-server from suggest-ir-url)
    const sbUrl = Deno.env.get('SUPABASE_URL')!
    const sbServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')

    let userId: string
    let adminClient: ReturnType<typeof createClient>

    if (token === sbServiceKey) {
      // Service-role call (from suggest-ir-url auto-trigger) — no user context
      userId = 'system'
      adminClient = createClient(sbUrl, sbServiceKey)
    } else {
      // Normal user JWT call
      const auth = await authenticateRequest(req)
      userId = auth.user.id
      adminClient = auth.adminClient
    }

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

    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY')
    let allDocumentLinks: DocumentLink[] = []
    const subPagesCrawled: string[] = []
    let firecrawlCreditsUsed = 0

    // Step 1: Scrape IR landing page
    let pageHtml = ''
    let pageLinks: string[] = []
    let pageUrl = company.ir_page_url

    if (firecrawlKey) {
      const result = await scrapeWithFirecrawl(company.ir_page_url, firecrawlKey)
      firecrawlCreditsUsed++
      // Log usage (non-critical)
      adminClient.from('api_request_logs').insert({
        service: 'firecrawl', endpoint: '/v1/scrape', call_count: 1,
        user_id: userId, edge_function: 'scan-ir-page',
      }).then(({ error }) => { if (error) console.error('Log error:', error.message) })

      if (result) {
        pageHtml = result.html
        pageLinks = result.links
        pageUrl = result.sourceUrl
      }
    }

    // Fallback to direct fetch if Firecrawl failed or unavailable
    if (!pageHtml) {
      try {
        const directRes = await fetch(company.ir_page_url, {
          headers: { 'User-Agent': 'Valrano/1.0 (IR Document Catalog)' },
          signal: AbortSignal.timeout(15000),
          redirect: 'follow',
        })
        pageHtml = await directRes.text()
      } catch (err) {
        console.error(`[scan-ir-page] Direct fetch failed:`, (err as Error).message)
      }
    }

    if (!pageHtml && pageLinks.length === 0) {
      const metadata = {
        last_scan_at: new Date().toISOString(),
        items_found: 0,
        reason: 'Failed to fetch IR page content',
        annual_report_years: [],
        fiscal_years_found: [],
      }
      await adminClient.from('companies').update({ ir_scan_metadata: metadata }).eq('id', company_id)
      return jsonResponse({ success: true, items_found: 0, items_new: 0, items_updated: 0, message: 'Failed to fetch IR page content' })
    }

    // Step 2: Extract document links from BOTH HTML and Firecrawl links
    const htmlDocLinks = extractDocumentLinks(pageHtml, pageUrl)
    const fcDocLinks = extractDocumentLinksFromUrls(pageLinks)

    // Merge and deduplicate
    const seenUrls = new Set<string>()
    for (const link of [...htmlDocLinks, ...fcDocLinks]) {
      if (!seenUrls.has(link.url)) {
        seenUrls.add(link.url)
        allDocumentLinks.push(link)
      }
    }

    console.log(`[scan-ir-page] Landing page: ${allDocumentLinks.length} document links (${htmlDocLinks.length} from HTML, ${fcDocLinks.length} from Firecrawl links)`)

    // Step 3: ALWAYS follow report sub-pages (2-level depth for sites like Sika)
    const subPages = extractReportSubPages(pageHtml, pageUrl, pageLinks)
    const subPagesSeen = new Set(subPages)
    const level2SubPages: string[] = []
    console.log(`[scan-ir-page] Found ${subPages.length} report sub-pages to crawl`)

    for (const subUrl of subPages) {
      if (allDocumentLinks.length >= MAX_DOCUMENTS) break
      subPagesCrawled.push(subUrl)

      if (firecrawlKey) {
        const subResult = await scrapeWithFirecrawl(subUrl, firecrawlKey)
        firecrawlCreditsUsed++
        adminClient.from('api_request_logs').insert({
          service: 'firecrawl', endpoint: '/v1/scrape', call_count: 1,
          user_id: userId, edge_function: 'scan-ir-page',
        }).then(({ error }) => { if (error) console.error('Log error:', error.message) })

        if (subResult) {
          const subHtmlLinks = extractDocumentLinks(subResult.html, subResult.sourceUrl)
          const subFcLinks = extractDocumentLinksFromUrls(subResult.links)

          for (const link of [...subHtmlLinks, ...subFcLinks]) {
            if (!seenUrls.has(link.url) && allDocumentLinks.length < MAX_DOCUMENTS) {
              seenUrls.add(link.url)
              allDocumentLinks.push(link)
            }
          }

          // Collect 2nd-level sub-pages (for sites with deep structure)
          const deeper = extractReportSubPages(subResult.html, subResult.sourceUrl, subResult.links)
          for (const d of deeper) {
            if (!subPagesSeen.has(d) && level2SubPages.length < 3) {
              subPagesSeen.add(d)
              level2SubPages.push(d)
            }
          }

          console.log(`[scan-ir-page] Sub-page ${subUrl}: +${subHtmlLinks.length + subFcLinks.length} links`)
        }
      } else {
        // No Firecrawl — direct fetch
        try {
          const directRes = await fetch(subUrl, {
            headers: { 'User-Agent': 'Valrano/1.0 (IR Document Catalog)' },
            signal: AbortSignal.timeout(15000),
            redirect: 'follow',
          })
          const subHtml = await directRes.text()
          const subLinks = extractDocumentLinks(subHtml, subUrl)
          for (const link of subLinks) {
            if (!seenUrls.has(link.url) && allDocumentLinks.length < MAX_DOCUMENTS) {
              seenUrls.add(link.url)
              allDocumentLinks.push(link)
            }
          }

          // Collect 2nd-level sub-pages
          const deeper = extractReportSubPages(subHtml, subUrl)
          for (const d of deeper) {
            if (!subPagesSeen.has(d) && level2SubPages.length < 3) {
              subPagesSeen.add(d)
              level2SubPages.push(d)
            }
          }
        } catch (err) {
          console.error(`[scan-ir-page] Sub-page fetch failed for ${subUrl}:`, (err as Error).message)
        }
      }
    }

    // Crawl 2nd-level sub-pages (max 3 to limit Firecrawl credits)
    if (level2SubPages.length > 0 && allDocumentLinks.length < MAX_DOCUMENTS) {
      console.log(`[scan-ir-page] Found ${level2SubPages.length} 2nd-level sub-pages`)
      for (const subUrl of level2SubPages) {
        if (allDocumentLinks.length >= MAX_DOCUMENTS) break
        subPagesCrawled.push(subUrl)

        if (firecrawlKey) {
          const subResult = await scrapeWithFirecrawl(subUrl, firecrawlKey)
          firecrawlCreditsUsed++
          if (subResult) {
            const subHtmlLinks = extractDocumentLinks(subResult.html, subResult.sourceUrl)
            const subFcLinks = extractDocumentLinksFromUrls(subResult.links)
            for (const link of [...subHtmlLinks, ...subFcLinks]) {
              if (!seenUrls.has(link.url) && allDocumentLinks.length < MAX_DOCUMENTS) {
                seenUrls.add(link.url)
                allDocumentLinks.push(link)
              }
            }
            console.log(`[scan-ir-page] 2nd-level ${subUrl}: +${subHtmlLinks.length + subFcLinks.length} links`)
          }
        } else {
          try {
            const directRes = await fetch(subUrl, {
              headers: { 'User-Agent': 'Valrano/1.0 (IR Document Catalog)' },
              signal: AbortSignal.timeout(15000),
              redirect: 'follow',
            })
            const subHtml = await directRes.text()
            const subLinks = extractDocumentLinks(subHtml, subUrl)
            for (const link of subLinks) {
              if (!seenUrls.has(link.url) && allDocumentLinks.length < MAX_DOCUMENTS) {
                seenUrls.add(link.url)
                allDocumentLinks.push(link)
              }
            }
          } catch (err) {
            console.error(`[scan-ir-page] 2nd-level fetch failed for ${subUrl}:`, (err as Error).message)
          }
        }
      }
    }

    console.log(`[scan-ir-page] Total: ${allDocumentLinks.length} document links after sub-page crawl`)

    // Step 4: Classify with Gemini
    const geminiKey = Deno.env.get('GOOGLE_AI_API_KEY')
    let classifiedDocs: ClassifiedDocument[]
    let totalInputTokens = 0
    let totalOutputTokens = 0

    if (geminiKey && allDocumentLinks.length > 0) {
      const result = await classifyDocuments(allDocumentLinks, company.name, geminiKey)
      classifiedDocs = result.classified
      totalInputTokens = result.usage.input_tokens
      totalOutputTokens = result.usage.output_tokens

      await logAnthropicUsage('Valrano', 'scan-ir-page', {
        model: GEMINI_MODEL,
        usage: result.usage,
      })

      // Track in ai_usage (non-critical)
      adminClient.from('ai_usage').insert({
        user_id: userId,
        feature: 'scan_ir_page',
        model_used: GEMINI_MODEL,
        input_tokens: result.usage.input_tokens,
        output_tokens: result.usage.output_tokens,
      }).then(({ error }) => { if (error) console.error('AI usage log error:', error.message) })
    } else if (allDocumentLinks.length > 0) {
      classifiedDocs = allDocumentLinks.map((d) => ({
        url: d.url,
        title: d.text,
        document_type: 'other',
        fiscal_year: null,
        fiscal_quarter: null,
        language: null,
        confidence: 0,
      }))
    } else {
      classifiedDocs = []
    }

    // Step 5: Get file sizes via HEAD (parallel)
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

    // Step 6: Clean stale entries and upsert
    await adminClient
      .from('ir_catalog_items')
      .delete()
      .eq('company_id', company_id)
      .is('file_format', null)
      .eq('is_downloaded', false)

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
        if (status === 201) itemsNew++
        else itemsUpdated++
      }
    }

    // Step 7: Store scan metadata on company for UI explanations
    const annualReportYears = classifiedDocs
      .filter(d => d.document_type === 'annual_report' && d.fiscal_year)
      .map(d => d.fiscal_year!)
      .sort((a, b) => b - a)

    const allFiscalYears = [...new Set(
      classifiedDocs
        .filter(d => d.fiscal_year)
        .map(d => d.fiscal_year!)
    )].sort((a, b) => b - a)

    let reason: string
    if (classifiedDocs.length === 0) {
      reason = 'No downloadable documents found on the IR page.'
    } else if (annualReportYears.length === 0) {
      reason = `${classifiedDocs.length} documents found but none classified as annual reports. Found document types: ${[...new Set(classifiedDocs.map(d => d.document_type))].join(', ')}.`
    } else {
      reason = `${classifiedDocs.length} documents found. Annual reports available for: FY${annualReportYears.join(', FY')}.`
    }

    const metadata = {
      last_scan_at: new Date().toISOString(),
      items_found: classifiedDocs.length,
      items_new: itemsNew,
      annual_report_years: annualReportYears,
      fiscal_years_found: allFiscalYears,
      reason,
      sub_pages_crawled: subPagesCrawled,
      firecrawl_credits_used: firecrawlCreditsUsed,
    }

    await adminClient
      .from('companies')
      .update({ ir_scan_metadata: metadata })
      .eq('id', company_id)

    return jsonResponse({
      success: true,
      items_found: classifiedDocs.length,
      items_new: itemsNew,
      items_updated: itemsUpdated,
      annual_report_years: annualReportYears,
      reason,
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse(err)
    }
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : ''
    console.error('[scan-ir-page] Error:', msg, stack)
    await logError('scan-ir-page', 'scan', err instanceof Error ? err : new Error(msg), { company_id: 'unknown' }).catch(() => {})
    return new Response(
      JSON.stringify({ error: `IR page scan failed: ${msg}` }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  }
})
