import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'

// ---------------------------------------------------------------------------
// KPI codes recognised by the extraction tool
// ---------------------------------------------------------------------------
const KPI_CODES = [
  'REVENUE',
  'EBITDA',
  'EBITDA_ADJ',
  'EBITDA_MARGIN',
  'EBIT',
  'NET_INCOME',
  'EPS_BASIC',
  'NET_DEBT',
  'NET_DEBT_EBITDA',
  'ROIC',
  'CAPEX',
  'CO2_ABSOLUTE',
  'CO2_INTENSITY',
  'LTIFR',
  'CEMENT_VOLUME',
] as const

type KpiCode = typeof KPI_CODES[number]

interface ExtractedKpi {
  kpi_code: KpiCode
  raw_value: number
  raw_currency: string
  raw_label: string
  fiscal_year: number
  fiscal_quarter: number | null
  confidence: number
  source_page: number
  source_text?: string
}

interface ClaudeToolResult {
  kpis: ExtractedKpi[]
}

// ---------------------------------------------------------------------------
// Threshold below which a kpi_value is flagged for human review
// ---------------------------------------------------------------------------
const REVIEW_THRESHOLD = 0.85

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { user, adminClient } = await authenticateRequest(req)

    const { report_id: reportId } = await req.json()
    if (!reportId) {
      return jsonResponse({ error: 'Missing required field: report_id' }, 400)
    }

    // ------------------------------------------------------------------
    // 1a. Load user's accounting profile (if exists)
    // ------------------------------------------------------------------
    const { data: accountingProfile } = await adminClient
      .from('accounting_profiles')
      .select('accounting_standard, policies, kpi_mappings, company_name')
      .eq('user_id', user.id)
      .maybeSingle()

    // ------------------------------------------------------------------
    // 1. Load report + company
    // ------------------------------------------------------------------
    const { data: report, error: reportError } = await adminClient
      .from('reports')
      .select('*, companies(id, name, ticker)')
      .eq('id', reportId)
      .single()

    if (reportError) throw new Error(`Report lookup failed: ${reportError.message}`)
    if (!report) return jsonResponse({ error: `Report not found: ${reportId}` }, 404)
    if (!report.pdf_storage_path) {
      return jsonResponse({ error: 'Report has no PDF attached' }, 422)
    }

    // Data isolation: verify report's company is in user's peer groups
    const { data: visibleIds } = await adminClient
      .rpc('visible_company_ids_for_user', { p_user_id: user.id })
    const visible = new Set((visibleIds ?? []) as string[])
    if (!visible.has(report.company_id)) {
      return jsonResponse({ error: 'Report belongs to a company not in your peer groups' }, 403)
    }

    const company = report.companies as { id: string; name: string; ticker: string | null }
    const companyName = company.name
    const companyTicker = company.ticker ?? ''

    // ------------------------------------------------------------------
    // 2. Update report status → processing
    // ------------------------------------------------------------------
    await adminClient
      .from('reports')
      .update({ status: 'processing' })
      .eq('id', reportId)

    // ------------------------------------------------------------------
    // 3. Create extraction record
    // ------------------------------------------------------------------
    const { data: extraction, error: extractionError } = await adminClient
      .from('extractions')
      .insert({
        report_id: reportId,
        model_used: 'claude-sonnet-4-6',
        started_at: new Date().toISOString(),
        status: 'running',
        total_kpis_extracted: 0,
      })
      .select()
      .single()

    if (extractionError) throw new Error(`Extraction insert failed: ${extractionError.message}`)

    // ------------------------------------------------------------------
    // 4. Download PDF from Supabase Storage as ArrayBuffer → base64
    // ------------------------------------------------------------------
    const { data: pdfData, error: downloadError } = await adminClient.storage
      .from('reports')
      .download(report.pdf_storage_path)

    if (downloadError) throw new Error(`PDF download failed: ${downloadError.message}`)

    const pdfArrayBuffer = await pdfData.arrayBuffer()
    const pdfBytes = new Uint8Array(pdfArrayBuffer)

    // Encode to base64 without using btoa (which fails on binary > 64KB in Deno)
    let binary = ''
    const chunkSize = 8192
    for (let i = 0; i < pdfBytes.length; i += chunkSize) {
      binary += String.fromCharCode(...pdfBytes.slice(i, i + chunkSize))
    }
    const pdfBase64 = btoa(binary)

    // ------------------------------------------------------------------
    // 5. Call Claude Vision with PDF document block
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
            name: 'extract_kpis',
            description: 'Extract financial and ESG KPIs from this report',
            input_schema: {
              type: 'object',
              properties: {
                kpis: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      kpi_code: {
                        type: 'string',
                        enum: KPI_CODES as unknown as string[],
                      },
                      raw_value: { type: 'number' },
                      raw_currency: { type: 'string' },
                      raw_label: {
                        type: 'string',
                        description: 'The exact label as printed in the report',
                      },
                      fiscal_year: { type: 'integer' },
                      fiscal_quarter: { type: ['integer', 'null'] },
                      confidence: { type: 'number', minimum: 0, maximum: 1 },
                      source_page: { type: 'integer' },
                      source_text: {
                        type: 'string',
                        description: 'The surrounding text context',
                      },
                    },
                    required: [
                      'kpi_code',
                      'raw_value',
                      'raw_currency',
                      'raw_label',
                      'fiscal_year',
                      'confidence',
                      'source_page',
                    ],
                  },
                },
              },
              required: ['kpis'],
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'extract_kpis' },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdfBase64,
                },
              },
              {
                type: 'text',
                text: `You are a financial data extraction expert. Extract all financial and ESG KPIs from this corporate report for ${companyName}${companyTicker ? ` (${companyTicker})` : ''}.
${accountingProfile ? `
IMPORTANT CONTEXT — USER'S ACCOUNTING FRAMEWORK:
The user's company (${accountingProfile.company_name}) uses ${accountingProfile.accounting_standard}.
Their specific accounting policies:
${JSON.stringify(accountingProfile.policies, null, 2)}

Their KPI calculation methods:
${JSON.stringify(accountingProfile.kpi_mappings, null, 2)}

When extracting KPIs from this competitor's report, pay special attention to:
1. How THIS competitor defines EBITDA vs how the user defines it (what's included/excluded)
2. How THIS competitor defines Net Debt vs the user's definition
3. Any accounting standard differences (e.g., IFRS vs US GAAP treatment of leases, R&D)
4. In source_text, note any accounting treatment differences you observe
` : ''}
Extract these KPIs if present:
- REVENUE: Total net revenue/sales
- EBITDA: Earnings before interest, taxes, depreciation, amortization
- EBITDA_ADJ: Adjusted EBITDA (excluding one-offs)
- EBITDA_MARGIN: EBITDA as % of revenue
- EBIT: Operating profit
- NET_INCOME: Net profit attributable to shareholders
- EPS_BASIC: Basic earnings per share
- NET_DEBT: Total debt minus cash
- NET_DEBT_EBITDA: Leverage ratio
- ROIC: Return on invested capital
- CAPEX: Capital expenditure
- CO2_ABSOLUTE: Scope 1+2 CO2 emissions (tonnes)
- CO2_INTENSITY: CO2 per tonne of product (kg CO2/t)
- LTIFR: Lost-time injury frequency rate
- CEMENT_VOLUME: Cement/clinker sales volume (million tonnes)

For each KPI found:
- Extract the raw_value as a number (convert "CHF 27.5bn" to 27500 in millions)
- Record the raw_currency (CHF, EUR, USD, etc.)
- Record the exact raw_label as printed
- Note the fiscal_year and fiscal_quarter (null for annual)
- Assign a confidence score (0-1): 1.0 = clearly stated, 0.9 = derived/calculated, 0.7 = estimated from context
- Record the source_page number
- Include surrounding source_text for audit trail${accountingProfile ? '\n- In source_text, note any accounting policy differences vs the user\'s framework (e.g., "Competitor includes restructuring in EBITDA; user excludes it")' : ''}

Important: Values are typically in millions unless stated otherwise. Convert all values to millions.`,
              },
            ],
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

    const toolResult = toolUseBlock.input as ClaudeToolResult
    const extractedKpis: ExtractedKpi[] = toolResult.kpis ?? []

    // ------------------------------------------------------------------
    // 7. Resolve kpi_definition_id for each KPI code
    // ------------------------------------------------------------------
    const { data: kpiDefs, error: kpiDefsError } = await adminClient
      .from('kpi_definitions')
      .select('id, code')
      .in('code', KPI_CODES as unknown as string[])

    if (kpiDefsError) throw new Error(`KPI definitions lookup failed: ${kpiDefsError.message}`)

    const kpiDefMap = new Map<string, string>(
      (kpiDefs ?? []).map((d: { id: string; code: string }) => [d.code, d.id]),
    )

    // ------------------------------------------------------------------
    // 8. Insert kpi_values rows
    // ------------------------------------------------------------------
    const kpiValuesToInsert = extractedKpis
      .filter((kpi) => kpiDefMap.has(kpi.kpi_code))
      .map((kpi) => ({
        extraction_id: extraction.id,
        report_id: reportId,
        company_id: company.id,
        kpi_definition_id: kpiDefMap.get(kpi.kpi_code)!,
        fiscal_year: kpi.fiscal_year,
        fiscal_quarter: kpi.fiscal_quarter ?? null,
        raw_value: kpi.raw_value,
        raw_currency: kpi.raw_currency,
        raw_label: kpi.raw_label,
        normalized_value: null,   // normalize-kpis handles this
        normalized_currency: 'CHF',
        confidence: kpi.confidence,
        needs_review: kpi.confidence < REVIEW_THRESHOLD,
        is_restated: false,
        source_page: kpi.source_page,
        source_text: kpi.source_text ?? null,
      }))

    if (kpiValuesToInsert.length > 0) {
      const { error: insertKpiError } = await adminClient
        .from('kpi_values')
        .insert(kpiValuesToInsert)

      if (insertKpiError) {
        throw new Error(`KPI values insert failed: ${insertKpiError.message}`)
      }
    }

    // ------------------------------------------------------------------
    // 9. Compute aggregate stats and update extraction record
    // ------------------------------------------------------------------
    const totalExtracted = kpiValuesToInsert.length
    const avgConfidence =
      totalExtracted > 0
        ? kpiValuesToInsert.reduce((sum, v) => sum + v.confidence, 0) / totalExtracted
        : null

    await adminClient
      .from('extractions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_kpis_extracted: totalExtracted,
        avg_confidence: avgConfidence,
      })
      .eq('id', extraction.id)

    // Update report status → extracted
    await adminClient
      .from('reports')
      .update({ status: 'extracted' })
      .eq('id', reportId)

    return jsonResponse({
      extraction_id: extraction.id,
      total_kpis_extracted: totalExtracted,
      avg_confidence: avgConfidence,
      needs_review_count: kpiValuesToInsert.filter((v) => v.needs_review).length,
    })
  } catch (err) {
    return errorResponse(err)
  }
})
