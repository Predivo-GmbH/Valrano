import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { logAnthropicUsage } from '../_shared/log-usage.ts'

/**
 * suggest-publication-dates — Data-driven date prediction
 *
 * 1. Scrapes the company's IR page via Firecrawl to find past publication dates
 * 2. Uses Gemini 2.5 Flash to parse scraped content into structured dates
 * 3. Projects the next publication date based on historical pattern
 *
 * Falls back to Gemini-only prediction if IR page unavailable.
 */

const GEMINI_MODEL = 'gemini-2.5-flash'

const TIER_LIMITS: Record<string, number> = {
  starter: 5,
  professional: 50,
  enterprise: 999,
}

const SUGGESTION_SCHEMA = {
  type: 'object',
  properties: {
    suggested_date: { type: 'string', description: 'ISO date (YYYY-MM-DD) of expected publication' },
    suggested_time: { type: 'string', description: 'Time in HH:MM format (24h, CET timezone)' },
    confidence: { type: 'number', description: '0-1 confidence score' },
    reasoning: { type: 'string', description: 'Brief explanation (1-2 sentences)' },
    source: { type: 'string', enum: ['ir_page_scraped', 'historical_pattern', 'industry_norm', 'estimated'] },
    historical_dates_found: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fiscal_year: { type: 'integer' },
          report_type: { type: 'string' },
          publication_date: { type: 'string' },
        },
      },
      description: 'Past publication dates found on the IR page',
    },
  },
  required: ['suggested_date', 'suggested_time', 'confidence', 'reasoning', 'source'],
} as const

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { user, adminClient } = await authenticateRequest(req)

    const { company_id, company_name, report_type, fiscal_year } = await req.json()
    if (!company_name || !report_type || !fiscal_year) {
      return jsonResponse({ error: 'Missing required fields: company_name, report_type, fiscal_year' }, 400)
    }

    // ------------------------------------------------------------------
    // 1. Check subscription tier + usage limits
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
      .eq('feature', 'suggest_dates')
      .gte('created_at', startOfMonth.toISOString())

    const used = usageCount ?? 0
    if (used >= limit) {
      return jsonResponse({
        error: 'Monthly AI suggestion limit reached',
        limit,
        used,
        tier,
        upgrade_hint: tier === 'starter'
          ? 'Upgrade to Professional for 50 suggestions/month'
          : tier === 'professional'
            ? 'Upgrade to Enterprise for unlimited suggestions'
            : null,
      }, 429)
    }

    // ------------------------------------------------------------------
    // 2. Load company data + IR page URL
    // ------------------------------------------------------------------
    let irPageUrl: string | null = null
    let websiteUrl: string | null = null
    let historicalContext = ''

    if (company_id) {
      const { data: companyData } = await adminClient
        .from('companies')
        .select('ir_page_url, website_url, typical_publication_pattern')
        .eq('id', company_id)
        .single()

      irPageUrl = companyData?.ir_page_url ?? null
      websiteUrl = companyData?.website_url ?? null

      if (companyData?.typical_publication_pattern) {
        historicalContext += `\nStored publication pattern: ${JSON.stringify(companyData.typical_publication_pattern)}`
      }

      // Load existing publication events for pattern
      const { data: pastEvents } = await adminClient
        .from('publication_events')
        .select('report_type, fiscal_year, expected_date, expected_time, actual_detected_at')
        .eq('company_id', company_id)
        .order('fiscal_year', { ascending: false })
        .limit(5)

      if (pastEvents && pastEvents.length > 0) {
        historicalContext += `\n\nHistorical publication data from DB:\n` +
          pastEvents.map(e =>
            `- FY${e.fiscal_year} ${e.report_type}: expected ${e.expected_date}${e.expected_time ? ' at ' + e.expected_time : ''}` +
            (e.actual_detected_at ? ` (actually published ${e.actual_detected_at})` : '')
          ).join('\n')
      }
    }

    // ------------------------------------------------------------------
    // 3. Scrape IR page via Firecrawl (if URL available)
    // ------------------------------------------------------------------
    let scrapedContent = ''
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY')

    if (firecrawlApiKey && (irPageUrl || websiteUrl)) {
      const urlToScrape = irPageUrl ?? `https://${websiteUrl}/investors`

      try {
        const scrapeResp = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${firecrawlApiKey}`,
          },
          body: JSON.stringify({
            url: urlToScrape,
            formats: ['markdown'],
            onlyMainContent: true,
            timeout: 15000,
          }),
          signal: AbortSignal.timeout(20000),
        })

        if (scrapeResp.ok) {
          const scrapeData = await scrapeResp.json()
          scrapedContent = scrapeData.data?.markdown ?? ''

          // Log Firecrawl usage
          await adminClient.from('api_request_logs').insert({
            service: 'firecrawl',
            endpoint: '/v1/scrape',
            call_count: 1,
            user_id: user.id,
            edge_function: 'suggest-publication-dates',
          }).then(({ error }) => {
            if (error) console.error('Failed to log Firecrawl usage:', error.message)
          })

          console.log(`[suggest-dates] Scraped ${scrapedContent.length} chars from ${urlToScrape}`)
        } else {
          console.error(`[suggest-dates] Firecrawl scrape failed: ${scrapeResp.status}`)
        }
      } catch (err) {
        console.error(`[suggest-dates] Firecrawl scrape error:`, (err as Error).message)
      }
    }

    // ------------------------------------------------------------------
    // 4. Call Gemini 2.5 Flash to analyze and predict
    // ------------------------------------------------------------------
    const geminiApiKey = Deno.env.get('GOOGLE_AI_API_KEY')
    if (!geminiApiKey) throw new Error('GOOGLE_AI_API_KEY is not set')

    const scrapedSection = scrapedContent
      ? `\n\nSCRAPED IR PAGE CONTENT (from ${irPageUrl ?? websiteUrl}):\n<ir_page>\n${scrapedContent.slice(0, 15000)}\n</ir_page>\n\nIMPORTANT: Look for actual past publication dates, financial calendars, or reporting schedules in the scraped content above. These are the most reliable source.`
      : '\n\nNo IR page content available — use industry norms and general knowledge.'

    const systemPrompt = `You are a corporate finance research assistant predicting publication dates for financial reports. Use real data from the company's IR page when available.`

    const userPrompt = `Predict when ${company_name} will publish their ${report_type} report for fiscal year ${fiscal_year}.

Context:
- Report type: ${report_type} (annual = full year results, quarterly = Q1-Q4, half_year = H1/H2, sustainability = ESG/CSR)
- Fiscal year: ${fiscal_year}
- Today: ${new Date().toISOString().split('T')[0]}
- Industry: Building materials / construction
${historicalContext}${scrapedSection}

Guidelines:
- If the IR page contains a financial calendar with scheduled dates, use those directly (confidence 0.95+)
- If the IR page shows past publication dates, extrapolate the pattern (confidence 0.8-0.9)
- If only DB history exists, use that pattern (confidence 0.7-0.8)
- If no data, estimate from industry norms (confidence 0.4-0.6)
- Annual reports for European building materials companies: typically February-March
- Most large-caps publish early morning (06:00-07:30 CET)
- Extract any historical dates you find in the scraped content into historical_dates_found`

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: SUGGESTION_SCHEMA,
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

    await logAnthropicUsage('BenchmarkSignal', 'suggest-publication-dates', {
      model: GEMINI_MODEL,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    })

    const candidate = geminiJson.candidates?.[0]
    if (!candidate?.content?.parts?.[0]?.text) {
      throw new Error('Gemini did not return a valid response')
    }

    const suggestion = JSON.parse(candidate.content.parts[0].text) as {
      suggested_date: string
      suggested_time: string
      confidence: number
      reasoning: string
      source: string
      historical_dates_found?: Array<{ fiscal_year: number; report_type: string; publication_date: string }>
    }

    // ------------------------------------------------------------------
    // 5. Track usage
    // ------------------------------------------------------------------
    await adminClient.from('ai_usage').insert({
      user_id: user.id,
      feature: 'suggest_dates',
      model_used: GEMINI_MODEL,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    })

    return jsonResponse({
      suggestion,
      data_source: scrapedContent ? 'ir_page_scraped' : 'ai_prediction',
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
