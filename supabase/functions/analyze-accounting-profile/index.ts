import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { extractTextFromPdf, getPdfPageCount } from '../_shared/pdf-text.ts'
import { logAnthropicUsage } from '../_shared/log-usage.ts'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CHARS_FOR_SINGLE_PASS = 400_000 // ~100K tokens — fits in context

const KPI_CODES = [
  'REVENUE', 'EBITDA', 'EBITDA_ADJ', 'EBITDA_MARGIN', 'EBIT',
  'NET_INCOME', 'EPS_BASIC', 'NET_DEBT', 'NET_DEBT_EBITDA', 'ROIC',
  'CAPEX', 'CO2_ABSOLUTE', 'CO2_INTENSITY', 'LTIFR', 'CEMENT_VOLUME',
] as const

interface AnalyzeRequest {
  report_id: string
  company_name?: string
}

interface PageRange {
  start: number
  end: number
  section: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function callClaude(
  apiKey: string,
  model: string,
  maxTokens: number,
  messages: Array<{ role: string; content: string }>,
  tools?: unknown[],
  toolChoice?: unknown,
) {
  const body: Record<string, unknown> = { model, max_tokens: maxTokens, messages }
  if (tools) body.tools = tools
  if (toolChoice) body.tool_choice = toolChoice

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Claude API error ${res.status}: ${errBody}`)
  }

  return res.json()
}

// ---------------------------------------------------------------------------
// Pass 1: Identify relevant page ranges using Haiku
// ---------------------------------------------------------------------------

async function identifyRelevantPages(
  apiKey: string,
  tocText: string,
  pageCount: number,
): Promise<PageRange[]> {
  const response = await callClaude(
    apiKey,
    'claude-haiku-4-5-20251001',
    2048,
    [
      {
        role: 'user',
        content: `You are analyzing the table of contents and first pages of a ${pageCount}-page annual report.

Identify the page ranges that contain:
1. Financial statements (income statement, balance sheet, cash flow statement)
2. Notes to the financial statements (accounting policies, significant estimates)
3. Segment reporting
4. Any peer/competitor comparisons or benchmarking sections
5. Key performance indicators / alternative performance measures

Return a JSON array of page ranges. Each entry: {"start": number, "end": number, "section": "description"}

Be generous with ranges — include a few pages before and after to avoid missing content.
If you cannot identify specific sections, return a single range covering the likely financial report portion (typically the second half of integrated reports).

Respond ONLY with the JSON array, no other text.

--- REPORT TEXT (first pages) ---
${tocText}
--- END ---`,
      },
    ],
  )

  const textBlock = response.content?.find(
    (b: { type: string }) => b.type === 'text',
  )
  if (!textBlock) return [{ start: 1, end: pageCount, section: 'full_report' }]

  try {
    const jsonStr = textBlock.text.trim().replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    const ranges = JSON.parse(jsonStr) as PageRange[]
    if (Array.isArray(ranges) && ranges.length > 0) {
      console.log(`[pass-1] Identified ${ranges.length} relevant sections:`, ranges.map(r => `${r.section} (pp ${r.start}-${r.end})`).join(', '))
      return ranges
    }
  } catch {
    console.warn('[pass-1] Failed to parse page ranges, falling back to full report')
  }

  return [{ start: 1, end: pageCount, section: 'full_report' }]
}

// ---------------------------------------------------------------------------
// Extraction tool schema
// ---------------------------------------------------------------------------

const EXTRACTION_TOOL = {
  name: 'extract_accounting_profile',
  description:
    'Extract the accounting framework, policies, and KPI calculation methods from this annual report',
  input_schema: {
    type: 'object',
    properties: {
      company_name: {
        type: 'string',
        description: 'The official company name as stated in the annual report',
      },
      accounting_standard: {
        type: 'string',
        enum: ['IFRS', 'US_GAAP', 'Swiss_GAAP_FER', 'HGB', 'other'],
        description: 'The primary accounting standard used',
      },
      accounting_standard_confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Confidence in the detected standard (0-1)',
      },
      policies: {
        type: 'object',
        description: 'Specific accounting policies extracted from the report',
        properties: {
          revenue_recognition: {
            type: 'object',
            properties: {
              method: { type: 'string', description: 'e.g., over_time, point_in_time, percentage_of_completion' },
              description: { type: 'string' },
              source_page: { type: 'integer' },
            },
            required: ['method'],
          },
          rd_treatment: {
            type: 'object',
            properties: {
              method: { type: 'string', description: 'capitalize, expense, or mixed' },
              threshold: { type: 'string', description: 'When capitalization starts' },
              description: { type: 'string' },
              source_page: { type: 'integer' },
            },
            required: ['method'],
          },
          lease_treatment: {
            type: 'object',
            properties: {
              standard: { type: 'string', description: 'e.g., IFRS_16, ASC_842, operating' },
              on_balance_sheet: { type: 'boolean' },
              description: { type: 'string' },
              source_page: { type: 'integer' },
            },
            required: ['standard'],
          },
          ebitda_definition: {
            type: 'object',
            properties: {
              excludes: {
                type: 'array',
                items: { type: 'string' },
                description: 'Items excluded from EBITDA',
              },
              includes: {
                type: 'array',
                items: { type: 'string' },
                description: 'Non-standard items included in EBITDA',
              },
              description: { type: 'string' },
              source_page: { type: 'integer' },
            },
            required: ['excludes', 'includes'],
          },
          net_debt_definition: {
            type: 'object',
            properties: {
              includes: {
                type: 'array',
                items: { type: 'string' },
                description: 'Debt items included',
              },
              excludes: {
                type: 'array',
                items: { type: 'string' },
                description: 'Items excluded from debt',
              },
              deducts: {
                type: 'array',
                items: { type: 'string' },
                description: 'Items deducted from debt',
              },
              description: { type: 'string' },
              source_page: { type: 'integer' },
            },
            required: ['includes', 'deducts'],
          },
          goodwill_treatment: {
            type: 'object',
            properties: {
              method: { type: 'string', description: 'impairment_only or amortize' },
              description: { type: 'string' },
              source_page: { type: 'integer' },
            },
            required: ['method'],
          },
          pension_accounting: {
            type: 'object',
            properties: {
              method: { type: 'string', description: 'e.g., projected_unit_credit, defined_contribution' },
              description: { type: 'string' },
              source_page: { type: 'integer' },
            },
            required: ['method'],
          },
          fx_translation: {
            type: 'object',
            properties: {
              method: { type: 'string', description: 'e.g., closing_rate, temporal, current_rate' },
              functional_currency: { type: 'string' },
              description: { type: 'string' },
              source_page: { type: 'integer' },
            },
            required: ['method'],
          },
          segment_reporting: {
            type: 'object',
            properties: {
              basis: { type: 'string', description: 'e.g., geographic, product_line, business_unit' },
              segments: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of reported segments',
              },
              description: { type: 'string' },
              source_page: { type: 'integer' },
            },
            required: ['basis'],
          },
        },
      },
      kpi_mappings: {
        type: 'object',
        description: 'How this company calculates each KPI. Keys are KPI codes.',
        additionalProperties: {
          type: 'object',
          properties: {
            formula: { type: 'string', description: 'How the KPI is calculated' },
            adjustments: {
              type: 'array',
              items: { type: 'string' },
              description: 'Any adjustments made to the standard calculation',
            },
            label_in_report: { type: 'string', description: 'The exact label used in the report' },
            source_page: { type: 'integer' },
          },
          required: ['formula'],
        },
      },
      mentioned_competitors: {
        type: 'array',
        description: 'Companies explicitly mentioned as competitors, peers, or used for benchmarking. Only include companies clearly identified as industry peers — not suppliers, customers, or partners.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Official company name' },
            ticker: { type: 'string', description: 'Stock ticker if mentioned' },
            context: { type: 'string', description: 'Brief context of how/where mentioned' },
          },
          required: ['name'],
        },
      },
    },
    required: ['company_name', 'accounting_standard', 'accounting_standard_confidence', 'policies', 'kpi_mappings', 'mentioned_competitors'],
  },
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { user, adminClient } = await authenticateRequest(req)

    const { report_id: reportId, company_name: overrideName } =
      (await req.json()) as AnalyzeRequest
    if (!reportId) {
      return jsonResponse({ error: 'Missing required field: report_id' }, 400)
    }

    // ------------------------------------------------------------------
    // 1. Load the report
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

    // Data isolation
    const { data: visibleIds } = await adminClient
      .rpc('visible_company_ids_for_user', { p_user_id: user.id })
    const visible = new Set((visibleIds ?? []) as string[])
    if (!visible.has(report.company_id)) {
      return jsonResponse({ error: 'Report belongs to a company not in your peer groups' }, 403)
    }

    const company = report.companies as { id: string; name: string; ticker: string | null }
    const companyNameHint = overrideName ?? company.name

    // ------------------------------------------------------------------
    // 2. Download PDF and extract text
    // ------------------------------------------------------------------
    const { data: pdfBytes, error: downloadError } = await adminClient.storage
      .from('reports')
      .download(report.pdf_storage_path)

    if (downloadError || !pdfBytes) {
      throw new Error(`Failed to download PDF: ${downloadError?.message ?? 'no data'}`)
    }

    const pdfBuffer = await pdfBytes.arrayBuffer()

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) throw new Error('ANTHROPIC_API_KEY is not set')

    // Get page count without extracting text (memory-safe)
    const pageCount = await getPdfPageCount(pdfBuffer)
    console.log(`[analyze] PDF has ${pageCount} pages`)

    const MAX_PAGES_SINGLE_PASS = 80 // ~80 pages fits comfortably in memory + context
    let textForAnalysis: string
    let extractedPages: number

    if (pageCount <= MAX_PAGES_SINGLE_PASS) {
      // Small report — extract all pages, single pass
      console.log('[analyze] Small report — single pass')
      const extraction = await extractTextFromPdf(pdfBuffer)
      textForAnalysis = extraction.text
      extractedPages = extraction.extractedPages
    } else {
      // Large report — two-pass approach (never extract all pages)
      console.log(`[analyze] Large report (${pageCount} pages) — two-pass approach`)

      // Pass 1: Extract first 30 pages for TOC/overview, send to Haiku
      const tocExtraction = await extractTextFromPdf(pdfBuffer, [{ start: 1, end: 30 }])
      console.log(`[analyze] Pass 1: ${tocExtraction.text.length} chars from first 30 pages`)

      const pageRanges = await identifyRelevantPages(
        anthropicApiKey,
        tocExtraction.text,
        pageCount,
      )

      // Pass 2: Extract only relevant pages
      const relevantExtraction = await extractTextFromPdf(pdfBuffer, pageRanges)
      console.log(`[analyze] Pass 2: ${relevantExtraction.text.length} chars from ${relevantExtraction.extractedPages} pages (of ${pageCount} total)`)

      // Safety: truncate if still too large for context window
      if (relevantExtraction.text.length > 700_000) {
        console.warn(`[analyze] Still large (${relevantExtraction.text.length} chars), truncating to 700K`)
        textForAnalysis = relevantExtraction.text.substring(0, 700_000)
      } else {
        textForAnalysis = relevantExtraction.text
      }
      extractedPages = relevantExtraction.extractedPages
    }

    // ------------------------------------------------------------------
    // 3. Extract accounting profile with Sonnet
    // ------------------------------------------------------------------
    const claudeJson = await callClaude(
      anthropicApiKey,
      'claude-sonnet-4-6',
      8192,
      [
        {
          role: 'user',
          content: `You are an expert financial reporting analyst. Below is extracted text from an annual report${companyNameHint !== 'Pending Analysis' ? ` for "${companyNameHint}"` : ''}. Analyze it and extract the complete accounting framework.

The full report has ${pageCount} pages. You are seeing ${extractedPages} relevant pages.

FOCUS ON THE ACCOUNTING POLICIES SECTION (typically in the Notes to the Financial Statements).

For each area, extract:
1. **Accounting standard** — IFRS, US GAAP, Swiss GAAP FER, HGB, or other?
2. **Revenue recognition** — Over time, point in time, percentage of completion?
3. **R&D treatment** — Capitalize or expense? At what stage?
4. **Lease treatment** — IFRS 16 (on balance sheet) or operating leases?
5. **EBITDA definition** — What do they include/exclude? CRITICAL.
6. **Net debt definition** — What's included? Do they include lease liabilities?
7. **Goodwill** — Amortize or impairment-only?
8. **Pension accounting** — Projected unit credit, defined contribution, other?
9. **FX translation** — Closing rate, temporal? Functional currency?
10. **Segment reporting** — Geographic, product line, or business unit? List segments.

For KPI MAPPINGS, find how this company calculates each of these KPIs:
KPI codes: ${KPI_CODES.join(', ')}

ALWAYS include the source_page number for each finding.
If you cannot find information about a specific policy, skip it rather than guessing.

For MENTIONED COMPETITORS: Scan for companies explicitly named as competitors, peers, or used in benchmarking. If none found, return an empty array.

--- BEGIN ANNUAL REPORT TEXT ---
${textForAnalysis}
--- END ANNUAL REPORT TEXT ---`,
        },
      ],
      [EXTRACTION_TOOL],
      { type: 'tool', name: 'extract_accounting_profile' },
    )

    await logAnthropicUsage('BenchmarkSignal', 'analyze-accounting-profile', claudeJson)

    const inputTokens = claudeJson.usage?.input_tokens ?? 0
    const outputTokens = claudeJson.usage?.output_tokens ?? 0
    const estimatedCostUsd = (inputTokens * 3 + outputTokens * 15) / 1_000_000

    // ------------------------------------------------------------------
    // 4. Parse tool-use response
    // ------------------------------------------------------------------
    const toolUseBlock = claudeJson.content?.find(
      (block: { type: string }) => block.type === 'tool_use',
    )

    if (!toolUseBlock) {
      throw new Error('Claude did not return a tool_use block')
    }

    const result = toolUseBlock.input as {
      company_name: string
      accounting_standard: string
      accounting_standard_confidence: number
      policies: Record<string, unknown>
      kpi_mappings: Record<string, unknown>
      mentioned_competitors: Array<{ name: string; ticker?: string; context?: string }>
    }

    // ------------------------------------------------------------------
    // 5. Upsert accounting_profiles row
    // ------------------------------------------------------------------
    const companyName = result.company_name || companyNameHint

    const profileData = {
      user_id: user.id,
      company_name: companyName,
      accounting_standard: result.accounting_standard,
      accounting_standard_confidence: result.accounting_standard_confidence,
      policies: result.policies,
      kpi_mappings: result.kpi_mappings,
      mentioned_competitors: result.mentioned_competitors ?? [],
      source_report_id: reportId,
      source_report_title: report.title ?? `${companyName} Annual Report`,
      ai_model: 'claude-sonnet-4-6',
      extracted_at: new Date().toISOString(),
      manually_edited: false,
    }

    const { data: existing } = await adminClient
      .from('accounting_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    let profileId: string

    if (existing) {
      const { data: updated, error: updateError } = await adminClient
        .from('accounting_profiles')
        .update(profileData)
        .eq('id', existing.id)
        .select('id')
        .single()

      if (updateError) throw new Error(`Profile update failed: ${updateError.message}`)
      profileId = updated.id
    } else {
      const { data: inserted, error: insertError } = await adminClient
        .from('accounting_profiles')
        .insert(profileData)
        .select('id')
        .single()

      if (insertError) throw new Error(`Profile insert failed: ${insertError.message}`)
      profileId = inserted.id
    }

    // ------------------------------------------------------------------
    // 6. Return the extracted profile
    // ------------------------------------------------------------------
    const policyCount = Object.keys(result.policies).length
    const kpiMappingCount = Object.keys(result.kpi_mappings).length

    if (result.company_name && report.company_id) {
      await adminClient
        .from('companies')
        .update({ name: result.company_name })
        .eq('id', report.company_id)
    }

    console.log(`[analyze] Tokens: ${inputTokens} in / ${outputTokens} out | Cost: $${estimatedCostUsd.toFixed(4)} | Company: ${companyName} | Pages: ${pageCount} (${extractedPages} analyzed)`)

    return jsonResponse({
      profile_id: profileId,
      company_name: companyName,
      accounting_standard: result.accounting_standard,
      confidence: result.accounting_standard_confidence,
      policies_extracted: policyCount,
      kpi_mappings_extracted: kpiMappingCount,
      policies: result.policies,
      kpi_mappings: result.kpi_mappings,
      mentioned_competitors: result.mentioned_competitors ?? [],
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        estimated_cost_usd: Math.round(estimatedCostUsd * 10000) / 10000,
        model: 'claude-sonnet-4-6',
        pages_total: pageCount,
        pages_analyzed: extractedPages,
      },
    })
  } catch (err) {
    console.error('[analyze] Error:', err instanceof Error ? err.message : String(err))
    console.error('[analyze] Stack:', err instanceof Error ? err.stack : 'no stack')
    return errorResponse(err)
  }
})
