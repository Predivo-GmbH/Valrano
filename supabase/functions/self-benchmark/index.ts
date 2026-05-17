import { authenticateRequest, errorResponse, jsonResponse, AuthError } from '../_shared/auth.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logAnthropicUsage } from '../_shared/log-usage.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
if (!ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY not set')
}

interface SelfBenchmarkRequest {
  my_company_id: string
  peer_group_id?: string
  fiscal_year?: number
}

interface KpiPercentile {
  kpi_code: string
  kpi_name: string
  my_value: number
  peer_median: number
  peer_p25: number
  peer_p75: number
  peer_min: number
  peer_max: number
  percentile: number
  peer_count: number
  gap_to_median: number
  gap_to_median_pct: number
  signal: 'strength' | 'neutral' | 'weakness'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { user, adminClient } = await authenticateRequest(req)

    const body: SelfBenchmarkRequest = await req.json()
    if (!body.my_company_id) {
      throw new AuthError('my_company_id is required', 400)
    }

    // Verify ownership
    const { data: myCompany, error: mcErr } = await adminClient
      .from('my_companies')
      .select('*')
      .eq('id', body.my_company_id)
      .eq('user_id', user.id)
      .single()
    if (mcErr || !myCompany) {
      throw new AuthError('Company not found or not owned by user', 404)
    }

    // Get user's KPI values for this company
    const fiscalYear = body.fiscal_year ?? new Date().getFullYear() - 1
    const { data: myKpis, error: kpiErr } = await adminClient
      .from('my_company_kpis')
      .select('*, kpi_definitions(*)')
      .eq('my_company_id', body.my_company_id)
      .eq('fiscal_year', fiscalYear)
    if (kpiErr) throw new AuthError('Failed to load KPIs', 500)
    if (!myKpis || myKpis.length === 0) {
      throw new AuthError('No KPI data found for the selected year', 400)
    }

    // Get peer group companies
    let peerCompanyIds: string[] = []
    if (body.peer_group_id) {
      const { data: members } = await adminClient
        .from('peer_group_members')
        .select('company_id')
        .eq('peer_group_id', body.peer_group_id)
      peerCompanyIds = (members ?? []).map((m: { company_id: string }) => m.company_id)
    } else {
      // Default: all active companies in same sector
      const { data: sectorCompanies } = await adminClient
        .from('companies')
        .select('id')
        .eq('is_active', true)
        .eq('sector', myCompany.sector ?? '')
      peerCompanyIds = (sectorCompanies ?? []).map((c: { id: string }) => c.id)
      // Fallback to all companies if sector match is too small
      if (peerCompanyIds.length < 3) {
        const { data: allCompanies } = await adminClient
          .from('companies')
          .select('id')
          .eq('is_active', true)
        peerCompanyIds = (allCompanies ?? []).map((c: { id: string }) => c.id)
      }
    }

    if (peerCompanyIds.length === 0) {
      throw new AuthError('No peer companies found for comparison', 400)
    }

    // Get peer KPI values for matching KPIs and year
    const myKpiDefIds = myKpis.map((k: { kpi_definition_id: string }) => k.kpi_definition_id)
    const { data: peerKpis, error: peerErr } = await adminClient
      .from('kpi_values')
      .select('*, kpi_definitions(*)')
      .in('company_id', peerCompanyIds)
      .in('kpi_definition_id', myKpiDefIds)
      .eq('fiscal_year', fiscalYear)
    if (peerErr) throw new AuthError('Failed to load peer KPIs', 500)

    // Calculate percentiles for each KPI
    const results: KpiPercentile[] = []
    for (const myKpi of myKpis) {
      const kpiDef = myKpi.kpi_definitions
      const peerValues = (peerKpis ?? [])
        .filter((p: { kpi_definition_id: string; normalized_value: number | null }) =>
          p.kpi_definition_id === myKpi.kpi_definition_id && p.normalized_value !== null
        )
        .map((p: { normalized_value: number }) => p.normalized_value)
        .sort((a: number, b: number) => a - b)

      if (peerValues.length === 0) continue

      const myValue = Number(myKpi.value)
      const peerCount = peerValues.length
      const belowCount = peerValues.filter((v: number) => v < myValue).length
      const percentile = Math.round((belowCount / peerCount) * 100)

      const median = getMedian(peerValues)
      const p25 = getPercentile(peerValues, 25)
      const p75 = getPercentile(peerValues, 75)
      const gapToMedian = myValue - median
      const gapToMedianPct = median !== 0 ? Math.round((gapToMedian / Math.abs(median)) * 100) : 0

      let signal: 'strength' | 'neutral' | 'weakness' = 'neutral'
      if (percentile >= 70) signal = 'strength'
      else if (percentile <= 30) signal = 'weakness'

      results.push({
        kpi_code: kpiDef.code,
        kpi_name: kpiDef.name,
        my_value: myValue,
        peer_median: median,
        peer_p25: p25,
        peer_p75: p75,
        peer_min: peerValues[0],
        peer_max: peerValues[peerValues.length - 1],
        percentile,
        peer_count: peerCount,
        gap_to_median: Math.round(gapToMedian * 100) / 100,
        gap_to_median_pct: gapToMedianPct,
        signal,
      })
    }

    // Generate AI narrative
    let aiNarrative = ''
    if (ANTHROPIC_API_KEY && results.length > 0) {
      const strengths = results.filter((r) => r.signal === 'strength')
      const weaknesses = results.filter((r) => r.signal === 'weakness')

      const prompt = `You are a senior financial analyst. Based on the following self-benchmark results for "${myCompany.name}" (sector: ${myCompany.sector || 'General'}) against ${peerCompanyIds.length} peer companies for fiscal year ${fiscalYear}, write a concise executive summary (3-5 paragraphs).

RESULTS:
${results.map((r) => `- ${r.kpi_name}: Company value ${r.my_value}, Peer median ${r.peer_median}, Percentile P${r.percentile}, Signal: ${r.signal}`).join('\n')}

STRENGTHS (P70+): ${strengths.map((s) => s.kpi_name).join(', ') || 'None'}
WEAKNESSES (P30-): ${weaknesses.map((w) => w.kpi_name).join(', ') || 'None'}

Write:
1. Overall competitive position summary (1 paragraph)
2. Key strengths and what drives them (1 paragraph)
3. Areas for improvement with actionable insights (1 paragraph)
4. Strategic recommendation (1 paragraph)

Be specific with numbers. Use professional financial language. Do not use bullet points — write flowing paragraphs.`

      try {
        const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6-20250514',
            max_tokens: 1024,
            temperature: 0,
            messages: [{ role: 'user', content: prompt }],
          }),
        })

        if (aiResponse.ok) {
          const aiData = await aiResponse.json()
          await logAnthropicUsage('Valrano', 'self-benchmark', aiData)
          aiNarrative = aiData.content?.[0]?.text ?? ''
        }
      } catch (aiErr) {
        console.error('AI narrative generation failed:', aiErr)
        // Non-fatal — continue without narrative
      }
    }

    // Store the benchmark result
    const { data: stored, error: storeErr } = await adminClient
      .from('self_benchmarks')
      .insert({
        my_company_id: body.my_company_id,
        peer_group_id: body.peer_group_id ?? null,
        fiscal_year: fiscalYear,
        results_json: { kpi_percentiles: results, peer_company_count: peerCompanyIds.length },
        ai_narrative: aiNarrative || null,
      })
      .select()
      .single()
    if (storeErr) {
      console.error('Failed to store benchmark:', storeErr)
    }

    return jsonResponse({
      benchmark_id: stored?.id ?? null,
      company_name: myCompany.name,
      fiscal_year: fiscalYear,
      peer_count: peerCompanyIds.length,
      kpi_percentiles: results,
      strengths: results.filter((r) => r.signal === 'strength'),
      weaknesses: results.filter((r) => r.signal === 'weakness'),
      ai_narrative: aiNarrative,
      overall_percentile: results.length > 0
        ? Math.round(results.reduce((sum, r) => sum + r.percentile, 0) / results.length)
        : null,
    })
  } catch (err) {
    return errorResponse(err)
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMedian(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

function getPercentile(sorted: number[], p: number): number {
  const index = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)
}
