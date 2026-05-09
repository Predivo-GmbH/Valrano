import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'

interface InsightInput {
  insight_type: string
  title: string
  body: string
  related_company?: string
  related_kpi_code?: string
  priority: string
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { user, adminClient } = await authenticateRequest(req)
    const {
      fiscal_year,
      focus = 'all',
      time_range = '1y',
      report_type = 'all',
    } = await req.json().catch(() => ({}))

    // ------------------------------------------------------------------
    // 1. Determine year range from time_range param
    // ------------------------------------------------------------------
    const currentYear = fiscal_year ?? new Date().getFullYear()
    const yearsBack = time_range === '5y' ? 5 : time_range === '3y' ? 3 : 1
    const startYear = currentYear - yearsBack + 1

    // ------------------------------------------------------------------
    // 2. Load user's company (anchor for all insights)
    // ------------------------------------------------------------------
    const { data: profile } = await adminClient
      .from('accounting_profiles')
      .select('company_name, accounting_standard')
      .eq('user_id', user.id)
      .single()

    const { data: primaryCompany } = await adminClient
      .from('my_companies')
      .select('company_id, companies(id, name)')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .single()

    const myCompanyName = profile?.company_name
      ?? (primaryCompany as unknown as { companies: { name: string } })?.companies?.name
      ?? null

    // ------------------------------------------------------------------
    // 3. Load KPI data with report type + category filtering
    // ------------------------------------------------------------------
    let kpiQuery = adminClient
      .from('kpi_values')
      .select(`
        company_id, fiscal_year, normalized_value, confidence,
        kpi_definitions(code, name, unit_type, category),
        companies(id, name),
        reports:report_id(report_type)
      `)
      .not('normalized_value', 'is', null)
      .gte('fiscal_year', startYear)
      .lte('fiscal_year', currentYear)
      .order('fiscal_year', { ascending: true })

    const { data: kpiValues, error: kpiError } = await kpiQuery.limit(2000)
    if (kpiError) throw new Error(`KPI load failed: ${kpiError.message}`)

    if (!kpiValues || kpiValues.length === 0) {
      return jsonResponse({ insights: [], message: 'No KPI data available for analysis' })
    }

    // ------------------------------------------------------------------
    // 4. Apply client-side filters (focus area + report type)
    // ------------------------------------------------------------------
    const filtered = (kpiValues as any[]).filter((kpi) => {
      if (focus !== 'all' && kpi.kpi_definitions?.category !== focus) return false
      if (report_type !== 'all' && kpi.reports?.report_type !== report_type) return false
      return true
    })

    if (filtered.length === 0) {
      return jsonResponse({ insights: [], message: 'No data matches the selected filters' })
    }

    // ------------------------------------------------------------------
    // 5. Build structured data grouped by company → year → KPI
    // ------------------------------------------------------------------
    const dataMap = new Map<string, Map<number, Map<string, { value: number; unit: string }>>>()
    const allKpiCodes = new Set<string>()

    for (const kpi of filtered) {
      const company = kpi.companies?.name ?? 'Unknown'
      const code = kpi.kpi_definitions?.code ?? 'Unknown'
      const fy = kpi.fiscal_year as number
      const unit = kpi.kpi_definitions?.unit_type ?? 'number'

      allKpiCodes.add(code)

      if (!dataMap.has(company)) dataMap.set(company, new Map())
      if (!dataMap.get(company)!.has(fy)) dataMap.get(company)!.set(fy, new Map())
      dataMap.get(company)!.get(fy)!.set(code, { value: kpi.normalized_value, unit })
    }

    // Count data completeness per company (for confidence)
    const maxPossibleDataPoints = allKpiCodes.size * yearsBack
    const companyCompleteness = new Map<string, number>()
    for (const [company, years] of dataMap) {
      let count = 0
      for (const [, kpis] of years) count += kpis.size
      companyCompleteness.set(company, Math.round((count / maxPossibleDataPoints) * 100))
    }

    // ------------------------------------------------------------------
    // 6. Build analysis prompt — company-anchored, trend-aware
    // ------------------------------------------------------------------
    let dataDescription = ''
    const years = Array.from({ length: yearsBack }, (_, i) => startYear + i)

    // Build a table-like format for clearer analysis
    for (const [company, yearMap] of dataMap) {
      const isMyCompany = myCompanyName && company.toLowerCase() === myCompanyName.toLowerCase()
      dataDescription += `\n${company}${isMyCompany ? ' [USER\'S COMPANY]' : ''} (data completeness: ${companyCompleteness.get(company)}%):\n`

      for (const year of years) {
        const kpis = yearMap.get(year)
        if (!kpis) continue
        const entries = Array.from(kpis.entries())
          .map(([code, { value, unit }]) => {
            const formatted = unit === 'percentage' ? `${value}%`
              : unit === 'ratio' ? `${value}x`
              : unit === 'currency' ? `CHF ${value.toLocaleString()}`
              : String(value)
            return `${code}=${formatted}`
          })
          .join(', ')
        dataDescription += `  FY${year}: ${entries}\n`
      }
    }

    const focusLabel = focus === 'all' ? 'all categories'
      : focus === 'financial' ? 'financial KPIs'
      : focus === 'esg' ? 'ESG metrics'
      : 'operational KPIs'

    const timeLabel = yearsBack === 1 ? `FY${currentYear}` : `FY${startYear}–${currentYear} (${yearsBack}-year trend)`

    // ------------------------------------------------------------------
    // 7. Call Claude with company-anchored prompt
    // ------------------------------------------------------------------
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) throw new Error('ANTHROPIC_API_KEY is not set')

    const systemPrompt = `You are a senior strategy analyst preparing a competitive intelligence briefing for ${myCompanyName ?? 'the user\'s company'}. Your job is to surface actionable insights from peer benchmarking data.

RULES:
- Every insight MUST be framed relative to the user's company. Don't just say "Company X has high margins" — say "Company X's margins are 12pp above yours, posing a competitive threat in pricing."
- Use specific numbers and percentages. Never vague language like "significantly higher."
- ${yearsBack > 1 ? `Analyze TRENDS over the ${yearsBack}-year period. Direction of change matters more than absolute values.` : 'Focus on the current position within the peer group.'}
- Rank insights by strategic importance to the user's company.
- Each insight body must end with a concrete recommendation (1 sentence starting with "Consider...").
- If data completeness for a company is below 50%, note this as a caveat.`

    const userPrompt = `Analyze ${focusLabel} for ${timeLabel}.

${myCompanyName ? `The user's company is ${myCompanyName}${profile?.accounting_standard ? ` (${profile.accounting_standard})` : ''}. All insights should be relative to this company.` : 'No primary company set — provide general peer group analysis.'}

Peer group data:
${dataDescription}

Generate 3-8 insights based on data availability. Prioritize:
1. **Risk flags** — peers gaining ground on the user or showing threatening momentum
2. **Opportunities** — areas where the user leads or peers are weak
3. **Trend reversals** — KPIs that changed direction YoY (only if multi-year data)
4. **Outliers** — values far from peer group median`

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
            description: 'Generate company-anchored competitive intelligence insights',
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
                      title: { type: 'string', description: 'Short headline (max 80 chars), framed relative to user company' },
                      body: { type: 'string', description: '2-3 sentences with specific numbers, ending with "Consider..." recommendation' },
                      related_company: { type: 'string', description: 'Primary company this insight references' },
                      related_kpi_code: { type: 'string', description: 'KPI code (e.g. EBITDA_MARGIN, REVENUE)' },
                      priority: { type: 'string', enum: ['low', 'medium', 'high'] },
                      data_confidence: {
                        type: 'string',
                        enum: ['high', 'medium', 'low'],
                        description: 'How complete/reliable the underlying data is for this insight',
                      },
                    },
                    required: ['insight_type', 'title', 'body', 'priority', 'data_confidence'],
                  },
                },
              },
              required: ['insights'],
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'generate_insights' },
        messages: [
          { role: 'user', content: userPrompt },
        ],
        system: systemPrompt,
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
      insights: (InsightInput & { data_confidence?: string })[]
    }

    // ------------------------------------------------------------------
    // 8. Resolve company names to IDs and insert insights
    // ------------------------------------------------------------------
    const { data: allCompanies } = await adminClient.from('companies').select('id, name')
    const companyNameMap = new Map(
      (allCompanies ?? []).map((c: { id: string; name: string }) => [c.name.toLowerCase(), c.id])
    )

    // Delete old non-dismissed insights for this user + fiscal year + focus to avoid duplicates
    let deleteQuery = adminClient
      .from('ai_insights')
      .delete()
      .eq('user_id', user.id)
      .eq('fiscal_year', currentYear)
      .eq('is_dismissed', false)

    await deleteQuery

    const insightRows = insights.map((i) => ({
      user_id: user.id,
      insight_type: i.insight_type,
      title: i.title,
      body: i.body,
      related_company_id: i.related_company
        ? companyNameMap.get(i.related_company.toLowerCase()) ?? null
        : null,
      related_kpi_code: i.related_kpi_code ?? null,
      fiscal_year: currentYear,
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
      meta: {
        focus,
        time_range,
        report_type,
        fiscal_year: currentYear,
        companies_analyzed: dataMap.size,
        kpis_analyzed: allKpiCodes.size,
        data_points: filtered.length,
      },
    })
  } catch (err) {
    return errorResponse(err)
  }
})
