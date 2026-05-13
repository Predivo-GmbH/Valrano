import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { logAnthropicUsage } from '../_shared/log-usage.ts'

const GEMINI_MODEL = 'gemini-2.5-flash'

interface InsightInput {
  insight_type: string
  title: string
  body: string
  related_company?: string
  related_kpi_code?: string
  priority: string
  data_confidence?: string
}

// Gemini JSON mode schema for structured insight output
const INSIGHTS_SCHEMA = {
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
} as const

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
      auto_generated = false,
      triggered_by = 'manual',
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

    // Guard: require a company to be set
    if (!myCompanyName) {
      return jsonResponse({
        insights: [],
        message: 'Set your company first in Settings to generate personalized insights.',
      })
    }

    // ------------------------------------------------------------------
    // 3. Scope to user's peer group companies only
    // ------------------------------------------------------------------
    const { data: visibleIds } = await adminClient
      .rpc('visible_company_ids_for_user', { p_user_id: user.id })

    if (!visibleIds || visibleIds.length === 0) {
      return jsonResponse({
        insights: [],
        message: 'Add peer companies first to generate competitive insights.',
      })
    }

    // ------------------------------------------------------------------
    // 4. Load KPI data with report type + category filtering
    // ------------------------------------------------------------------
    const kpiQuery = adminClient
      .from('kpi_values')
      .select(`
        company_id, fiscal_year, normalized_value, confidence,
        kpi_definitions(code, name, unit_type, category),
        companies(id, name),
        reports:report_id(report_type)
      `)
      .in('company_id', visibleIds as string[])
      .not('normalized_value', 'is', null)
      .gte('fiscal_year', startYear)
      .lte('fiscal_year', currentYear)
      .order('fiscal_year', { ascending: true })

    const { data: kpiValues, error: kpiError } = await kpiQuery.limit(2000)
    if (kpiError) throw new Error(`KPI load failed: ${kpiError.message}`)

    if (!kpiValues || kpiValues.length === 0) {
      const yearLabel = yearsBack === 1 ? `FY${currentYear}` : `FY${startYear}–${currentYear}`
      return jsonResponse({
        insights: [],
        message: `No KPI data found for ${yearLabel}. Upload reports (annual, quarterly, or sustainability) for ${myCompanyName} and your ${(visibleIds as string[]).length} peer companies to generate insights.`,
      })
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
      const yearLabel = yearsBack === 1 ? `FY${currentYear}` : `FY${startYear}–${currentYear}`
      const focusMsg = focus !== 'all' ? ` for "${focus}" KPIs` : ''
      const reportMsg = report_type !== 'all' ? ` in "${report_type}" reports` : ''
      return jsonResponse({
        insights: [],
        message: `No KPI data matches your filters${focusMsg}${reportMsg} in ${yearLabel}. Try broadening your filters or upload more reports.`,
      })
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
    // 7. Load PREVIOUS insights for delta detection
    // ------------------------------------------------------------------
    const { data: previousInsights } = await adminClient
      .from('ai_insights')
      .select('insight_type, title, body, related_company_id, related_kpi_code, priority')
      .eq('user_id', user.id)
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false })
      .limit(20)

    const previousFingerprints = new Map<string, { priority: string }>()
    if (previousInsights) {
      for (const pi of previousInsights) {
        const key = `${pi.insight_type}|${pi.related_kpi_code ?? ''}|${pi.related_company_id ?? ''}`
        previousFingerprints.set(key, { priority: pi.priority ?? 'low' })
      }
    }

    // ------------------------------------------------------------------
    // 8. Call Gemini 2.5 Flash with company-anchored prompt
    // ------------------------------------------------------------------
    const geminiApiKey = Deno.env.get('GOOGLE_AI_API_KEY')
    if (!geminiApiKey) throw new Error('GOOGLE_AI_API_KEY is not set')

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
            responseSchema: INSIGHTS_SCHEMA,
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

    await logAnthropicUsage('BenchmarkSignal', 'generate-insights', {
      model: GEMINI_MODEL,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    })

    const candidate = geminiJson.candidates?.[0]
    if (!candidate?.content?.parts?.[0]?.text) {
      throw new Error('Gemini did not return a valid response')
    }

    const parsed = JSON.parse(candidate.content.parts[0].text)
    const insights: InsightInput[] = parsed.insights ?? []

    // ------------------------------------------------------------------
    // 9. Resolve company names to IDs
    // ------------------------------------------------------------------
    const { data: allCompanies } = await adminClient.from('companies').select('id, name')
    const companyNameMap = new Map(
      (allCompanies ?? []).map((c: { id: string; name: string }) => [c.name.toLowerCase(), c.id])
    )

    // ------------------------------------------------------------------
    // 10. Delta detection — compare new vs previous insights
    // ------------------------------------------------------------------
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const priorityRank: Record<string, number> = { low: 1, medium: 2, high: 3 }

    const insightRows = insights.map((i) => {
      const companyId = i.related_company
        ? companyNameMap.get(i.related_company.toLowerCase()) ?? null
        : null
      const fingerprint = `${i.insight_type}|${i.related_kpi_code ?? ''}|${companyId ?? ''}`
      const prev = previousFingerprints.get(fingerprint)

      let deltaLabel: string | null = null
      if (previousInsights && previousInsights.length > 0) {
        if (!prev) {
          deltaLabel = 'new'
        } else {
          const prevRank = priorityRank[prev.priority] ?? 1
          const newRank = priorityRank[i.priority] ?? 1
          deltaLabel = newRank > prevRank ? 'worsened' : newRank < prevRank ? 'improved' : 'unchanged'
          previousFingerprints.delete(fingerprint)
        }
      }

      return {
        user_id: user.id,
        insight_type: i.insight_type,
        title: i.title,
        body: i.body,
        related_company_id: companyId,
        related_kpi_code: i.related_kpi_code ?? null,
        fiscal_year: currentYear,
        priority: i.priority,
        data_confidence: i.data_confidence ?? null,
        is_dismissed: false,
        delta_label: deltaLabel,
        generation_batch_id: batchId,
        auto_generated: auto_generated,
      }
    })

    // Delete old non-dismissed, non-bookmarked insights
    await adminClient
      .from('ai_insights')
      .delete()
      .eq('user_id', user.id)
      .eq('fiscal_year', currentYear)
      .eq('is_dismissed', false)
      .eq('is_bookmarked', false)

    const { data: inserted, error: insertError } = await adminClient
      .from('ai_insights')
      .insert(insightRows)
      .select()

    if (insertError) throw new Error(`Insight insert failed: ${insertError.message}`)

    // ------------------------------------------------------------------
    // 11. Create notifications for HIGH-priority risk flags
    // ------------------------------------------------------------------
    const riskFlags = (inserted ?? []).filter(
      (i: any) => i.insight_type === 'risk_flag' && i.priority === 'high'
    )

    if (riskFlags.length > 0) {
      await adminClient.from('notifications').insert(
        riskFlags.map((rf: any) => ({
          user_id: user.id,
          type: 'insight_risk_flag',
          title: `Risk Alert: ${rf.title}`,
          body: rf.body.length > 200 ? rf.body.slice(0, 200) + '...' : rf.body,
          link: '/dashboard',
          is_read: false,
        }))
      )
    }

    // ------------------------------------------------------------------
    // 12. Log generation for rate-limiting auto-triggers
    // ------------------------------------------------------------------
    await adminClient.from('ai_insight_auto_gen_log').insert({
      user_id: user.id,
      triggered_by,
      batch_id: batchId,
      insights_count: inserted?.length ?? 0,
    })

    const deltaSummary = {
      new: insightRows.filter((r) => r.delta_label === 'new').length,
      worsened: insightRows.filter((r) => r.delta_label === 'worsened').length,
      improved: insightRows.filter((r) => r.delta_label === 'improved').length,
      unchanged: insightRows.filter((r) => r.delta_label === 'unchanged').length,
    }

    return jsonResponse({
      insights: inserted,
      count: inserted?.length ?? 0,
      batch_id: batchId,
      delta_summary: deltaSummary,
      risk_notifications_sent: riskFlags.length,
      meta: {
        focus,
        time_range,
        report_type,
        fiscal_year: currentYear,
        companies_analyzed: dataMap.size,
        kpis_analyzed: allKpiCodes.size,
        data_points: filtered.length,
        auto_generated,
        triggered_by,
      },
    })
  } catch (err) {
    return errorResponse(err)
  }
})
