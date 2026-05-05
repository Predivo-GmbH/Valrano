import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'

/**
 * suggest-publication-dates — AI-powered date/time prediction
 *
 * Given a company name + report type + fiscal year, predicts when the report
 * will likely be published based on:
 * - Company's historical publication pattern (from DB)
 * - Industry norms
 * - Known public information
 *
 * Returns: suggested date, time, confidence, reasoning.
 * Gated by subscription tier (tracked in ai_usage table).
 */

// AI suggestion limits per tier per month
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

    // Count usage this month
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
    // 2. Load company history + pattern from DB
    // ------------------------------------------------------------------
    let historicalContext = ''

    if (company_id) {
      // Check for existing publication events for this company
      const { data: pastEvents } = await adminClient
        .from('publication_events')
        .select('report_type, fiscal_year, expected_date, expected_time, actual_detected_at')
        .eq('company_id', company_id)
        .order('fiscal_year', { ascending: false })
        .limit(5)

      if (pastEvents && pastEvents.length > 0) {
        historicalContext = `\n\nHistorical publication data for this company:\n` +
          pastEvents.map(e =>
            `- FY${e.fiscal_year} ${e.report_type}: expected ${e.expected_date}${e.expected_time ? ' at ' + e.expected_time : ''}` +
            (e.actual_detected_at ? ` (actually published ${e.actual_detected_at})` : '')
          ).join('\n')
      }

      // Check company's typical pattern
      const { data: company } = await adminClient
        .from('companies')
        .select('typical_publication_pattern')
        .eq('id', company_id)
        .single()

      if (company?.typical_publication_pattern) {
        historicalContext += `\n\nStored publication pattern: ${JSON.stringify(company.typical_publication_pattern)}`
      }
    }

    // ------------------------------------------------------------------
    // 3. Call Claude for prediction
    // ------------------------------------------------------------------
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) throw new Error('ANTHROPIC_API_KEY is not set')

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        tools: [
          {
            name: 'suggest_publication_date',
            description: 'Suggest the expected publication date and time for a corporate report',
            input_schema: {
              type: 'object',
              properties: {
                suggested_date: {
                  type: 'string',
                  description: 'ISO date (YYYY-MM-DD) of expected publication',
                },
                suggested_time: {
                  type: 'string',
                  description: 'Time in HH:MM format (24h, CET timezone). Most European companies publish at 06:00-07:30 CET.',
                },
                confidence: {
                  type: 'number',
                  minimum: 0,
                  maximum: 1,
                  description: '0-1 confidence score. 0.9+ if based on confirmed pattern, 0.5-0.8 if estimated.',
                },
                reasoning: {
                  type: 'string',
                  description: 'Brief explanation of why this date/time was chosen (1-2 sentences)',
                },
                source: {
                  type: 'string',
                  enum: ['historical_pattern', 'industry_norm', 'public_announcement', 'estimated'],
                  description: 'Primary source for this prediction',
                },
              },
              required: ['suggested_date', 'suggested_time', 'confidence', 'reasoning', 'source'],
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'suggest_publication_date' },
        messages: [
          {
            role: 'user',
            content: `You are a corporate finance research assistant. Predict when ${company_name} will publish their ${report_type} report for fiscal year ${fiscal_year}.

Context:
- Report type: ${report_type} (annual = full year results, quarterly = Q1-Q4, half_year = H1/H2, sustainability = ESG/CSR)
- Fiscal year: ${fiscal_year}
- Today: ${new Date().toISOString().split('T')[0]}
- Industry: Building materials / construction (most companies in this sector publish annual results in February-March)
${historicalContext}

Important guidelines:
- Annual reports for European building materials companies typically publish in February-March of the following year
- US companies tend to publish earlier (January-February)
- Quarterly reports typically come 4-6 weeks after quarter end
- Most large-caps publish early morning (06:00-07:30 CET) to allow market absorption before trading opens
- If you have historical data, extrapolate the pattern (same weekday, similar date range)
- Be honest about confidence: high (0.9+) only if you have strong pattern data or public announcement`,
          },
        ],
      }),
    })

    if (!claudeResponse.ok) {
      const errBody = await claudeResponse.text()
      throw new Error(`Claude API error ${claudeResponse.status}: ${errBody}`)
    }

    const claudeJson = await claudeResponse.json()
    const toolUseBlock = claudeJson.content?.find(
      (block: { type: string }) => block.type === 'tool_use',
    )

    if (!toolUseBlock) {
      throw new Error('Claude did not return a suggestion')
    }

    const suggestion = toolUseBlock.input as {
      suggested_date: string
      suggested_time: string
      confidence: number
      reasoning: string
      source: string
    }

    // ------------------------------------------------------------------
    // 4. Track usage
    // ------------------------------------------------------------------
    await adminClient.from('ai_usage').insert({
      user_id: user.id,
      feature: 'suggest_dates',
      model_used: 'claude-haiku-4-5-20251001',
      input_tokens: claudeJson.usage?.input_tokens ?? 0,
      output_tokens: claudeJson.usage?.output_tokens ?? 0,
    })

    return jsonResponse({
      suggestion,
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
