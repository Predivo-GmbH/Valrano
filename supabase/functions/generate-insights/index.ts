import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { user, adminClient } = await authenticateRequest(req)
    const { fiscal_year } = await req.json().catch(() => ({}))

    // ------------------------------------------------------------------
    // 1. Load all KPI data for analysis
    // ------------------------------------------------------------------
    let kpiQuery = adminClient
      .from('kpi_values')
      .select('company_id, fiscal_year, normalized_value, confidence, kpi_definitions(code, name, unit_type), companies(id, name)')
      .not('normalized_value', 'is', null)
      .order('fiscal_year', { ascending: false })

    if (fiscal_year) {
      kpiQuery = kpiQuery.gte('fiscal_year', fiscal_year - 1).lte('fiscal_year', fiscal_year)
    }

    const { data: kpiValues, error: kpiError } = await kpiQuery.limit(500)
    if (kpiError) throw new Error(`KPI load failed: ${kpiError.message}`)

    if (!kpiValues || kpiValues.length === 0) {
      return jsonResponse({ insights: [], message: 'No KPI data available for analysis' })
    }

    // ------------------------------------------------------------------
    // 2. Load accounting profile for context
    // ------------------------------------------------------------------
    const { data: profile } = await adminClient
      .from('accounting_profiles')
      .select('company_name, accounting_standard')
      .eq('user_id', user.id)
      .single()

    // ------------------------------------------------------------------
    // 3. Build analysis prompt
    // ------------------------------------------------------------------
    // Group by company + fiscal year + KPI
    const dataMap = new Map<string, Map<string, Map<string, number>>>()
    for (const kpi of kpiValues as any[]) {
      const company = kpi.companies?.name ?? 'Unknown'
      const code = kpi.kpi_definitions?.code ?? 'Unknown'
      const fy = String(kpi.fiscal_year)

      if (!dataMap.has(company)) dataMap.set(company, new Map())
      if (!dataMap.get(company)!.has(fy)) dataMap.get(company)!.set(fy, new Map())
      dataMap.get(company)!.get(fy)!.set(code, kpi.normalized_value)
    }

    let dataDescription = ''
    for (const [company, years] of dataMap) {
      dataDescription += `\n${company}:\n`
      for (const [fy, kpis] of years) {
        for (const [code, value] of kpis) {
          dataDescription += `  FY${fy} ${code}: ${value}\n`
        }
      }
    }

    // ------------------------------------------------------------------
    // 4. Call Claude to generate insights
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
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        tools: [
          {
            name: 'generate_insights',
            description: 'Generate proactive financial insights from peer benchmarking data',
            input_schema: {
              type: 'object',
              properties: {
                insights: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      insight_type: {
                        type: 'string',
                        enum: ['trend_reversal', 'outlier', 'risk_flag', 'opportunity'],
                      },
                      title: { type: 'string', description: 'Short headline (max 80 chars)' },
                      body: { type: 'string', description: 'Detailed insight (2-3 sentences with specific numbers)' },
                      related_company: { type: 'string', description: 'Company name this insight is about' },
                      related_kpi_code: { type: 'string' },
                      priority: { type: 'string', enum: ['low', 'medium', 'high'] },
                    },
                    required: ['insight_type', 'title', 'body', 'priority'],
                  },
                },
              },
              required: ['insights'],
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'generate_insights' },
        messages: [
          {
            role: 'user',
            content: `You are a senior strategy analyst. Analyze the following peer benchmarking data and identify the most important insights.
${profile ? `The user's company is ${profile.company_name} (${profile.accounting_standard}).` : ''}

Focus on:
1. **Outliers** — Companies with values significantly above or below the peer group
2. **Trend reversals** — KPIs that changed direction YoY (improving → declining or vice versa)
3. **Risk flags** — Competitors gaining significant ground or showing concerning patterns
4. **Opportunities** — Areas where the user's peer group is weak or where competitive advantages exist

Data:
${dataDescription}

Generate 3-6 insights, prioritized by importance. Be specific with numbers. Each insight should be actionable.`,
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
      throw new Error('Claude did not return a tool_use block')
    }

    const { insights } = toolUseBlock.input as {
      insights: {
        insight_type: string
        title: string
        body: string
        related_company?: string
        related_kpi_code?: string
        priority: string
      }[]
    }

    // ------------------------------------------------------------------
    // 5. Resolve company names to IDs and insert insights
    // ------------------------------------------------------------------
    const { data: allCompanies } = await adminClient.from('companies').select('id, name')
    const companyNameMap = new Map((allCompanies ?? []).map((c: { id: string; name: string }) => [c.name.toLowerCase(), c.id]))

    const targetFy = fiscal_year ?? new Date().getFullYear()

    // Delete old non-dismissed insights for this user + fiscal year to avoid duplicates
    await adminClient
      .from('ai_insights')
      .delete()
      .eq('user_id', user.id)
      .eq('fiscal_year', targetFy)
      .eq('is_dismissed', false)

    const insightRows = insights.map((i) => ({
      user_id: user.id,
      insight_type: i.insight_type,
      title: i.title,
      body: i.body,
      related_company_id: i.related_company
        ? companyNameMap.get(i.related_company.toLowerCase()) ?? null
        : null,
      related_kpi_code: i.related_kpi_code ?? null,
      fiscal_year: targetFy,
      priority: i.priority,
      is_dismissed: false,
    }))

    const { data: inserted, error: insertError } = await adminClient
      .from('ai_insights')
      .insert(insightRows)
      .select()

    if (insertError) throw new Error(`Insight insert failed: ${insertError.message}`)

    return jsonResponse({
      insights: inserted,
      count: inserted?.length ?? 0,
    })
  } catch (err) {
    return errorResponse(err)
  }
})
