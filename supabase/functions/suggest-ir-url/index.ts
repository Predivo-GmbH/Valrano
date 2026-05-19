import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { logAnthropicUsage } from '../_shared/log-usage.ts'

/**
 * suggest-ir-url — Data-driven IR page discovery
 *
 * 1. Gets the company's website_url from DB (resolved via Brandfetch)
 * 2. Crawls the website via Firecrawl map endpoint to find all pages
 * 3. Uses Gemini 2.5 Flash to identify the IR page from the sitemap
 * 4. Validates the URL via HEAD request
 * 5. Stores on company record
 *
 * Falls back to Gemini-only guess if Firecrawl unavailable.
 */

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

const GEMINI_MODEL = 'gemini-2.5-flash'

const TIER_LIMITS: Record<string, number> = {
  starter: 5,
  professional: 50,
  enterprise: 999,
}

const IR_URL_SCHEMA = {
  type: 'object',
  properties: {
    ir_page_url: { type: 'string', description: 'The investor relations page URL' },
    alternative_urls: {
      type: 'array',
      items: { type: 'string' },
      description: 'Alternative URLs to try if the primary fails',
    },
    confidence: { type: 'number', description: '0-1 confidence score' },
    source: { type: 'string', enum: ['sitemap_match', 'page_content', 'url_pattern', 'estimated'] },
  },
  required: ['ir_page_url', 'confidence', 'source'],
} as const

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { user, adminClient } = await authenticateRequest(req)

    const { company_id, company_name } = await req.json()
    if (!company_id || !company_name) {
      return jsonResponse({ error: 'Missing required fields: company_id, company_name' }, 400)
    }

    // ------------------------------------------------------------------
    // 1. Check if company already has an IR URL
    // ------------------------------------------------------------------
    const { data: company } = await adminClient
      .from('companies')
      .select('ir_page_url, website_url')
      .eq('id', company_id)
      .single()

    if (company?.ir_page_url) {
      return jsonResponse({
        ir_page_url: company.ir_page_url,
        source: 'existing',
        validated: true,
      })
    }

    // ------------------------------------------------------------------
    // 2. Check subscription tier + usage limits
    // ------------------------------------------------------------------
    const { data: subscription } = await adminClient
      .from('subscriptions')
      .select('tier')
      .eq('user_id', user.id)
      .maybeSingle()

    const tier = subscription?.tier ?? 'starter'
    const limit = TIER_LIMITS[tier] ?? 5

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { count: usageCount } = await adminClient
      .from('ai_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('feature', 'suggest_ir_url')
      .gte('created_at', startOfMonth.toISOString())

    const used = usageCount ?? 0
    if (used >= limit) {
      return jsonResponse({
        error: 'Monthly AI suggestion limit reached',
        limit,
        used,
        tier,
      }, 429)
    }

    // ------------------------------------------------------------------
    // 3. Crawl company website via Firecrawl map endpoint
    // ------------------------------------------------------------------
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY')
    const websiteUrl = company?.website_url
    let sitemapUrls: string[] = []
    let scrapedIrContent = ''

    if (firecrawlApiKey && websiteUrl && isPublicUrl('https://' + websiteUrl)) {
      try {
        // Use Firecrawl /map to get all URLs on the site
        const mapResp = await fetch('https://api.firecrawl.dev/v1/map', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${firecrawlApiKey}`,
          },
          body: JSON.stringify({
            url: `https://${websiteUrl}`,
            limit: 200,
          }),
          signal: AbortSignal.timeout(15000),
        })

        if (mapResp.ok) {
          const mapData = await mapResp.json()
          sitemapUrls = (mapData.links ?? []) as string[]
          console.log(`[suggest-ir-url] Found ${sitemapUrls.length} URLs on ${websiteUrl}`)
        }

        // Log Firecrawl usage
        await adminClient.from('api_request_logs').insert({
          service: 'firecrawl',
          endpoint: '/v1/map',
          call_count: 1,
          user_id: user.id,
          edge_function: 'suggest-ir-url',
        }).then(({ error }) => {
          if (error) console.error('Failed to log Firecrawl usage:', error.message)
        })
      } catch (err) {
        console.error(`[suggest-ir-url] Firecrawl map error:`, (err as Error).message)
      }

      // If we found URLs, filter for likely IR pages and scrape the best candidate
      if (sitemapUrls.length > 0) {
        const irPatterns = /\/(investor|ir|investors|investor-relations|aktionaere|financial-results|publications|annual-report)/i
        const irCandidates = sitemapUrls.filter(url => irPatterns.test(url))

        if (irCandidates.length > 0) {
          // Scrape the most likely IR page for content verification
          try {
            const scrapeResp = await fetch('https://api.firecrawl.dev/v1/scrape', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${firecrawlApiKey}`,
              },
              body: JSON.stringify({
                url: irCandidates[0],
                formats: ['markdown'],
                onlyMainContent: true,
                timeout: 10000,
              }),
              signal: AbortSignal.timeout(15000),
            })

            if (scrapeResp.ok) {
              const scrapeData = await scrapeResp.json()
              scrapedIrContent = scrapeData.data?.markdown ?? ''
            }

            await adminClient.from('api_request_logs').insert({
              service: 'firecrawl',
              endpoint: '/v1/scrape',
              call_count: 1,
              user_id: user.id,
              edge_function: 'suggest-ir-url',
            }).then(({ error }) => {
              if (error) console.error('Failed to log Firecrawl usage:', error.message)
            })
          } catch (err) {
            console.error(`[suggest-ir-url] Firecrawl scrape error:`, (err as Error).message)
          }
        }
      }
    }

    // ------------------------------------------------------------------
    // 4. Call Gemini 2.5 Flash to identify the IR page
    // ------------------------------------------------------------------
    const geminiApiKey = Deno.env.get('GOOGLE_AI_API_KEY')
    if (!geminiApiKey) throw new Error('GOOGLE_AI_API_KEY is not set')

    const sitemapSection = sitemapUrls.length > 0
      ? `\n\nSITEMAP URLS found on ${websiteUrl}:\n${sitemapUrls.slice(0, 100).join('\n')}\n\nSelect the URL that is most likely the investor relations landing page.`
      : ''

    const scrapedSection = scrapedIrContent
      ? `\n\nSCRAPED CONTENT from candidate IR page:\n<ir_page>\n${scrapedIrContent.slice(0, 5000)}\n</ir_page>\n\nVerify this page contains investor relations content (annual reports, financial calendar, press releases).`
      : ''

    const userPrompt = `Find the investor relations page URL for "${company_name}".
${websiteUrl ? `Known website: ${websiteUrl}` : 'No website URL known.'}

This is a building materials / construction industry company. I need the URL to the main investor relations landing page where they publish annual reports, quarterly results, and financial publications.
${sitemapSection}${scrapedSection}

If sitemap URLs are available, pick from those (confidence 0.9+).
If no sitemap, construct the most likely URL based on common patterns (confidence 0.5-0.7):
- https://www.company.com/investors
- https://www.company.com/investor-relations
- https://www.company.com/en/investors
- https://investors.company.com`

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: 'You are an expert at finding investor relations pages on corporate websites. Identify the correct IR page URL.' }] },
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: IR_URL_SCHEMA,
            temperature: 0,
          },
        }),
      },
    )

    if (!geminiResponse.ok) {
      const errBody = await geminiResponse.text()
      throw new Error(`Gemini API error ${geminiResponse.status}: ${errBody}`)
    }

    const geminiJson = await geminiResponse.json()
    const inputTokens = geminiJson.usageMetadata?.promptTokenCount ?? 0
    const outputTokens = geminiJson.usageMetadata?.candidatesTokenCount ?? 0

    await logAnthropicUsage('Valrano', 'suggest-ir-url', {
      model: GEMINI_MODEL,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    })

    const candidate = geminiJson.candidates?.[0]
    if (!candidate?.content?.parts?.[0]?.text) {
      throw new Error('Gemini did not return a valid response')
    }

    const suggestion = JSON.parse(candidate.content.parts[0].text) as {
      ir_page_url: string
      alternative_urls?: string[]
      confidence: number
      source: string
    }

    // ------------------------------------------------------------------
    // 5. Validate the URL via HEAD request
    // ------------------------------------------------------------------
    let validatedUrl: string | null = null
    const urlsToTry = [suggestion.ir_page_url, ...(suggestion.alternative_urls ?? [])]

    for (const url of urlsToTry) {
      if (!isPublicUrl(url)) continue
      try {
        const resp = await fetch(url, {
          method: 'HEAD',
          redirect: 'follow',
          signal: AbortSignal.timeout(5000),
        })
        if (resp.ok || resp.status === 405) {
          validatedUrl = url
          break
        }
      } catch {
        // Try next URL
      }
    }

    // ------------------------------------------------------------------
    // 6. Store on company if validated + trigger IR catalog scan
    // ------------------------------------------------------------------
    if (validatedUrl) {
      await adminClient
        .from('companies')
        .update({ ir_page_url: validatedUrl })
        .eq('id', company_id)

      // Auto-trigger IR catalog scan (server-side, no toggle gate — always catalog)
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (supabaseUrl && serviceKey) {
        await fetch(`${supabaseUrl}/functions/v1/scan-ir-page`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ company_id }),
        }).catch((e) => console.error('IR catalog scan trigger failed:', e))
      }
    }

    // ------------------------------------------------------------------
    // 7. Track usage
    // ------------------------------------------------------------------
    await adminClient.from('ai_usage').insert({
      user_id: user.id,
      feature: 'suggest_ir_url',
      model_used: GEMINI_MODEL,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    })

    return jsonResponse({
      ir_page_url: validatedUrl ?? suggestion.ir_page_url,
      validated: !!validatedUrl,
      confidence: suggestion.confidence,
      source: suggestion.source,
      stored: !!validatedUrl,
      sitemap_urls_found: sitemapUrls.length,
      usage: {
        used: used + 1,
        limit,
        tier,
        remaining: limit - used - 1,
      },
    })
  } catch (err) {
    return errorResponse(err)
  }
})
