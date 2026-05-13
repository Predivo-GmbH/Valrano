import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { logAnthropicUsage } from '../_shared/log-usage.ts'

/**
 * suggest-competitors — AI-powered competitor suggestions
 *
 * Given a company name (and optionally sector/country), returns a list of
 * likely competitors using Claude. Also checks which ones already exist
 * in the companies table and returns their IDs.
 */

const TIER_LIMITS: Record<string, number> = {
  starter: 5,
  professional: 50,
  enterprise: 999,
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { user, adminClient } = await authenticateRequest(req)

    const { company_name, sector, country, exclude_names } = await req.json()
    if (!company_name) {
      return jsonResponse({ error: 'Missing required field: company_name' }, 400)
    }

    // ------------------------------------------------------------------
    // 1. Check AI usage limits
    // ------------------------------------------------------------------
    const { data: sub } = await adminClient
      .from('subscriptions')
      .select('tier')
      .eq('user_id', user.id)
      .maybeSingle()

    const tier = sub?.tier ?? 'starter'
    const limit = TIER_LIMITS[tier] ?? 5

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const { count } = await adminClient
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('feature', 'suggest_competitors')
      .gte('created_at', monthStart)

    if ((count ?? 0) >= limit) {
      return jsonResponse({
        error: `Monthly AI suggestion limit reached (${limit}). Upgrade your plan for more.`,
        limit_reached: true,
      }, 429)
    }

    // ------------------------------------------------------------------
    // 2. Call Claude to suggest competitors
    // ------------------------------------------------------------------
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return jsonResponse({ error: 'AI service not configured' }, 500)
    }

    const sectorHint = sector ? ` in the ${sector} sector` : ''
    const countryHint = country ? ` based in ${country}` : ''

    // Get names to exclude (report-mentioned competitors + the company itself)
    const excludeNames: string[] = exclude_names ?? []

    const excludeBlock = excludeNames.length > 0
      ? `\n\nIMPORTANT — Do NOT include any of these companies (they are already listed separately):\n${excludeNames.map((n: string) => `- ${n}`).join('\n')}`
      : ''

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: `You are a financial analyst. Given the company "${company_name}"${sectorHint}${countryHint}, list 8-12 of its most relevant public competitors for benchmarking purposes.

CRITICAL RULES:
- NEVER include "${company_name}" itself or any of its former names, parent companies, or subsidiaries (e.g. if the company is "Holcim", do NOT suggest "LafargeHolcim" or "Holcim Ltd").
- Only suggest genuinely different competing companies.${excludeBlock}

For each competitor, provide:
- name: The official company name (as it would appear in financial databases)
- ticker: Stock ticker symbol (if publicly traded)
- sector: Industry sector
- reasoning: One sentence explaining why this is a relevant competitor

Return ONLY valid JSON in this exact format:
{
  "competitors": [
    { "name": "...", "ticker": "...", "sector": "...", "reasoning": "..." }
  ]
}

Focus on companies that are:
1. In the same or adjacent industry
2. Similar in size/scale where possible
3. Publicly traded (preferred, for data availability)
4. Geographically diverse but relevant`,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      console.error('Claude API error:', errBody)
      return jsonResponse({ error: 'AI suggestion failed' }, 502)
    }

    const aiResult = await response.json()
    await logAnthropicUsage('BenchmarkSignal', 'suggest-competitors', aiResult)
    const text = aiResult.content?.[0]?.text ?? ''

    // Parse JSON from response
    let suggestions: Array<{ name: string; ticker?: string; sector?: string; reasoning?: string; website_domain?: string }> = []
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        suggestions = parsed.competitors ?? []
      }
    } catch {
      console.error('Failed to parse AI response:', text)
      return jsonResponse({ error: 'Failed to parse AI suggestions' }, 502)
    }

    // ------------------------------------------------------------------
    // 3. Resolve verified domains via Brandfetch Brand Search API
    // ------------------------------------------------------------------
    const brandfetchClientId = Deno.env.get('BRANDFETCH_CLIENT_ID')

    if (brandfetchClientId) {
      const domainResults = await Promise.all(
        suggestions.map(async (s) => {
          try {
            const resp = await fetch(
              `https://api.brandfetch.io/v2/search/${encodeURIComponent(s.name)}?c=${brandfetchClientId}`,
              { signal: AbortSignal.timeout(3000) },
            )
            if (!resp.ok) return null
            const results = await resp.json() as Array<{ name: string; domain: string; icon: string | null }>
            // Take the first result — Brandfetch ranks by relevance
            if (results.length > 0 && results[0].domain) {
              return results[0].domain
            }
            return null
          } catch {
            return null
          }
        }),
      )

      for (let i = 0; i < suggestions.length; i++) {
        suggestions[i].website_domain = domainResults[i] ?? undefined
      }

      // Log Brandfetch API calls for usage tracking (queried by BackOffice)
      const brandfetchCallCount = suggestions.length
      await adminClient.from('api_request_logs').insert({
        service: 'brandfetch',
        endpoint: '/v2/search',
        call_count: brandfetchCallCount,
        user_id: user.id,
        edge_function: 'suggest-competitors',
      }).then(({ error }) => {
        if (error) console.error('Failed to log Brandfetch usage:', error.message)
      })
    }

    // ------------------------------------------------------------------
    // 4. Match suggestions against existing companies in DB
    // ------------------------------------------------------------------
    const { data: existingCompanies } = await adminClient
      .from('companies')
      .select('id, name, ticker, sector, is_active')

    const matched = suggestions.map((s) => {
      const match = (existingCompanies ?? []).find(
        (c) =>
          c.name.toLowerCase() === s.name.toLowerCase() ||
          (s.ticker && c.ticker && c.ticker.toLowerCase() === s.ticker.toLowerCase()),
      )
      return {
        ...s,
        existing_id: match?.id ?? null,
        existing_name: match?.name ?? null,
        in_database: !!match,
      }
    })

    // ------------------------------------------------------------------
    // 5. Track usage
    // ------------------------------------------------------------------
    await adminClient.from('ai_usage').insert({
      user_id: user.id,
      feature: 'suggest_competitors',
      model_used: 'claude-sonnet-4-20250514',
      input_tokens: aiResult.usage?.input_tokens ?? 0,
      output_tokens: aiResult.usage?.output_tokens ?? 0,
    })

    return jsonResponse({
      suggestions: matched,
      company_name,
      usage: {
        used: (count ?? 0) + 1,
        limit,
        tier,
      },
    })
  } catch (err) {
    return errorResponse(err)
  }
})
