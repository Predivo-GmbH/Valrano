import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'

// ---------------------------------------------------------------------------
// Benchmark document content structure (matches BenchmarkContentJson)
// ---------------------------------------------------------------------------
interface BenchmarkContentJson {
  executive_summary: string
  key_findings: string[]
  competitive_position: 'improved' | 'stable' | 'declined'
  sections: {
    title: string
    narrative: string
    kpi_comparisons: {
      kpi_code: string
      kpi_name: string
      trigger_company_value: number | null
      customer_company_value: number | null
      peer_median: number | null
      peer_rank: number | null
      peer_count: number
      yoy_change_pct: number | null
      assessment: string
      signal: 'risk' | 'neutral' | 'advantage'
    }[]
  }[]
  risk_flags: string[]
  data_quality: {
    total_kpis_compared: number
    high_confidence_pct: number
    fx_rates_used: string[]
  }
}

// ---------------------------------------------------------------------------
// KPI category grouping
// ---------------------------------------------------------------------------
const CATEGORY_MAP: Record<string, string> = {
  REVENUE: 'Financial Performance',
  EBITDA: 'Financial Performance',
  EBITDA_ADJ: 'Financial Performance',
  EBITDA_MARGIN: 'Financial Performance',
  EBIT: 'Financial Performance',
  NET_INCOME: 'Financial Performance',
  EPS_BASIC: 'Financial Performance',
  NET_DEBT: 'Financial Performance',
  NET_DEBT_EBITDA: 'Financial Performance',
  ROIC: 'Financial Performance',
  CAPEX: 'Financial Performance',
  CO2_ABSOLUTE: 'ESG & Sustainability',
  CO2_INTENSITY: 'ESG & Sustainability',
  LTIFR: 'ESG & Sustainability',
  CEMENT_VOLUME: 'Operational Performance',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { adminClient } = await authenticateRequest(req)

    const { report_id: reportId, benchmark_rule_id: ruleId } = await req.json()
    if (!reportId) {
      return jsonResponse({ error: 'Missing required field: report_id' }, 400)
    }

    // ------------------------------------------------------------------
    // 1. Load report + trigger company
    // ------------------------------------------------------------------
    const { data: report, error: reportError } = await adminClient
      .from('reports')
      .select('*, companies(id, name, ticker, reporting_currency)')
      .eq('id', reportId)
      .single()

    if (reportError) throw new Error(`Report lookup failed: ${reportError.message}`)
    if (!report) return jsonResponse({ error: `Report not found: ${reportId}` }, 404)

    const triggerCompany = report.companies as { id: string; name: string; ticker: string | null; reporting_currency: string | null }

    // ------------------------------------------------------------------
    // 2. Load benchmark rule (find default if none specified)
    // ------------------------------------------------------------------
    let rule: {
      id: string
      customer_company_id: string
      name: string
      narrative_style: string
      kpi_selection: { kpi_definition_id: string; code: string; weight: number; threshold_pct: number | null }[]
      peer_group_id: string | null
    }

    if (ruleId) {
      const { data, error } = await adminClient
        .from('benchmark_rules')
        .select('*')
        .eq('id', ruleId)
        .single()
      if (error) throw new Error(`Rule lookup failed: ${error.message}`)
      rule = data
    } else {
      const { data, error } = await adminClient
        .from('benchmark_rules')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .single()
      if (error) throw new Error(`No benchmark rules found: ${error.message}`)
      rule = data
    }

    // ------------------------------------------------------------------
    // 3. Load customer company (Holcim)
    // ------------------------------------------------------------------
    const { data: customerCompany, error: custError } = await adminClient
      .from('companies')
      .select('id, name, ticker')
      .eq('id', rule.customer_company_id)
      .single()

    if (custError) throw new Error(`Customer company lookup failed: ${custError.message}`)

    // ------------------------------------------------------------------
    // 4. Load all normalized KPI values for the fiscal year
    // ------------------------------------------------------------------
    const { data: allKpiValues, error: kpiError } = await adminClient
      .from('kpi_values')
      .select('*, kpi_definitions(id, code, name, category, unit_type), companies(id, name)')
      .eq('fiscal_year', report.fiscal_year)
      .not('normalized_value', 'is', null)

    if (kpiError) throw new Error(`KPI values lookup failed: ${kpiError.message}`)

    // Group by company_id → kpi_code → value
    type KpiRow = {
      id: string
      company_id: string
      normalized_value: number
      confidence: number
      fx_rate_used: number | null
      kpi_definitions: { id: string; code: string; name: string; category: string; unit_type: string }
      companies: { id: string; name: string }
    }

    const rows = (allKpiValues ?? []) as KpiRow[]

    // Build per-company KPI map
    const companyKpiMap = new Map<string, Map<string, KpiRow>>()
    for (const row of rows) {
      const code = row.kpi_definitions?.code
      if (!code) continue
      if (!companyKpiMap.has(row.company_id)) {
        companyKpiMap.set(row.company_id, new Map())
      }
      companyKpiMap.get(row.company_id)!.set(code, row)
    }

    // Get selected KPI codes from the rule
    const selectedCodes = new Set(rule.kpi_selection.map((s) => s.code))

    // Build the comparison data for the prompt
    const comparisonData: string[] = []
    const triggerKpis = companyKpiMap.get(triggerCompany.id) ?? new Map()
    const customerKpis = companyKpiMap.get(customerCompany.id) ?? new Map()

    // Collect all company values for peer stats
    const allCompanyIds = new Set(rows.map((r) => r.company_id))
    const peerCount = allCompanyIds.size

    // Track FX rates used
    const fxRatesUsed = new Set<string>()

    for (const sel of rule.kpi_selection) {
      const code = sel.code
      const triggerVal = triggerKpis.get(code)
      const customerVal = customerKpis.get(code)

      // Peer values for this KPI
      const peerValues: number[] = []
      for (const [, kpiMap] of companyKpiMap) {
        const v = kpiMap.get(code)
        if (v?.normalized_value !== undefined) {
          peerValues.push(v.normalized_value)
        }
      }

      const median = peerValues.length > 0
        ? peerValues.sort((a, b) => a - b)[Math.floor(peerValues.length / 2)]
        : null

      if (triggerVal?.fx_rate_used) {
        fxRatesUsed.add(`${triggerVal.companies?.name}: ${triggerVal.fx_rate_used}`)
      }

      comparisonData.push(
        `KPI: ${code} (${triggerVal?.kpi_definitions?.name ?? code})` +
        `\n  ${triggerCompany.name}: ${triggerVal?.normalized_value ?? 'N/A'} CHF (millions)` +
        `\n  ${customerCompany.name}: ${customerVal?.normalized_value ?? 'N/A'} CHF (millions)` +
        `\n  Peer Median: ${median ?? 'N/A'}` +
        `\n  Peers with data: ${peerValues.length}/${peerCount}` +
        `\n  Weight: ${sel.weight}, Threshold: ${sel.threshold_pct ?? 'none'}`
      )
    }

    // Confidence stats
    const confidenceValues = rows
      .filter((r) => selectedCodes.has(r.kpi_definitions?.code) && r.confidence !== null)
      .map((r) => r.confidence)
    const highConfPct = confidenceValues.length > 0
      ? Math.round((confidenceValues.filter((c) => c >= 0.85).length / confidenceValues.length) * 100)
      : 0

    // ------------------------------------------------------------------
    // 5. Call Claude to generate the benchmark narrative
    // ------------------------------------------------------------------
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) throw new Error('ANTHROPIC_API_KEY is not set')

    const narrativeStyleLabel = {
      executive_brief: 'concise executive brief (1-2 pages, bullet-point findings, crisp language)',
      detailed_analysis: 'detailed analysis (3-5 pages, thorough narrative with data citations)',
      board_presentation: 'board presentation style (clear headlines, strategic implications, decision-ready)',
    }[rule.narrative_style] ?? 'executive brief'

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        tools: [
          {
            name: 'generate_benchmark',
            description: 'Generate a structured competitive benchmark document',
            input_schema: {
              type: 'object',
              properties: {
                executive_summary: {
                  type: 'string',
                  description: 'Executive summary paragraph (2-4 sentences)',
                },
                key_findings: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '3-5 key findings as bullet points',
                },
                competitive_position: {
                  type: 'string',
                  enum: ['improved', 'stable', 'declined'],
                  description: 'Overall competitive position assessment relative to the competitor',
                },
                sections: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      narrative: {
                        type: 'string',
                        description: 'Analysis narrative for this section',
                      },
                      kpi_comparisons: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            kpi_code: { type: 'string' },
                            kpi_name: { type: 'string' },
                            trigger_company_value: { type: ['number', 'null'] },
                            customer_company_value: { type: ['number', 'null'] },
                            peer_median: { type: ['number', 'null'] },
                            peer_rank: { type: ['integer', 'null'] },
                            peer_count: { type: 'integer' },
                            yoy_change_pct: { type: ['number', 'null'] },
                            assessment: { type: 'string' },
                            signal: {
                              type: 'string',
                              enum: ['risk', 'neutral', 'advantage'],
                            },
                          },
                          required: ['kpi_code', 'kpi_name', 'peer_count', 'assessment', 'signal'],
                        },
                      },
                    },
                    required: ['title', 'narrative', 'kpi_comparisons'],
                  },
                },
                risk_flags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Areas where the competitor outperforms or poses strategic risk',
                },
              },
              required: ['executive_summary', 'key_findings', 'competitive_position', 'sections', 'risk_flags'],
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'generate_benchmark' },
        messages: [
          {
            role: 'user',
            content: `You are a senior strategy analyst at ${customerCompany.name}. Generate a ${narrativeStyleLabel} comparing ${triggerCompany.name} (competitor) against ${customerCompany.name} (our company) for FY ${report.fiscal_year}.

Context:
- ${triggerCompany.name} has just published their ${report.report_type} report for FY ${report.fiscal_year}
- All values are normalized to CHF (millions) for comparable analysis
- ${customerCompany.name} is the reference company (our company)
- ${triggerCompany.name} is the competitor being analyzed

KPI Comparison Data:
${comparisonData.join('\n\n')}

Group the analysis into logical sections (Financial Performance, ESG & Sustainability, Operational Performance as applicable).
For each KPI, assess whether it represents a "risk" (competitor outperforms), "advantage" (we outperform), or "neutral".
Be specific with numbers. Reference actual values. Identify strategic implications.
Flag areas where the competitor is gaining ground or significantly outperforming.`,
          },
        ],
      }),
    })

    if (!claudeResponse.ok) {
      const errBody = await claudeResponse.text()
      throw new Error(`Claude API error ${claudeResponse.status}: ${errBody}`)
    }

    const claudeJson = await claudeResponse.json()

    // ------------------------------------------------------------------
    // 6. Parse tool-use response
    // ------------------------------------------------------------------
    const toolUseBlock = claudeJson.content?.find(
      (block: { type: string }) => block.type === 'tool_use',
    )

    if (!toolUseBlock) {
      throw new Error('Claude did not return a tool_use block')
    }

    const generated = toolUseBlock.input as Omit<BenchmarkContentJson, 'data_quality'>

    // Assemble full content
    const contentJson: BenchmarkContentJson = {
      ...generated,
      data_quality: {
        total_kpis_compared: selectedCodes.size,
        high_confidence_pct: highConfPct,
        fx_rates_used: [...fxRatesUsed],
      },
    }

    // ------------------------------------------------------------------
    // 7. Generate HTML rendering
    // ------------------------------------------------------------------
    const contentHtml = renderBenchmarkHtml(contentJson, {
      customerName: customerCompany.name,
      triggerName: triggerCompany.name,
      fiscalYear: report.fiscal_year,
      reportType: report.report_type,
    })

    // ------------------------------------------------------------------
    // 8. Insert benchmark_documents row
    // ------------------------------------------------------------------
    const title = `${triggerCompany.name} ${report.report_type === 'annual' ? 'Annual' : report.report_type} Benchmark — FY ${report.fiscal_year}`

    const { data: doc, error: docError } = await adminClient
      .from('benchmark_documents')
      .insert({
        benchmark_rule_id: rule.id,
        trigger_report_id: reportId,
        trigger_company_id: triggerCompany.id,
        customer_company_id: customerCompany.id,
        fiscal_year: report.fiscal_year,
        title,
        status: 'draft',
        content_json: contentJson,
        content_html: contentHtml,
        generated_at: new Date().toISOString(),
        generated_by: 'system',
        ai_model_used: 'claude-sonnet-4-6',
      })
      .select()
      .single()

    if (docError) throw new Error(`Document insert failed: ${docError.message}`)

    return jsonResponse({
      document_id: doc.id,
      title,
      status: 'draft',
      sections: contentJson.sections.length,
      risk_flags: contentJson.risk_flags.length,
      competitive_position: contentJson.competitive_position,
    })
  } catch (err) {
    return errorResponse(err)
  }
})

// ---------------------------------------------------------------------------
// HTML renderer — produces a self-contained benchmark document
// ---------------------------------------------------------------------------
function renderBenchmarkHtml(
  content: BenchmarkContentJson,
  meta: { customerName: string; triggerName: string; fiscalYear: number; reportType: string },
): string {
  const positionColor = {
    improved: '#22c55e',
    stable: '#3b82f6',
    declined: '#ef4444',
  }[content.competitive_position]

  const positionLabel = {
    improved: 'Improved',
    stable: 'Stable',
    declined: 'Declined',
  }[content.competitive_position]

  const signalIcon = (signal: string) => {
    if (signal === 'risk') return '<span style="color:#ef4444">&#9650;</span>'
    if (signal === 'advantage') return '<span style="color:#22c55e">&#9660;</span>'
    return '<span style="color:#6b7280">&#9679;</span>'
  }

  const fmtVal = (v: number | null | undefined) => {
    if (v === null || v === undefined) return '—'
    if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}B`
    return `${v.toFixed(0)}M`
  }

  const sectionsHtml = content.sections
    .map(
      (section) => `
    <div style="margin-bottom:32px">
      <h2 style="font-size:18px;font-weight:600;color:#f8fafc;margin:0 0 12px 0;padding-bottom:8px;border-bottom:1px solid #334155">${section.title}</h2>
      <p style="font-size:14px;line-height:1.7;color:#cbd5e1;margin:0 0 16px 0">${section.narrative}</p>
      ${
        section.kpi_comparisons.length > 0
          ? `<table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="border-bottom:1px solid #334155">
            <th style="text-align:left;padding:8px 12px;color:#94a3b8;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">KPI</th>
            <th style="text-align:right;padding:8px 12px;color:#94a3b8;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">${meta.triggerName}</th>
            <th style="text-align:right;padding:8px 12px;color:#94a3b8;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">${meta.customerName}</th>
            <th style="text-align:right;padding:8px 12px;color:#94a3b8;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Peer Median</th>
            <th style="text-align:center;padding:8px 12px;color:#94a3b8;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Signal</th>
          </tr>
        </thead>
        <tbody>
          ${section.kpi_comparisons
            .map(
              (kpi) => `
          <tr style="border-bottom:1px solid #1e293b">
            <td style="padding:10px 12px;color:#e2e8f0;font-weight:500">${kpi.kpi_name}</td>
            <td style="padding:10px 12px;text-align:right;color:#e2e8f0;font-variant-numeric:tabular-nums">${fmtVal(kpi.trigger_company_value)}</td>
            <td style="padding:10px 12px;text-align:right;color:#e2e8f0;font-variant-numeric:tabular-nums">${fmtVal(kpi.customer_company_value)}</td>
            <td style="padding:10px 12px;text-align:right;color:#94a3b8;font-variant-numeric:tabular-nums">${fmtVal(kpi.peer_median)}</td>
            <td style="padding:10px 12px;text-align:center">${signalIcon(kpi.signal)}</td>
          </tr>`,
            )
            .join('')}
        </tbody>
      </table>`
          : ''
      }
    </div>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${meta.triggerName} Benchmark — FY ${meta.fiscalYear}</title>
<style>
  @media print { body { background: #fff !important; color: #000 !important; } }
  * { box-sizing: border-box; }
</style>
</head>
<body style="margin:0;padding:40px;background:#0f172a;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:900px;margin:0 auto">

  <!-- Header -->
  <div style="margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #334155">
    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#3b82f6;margin-bottom:8px">BenchmarkSignal</div>
    <h1 style="font-size:28px;font-weight:700;color:#f8fafc;margin:0 0 8px 0">${meta.triggerName} — ${meta.reportType === 'annual' ? 'Annual' : meta.reportType} Benchmark</h1>
    <div style="font-size:13px;color:#94a3b8">FY ${meta.fiscalYear} · Compared against ${meta.customerName} and peer group</div>
    <div style="margin-top:12px;display:inline-block;padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:600;color:${positionColor};border:1px solid ${positionColor}40;background:${positionColor}15">
      Competitive Position: ${positionLabel}
    </div>
  </div>

  <!-- Executive Summary -->
  <div style="margin-bottom:32px;padding:20px;border-radius:8px;background:#1e293b;border:1px solid #334155">
    <h2 style="font-size:14px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px 0">Executive Summary</h2>
    <p style="font-size:15px;line-height:1.7;color:#e2e8f0;margin:0">${content.executive_summary}</p>
  </div>

  <!-- Key Findings -->
  <div style="margin-bottom:32px">
    <h2 style="font-size:14px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px 0">Key Findings</h2>
    <ul style="margin:0;padding:0 0 0 20px;list-style:disc">
      ${content.key_findings.map((f) => `<li style="font-size:14px;line-height:1.7;color:#cbd5e1;margin-bottom:6px">${f}</li>`).join('')}
    </ul>
  </div>

  <!-- Sections -->
  ${sectionsHtml}

  <!-- Risk Flags -->
  ${
    content.risk_flags.length > 0
      ? `<div style="margin-bottom:32px;padding:20px;border-radius:8px;background:#7f1d1d20;border:1px solid #ef444440">
    <h2 style="font-size:14px;font-weight:600;color:#ef4444;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px 0">Risk Flags</h2>
    <ul style="margin:0;padding:0 0 0 20px;list-style:disc">
      ${content.risk_flags.map((r) => `<li style="font-size:14px;line-height:1.7;color:#fca5a5;margin-bottom:6px">${r}</li>`).join('')}
    </ul>
  </div>`
      : ''
  }

  <!-- Data Quality -->
  <div style="margin-top:40px;padding-top:20px;border-top:1px solid #334155;font-size:11px;color:#64748b">
    <div>KPIs Compared: ${content.data_quality.total_kpis_compared} · High Confidence: ${content.data_quality.high_confidence_pct}%</div>
    <div style="margin-top:4px">Generated by BenchmarkSignal · ${new Date().toISOString().split('T')[0]}</div>
  </div>

</body>
</html>`
}
