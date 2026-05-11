/**
 * compute-comparability — AI-powered segment normalization engine.
 *
 * Given two companies and a fiscal year, analyzes their segment breakdowns,
 * news context, and report context to compute KPI adjustments that make
 * the numbers comparable.
 *
 * Example: If Company A has Roofing (50% of revenue) but Company B is pure
 * cement, this function adjusts Company A's Revenue/EBITDA to exclude Roofing,
 * making a fair comparison possible.
 *
 * POST { adjusted_company_id, reference_company_id, fiscal_year, benchmark_document_id? }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { logAnthropicUsage } from '../_shared/log-usage.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

interface AdjustmentResult {
  adjustments: {
    kpi_code: string
    original_value: number
    adjusted_value: number
    adjustment_amount: number
    adjustment_type: string
    segments_involved: string[]
    rationale: string
    confidence: number
    data_sources: string[]
  }[]
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return errorResponse('POST only', 405)

  // Allow both JWT and service_role
  const authHeader = req.headers.get('authorization') ?? ''
  const isServiceRole = authHeader.includes(SERVICE_ROLE_KEY)
  let userId: string | null = null
  if (!isServiceRole) {
    const authResult = await authenticateRequest(req)
    if (!authResult) return errorResponse('Unauthorized', 401)
    userId = authResult.user.id
  }

  const body = await req.json().catch(() => ({}))
  const { adjusted_company_id, reference_company_id, fiscal_year, benchmark_document_id } = body

  if (!adjusted_company_id || !reference_company_id || !fiscal_year) {
    return errorResponse('adjusted_company_id, reference_company_id, fiscal_year required', 400)
  }

  // Data isolation: verify both companies are in user's peer groups
  if (userId) {
    const { data: visibleIds } = await admin
      .rpc('visible_company_ids_for_user', { p_user_id: userId })
    const visible = new Set((visibleIds ?? []) as string[])
    if (!visible.has(adjusted_company_id) || !visible.has(reference_company_id)) {
      return errorResponse('One or both companies are not in your peer groups', 403)
    }
  }

  // Load companies
  const [adjCompRes, refCompRes] = await Promise.all([
    admin.from('companies').select('id, name, ticker, sector').eq('id', adjusted_company_id).single(),
    admin.from('companies').select('id, name, ticker, sector').eq('id', reference_company_id).single(),
  ])

  if (!adjCompRes.data || !refCompRes.data) return errorResponse('Company not found', 404)
  const adjComp = adjCompRes.data
  const refComp = refCompRes.data

  // Load segment breakdowns for both companies
  const [adjSegRes, refSegRes] = await Promise.all([
    admin.from('segment_breakdowns')
      .select('*')
      .eq('company_id', adjusted_company_id)
      .eq('fiscal_year', fiscal_year)
      .order('revenue_pct', { ascending: false }),
    admin.from('segment_breakdowns')
      .select('*')
      .eq('company_id', reference_company_id)
      .order('revenue_pct', { ascending: false })
      .limit(20),
  ])

  const adjSegments = adjSegRes.data ?? []
  const refSegments = refSegRes.data ?? []

  // Load KPI values for the adjusted company
  const { data: adjKpis } = await admin
    .from('kpi_values')
    .select('*, kpi_definitions(code, name, unit_type)')
    .eq('company_id', adjusted_company_id)
    .eq('fiscal_year', fiscal_year)
    .not('normalized_value', 'is', null)

  // Load report contexts
  const [adjCtxRes, refCtxRes] = await Promise.all([
    admin.from('report_contexts')
      .select('competitor_mentions, restructuring_notes, ma_activity, business_segments')
      .eq('company_id', adjusted_company_id)
      .eq('fiscal_year', fiscal_year)
      .maybeSingle(),
    admin.from('report_contexts')
      .select('competitor_mentions, restructuring_notes, ma_activity, business_segments')
      .eq('company_id', reference_company_id)
      .order('fiscal_year', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  // Load recent news (for one-off events like restructuring charges)
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const { data: adjNews } = await admin
    .from('company_news')
    .select('title, ai_summary, topics, published_at')
    .eq('company_id', adjusted_company_id)
    .eq('is_relevant', true)
    .gte('published_at', threeMonthsAgo.toISOString())
    .in('topics', ['{restructuring}', '{M&A}', '{earnings}'])
    .order('published_at', { ascending: false })
    .limit(10)

  // If no segment data exists for either company, we can't compute adjustments
  if (adjSegments.length === 0 && refSegments.length === 0) {
    return jsonResponse({
      message: 'No segment breakdowns available — cannot compute comparability adjustments',
      adjustments: [],
    })
  }

  // Build the prompt for Claude
  const adjSegText = adjSegments.map(s =>
    `- ${s.segment_name} (${s.segment_type}): Revenue ${s.revenue ?? '?'}M (${s.revenue_pct ?? '?'}%), EBITDA ${s.ebitda ?? '?'}M (${s.ebitda_pct ?? '?'}%)${s.notes ? ` [${s.notes}]` : ''}`
  ).join('\n')

  const refSegText = refSegments.map(s =>
    `- ${s.segment_name} (${s.segment_type}): Revenue ${s.revenue ?? '?'}M (${s.revenue_pct ?? '?'}%), EBITDA ${s.ebitda ?? '?'}M (${s.ebitda_pct ?? '?'}%)${s.notes ? ` [${s.notes}]` : ''}`
  ).join('\n')

  const adjKpiText = (adjKpis ?? []).map((k: { normalized_value: number; kpi_definitions: { code: string; name: string; unit_type: string } }) =>
    `- ${k.kpi_definitions.code} (${k.kpi_definitions.name}): ${k.normalized_value}M CHF`
  ).join('\n')

  let newsContextText = ''
  if (adjNews && adjNews.length > 0) {
    newsContextText = `\n\nRecent news for ${adjComp.name} (relevant to adjustments):\n${adjNews.map(n => `- [${n.published_at?.slice(0, 10)}] ${n.title} (${n.topics.join(', ')})`).join('\n')}`
  }

  let reportCtxText = ''
  if (adjCtxRes.data) {
    const ctx = adjCtxRes.data
    if (ctx.restructuring_notes?.length) {
      reportCtxText += `\nRestructuring notes: ${JSON.stringify(ctx.restructuring_notes)}`
    }
    if (ctx.ma_activity?.length) {
      reportCtxText += `\nM&A activity: ${JSON.stringify(ctx.ma_activity)}`
    }
  }

  const prompt = `You are a financial comparability analyst. Your task: determine what adjustments are needed to make ${adjComp.name}'s KPIs comparable to ${refComp.name} for FY${fiscal_year}.

## ${adjComp.name} — Segments:
${adjSegText || 'No segment data available'}

## ${refComp.name} — Segments:
${refSegText || 'No segment data available'}

## ${adjComp.name} — Current KPI Values (normalized, CHF millions):
${adjKpiText || 'No KPI data'}
${newsContextText}${reportCtxText}

## Rules:
1. If ${adjComp.name} has a segment that ${refComp.name} does NOT have (different product line), create a "segment_exclusion" adjustment removing that segment's contribution from Revenue, EBITDA, EBIT, etc.
2. If there are known one-off items (restructuring charges, M&A gains/losses) from news or report context, create "one_off_removal" adjustments.
3. If accounting treatment differs (from report context), create "accounting_reclass" adjustments.
4. Be precise with math. If a segment is 30% of revenue and revenue is 1000M, the adjustment is -300M.
5. Only create adjustments where you have sufficient data and confidence > 0.5.

Return ONLY a JSON object with this structure:
{
  "adjustments": [
    {
      "kpi_code": "REVENUE",
      "original_value": 1000,
      "adjusted_value": 700,
      "adjustment_amount": -300,
      "adjustment_type": "segment_exclusion",
      "segments_involved": ["Roofing"],
      "rationale": "Roofing segment excluded as HeidelbergMaterials has no equivalent business line. Roofing contributed 30% (300M CHF) of total revenue.",
      "confidence": 0.85,
      "data_sources": ["segment_breakdown_p45", "annual_report_FY2025"]
    }
  ]
}

No markdown code blocks. Just the JSON.`

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6-20250514',
        max_tokens: 4000,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!resp.ok) {
      const errText = await resp.text()
      console.error('Claude API error:', resp.status, errText)
      return errorResponse('AI computation failed', 500)
    }

    const data = await resp.json()
    await logAnthropicUsage('BenchmarkSignal', 'compute-comparability', data)
    const text = data.content?.[0]?.text ?? '{}'
    const jsonStr = text.replace(/```json?\s*/g, '').replace(/```/g, '').trim()
    const result: AdjustmentResult = JSON.parse(jsonStr)

    // Store adjustments
    if (result.adjustments.length > 0) {
      const rows = result.adjustments.map(a => ({
        benchmark_document_id: benchmark_document_id ?? null,
        adjusted_company_id,
        reference_company_id,
        fiscal_year,
        kpi_code: a.kpi_code,
        original_value: a.original_value,
        adjusted_value: a.adjusted_value,
        adjustment_amount: a.adjustment_amount,
        adjustment_type: a.adjustment_type,
        segments_involved: a.segments_involved,
        rationale: a.rationale,
        confidence: a.confidence,
        data_sources: a.data_sources,
        currency: 'CHF',
        ai_model_used: 'claude-sonnet-4-6',
      }))

      const { error: insertErr } = await admin
        .from('comparability_adjustments')
        .insert(rows)

      if (insertErr) {
        console.error('Adjustment insert error:', insertErr.message)
      }
    }

    console.log(`Computed ${result.adjustments.length} comparability adjustments: ${adjComp.name} → ${refComp.name} FY${fiscal_year}`)

    return jsonResponse({
      adjusted_company: adjComp.name,
      reference_company: refComp.name,
      fiscal_year,
      adjustments_count: result.adjustments.length,
      adjustments: result.adjustments,
    })
  } catch (err) {
    console.error('compute-comparability error:', (err as Error).message)
    return errorResponse('Computation failed: ' + (err as Error).message, 500)
  }
})
