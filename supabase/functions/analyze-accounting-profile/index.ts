import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'
// PDF is sent via signed URL — no base64 encoding needed
import { logAnthropicUsage } from '../_shared/log-usage.ts'

// ---------------------------------------------------------------------------
// Accounting policy areas the AI must extract
// ---------------------------------------------------------------------------
const POLICY_AREAS = [
  'revenue_recognition',
  'rd_treatment',
  'lease_treatment',
  'ebitda_definition',
  'net_debt_definition',
  'goodwill_treatment',
  'pension_accounting',
  'fx_translation',
  'segment_reporting',
] as const

// KPI codes we need mappings for
const KPI_CODES = [
  'REVENUE', 'EBITDA', 'EBITDA_ADJ', 'EBITDA_MARGIN', 'EBIT',
  'NET_INCOME', 'EPS_BASIC', 'NET_DEBT', 'NET_DEBT_EBITDA', 'ROIC',
  'CAPEX', 'CO2_ABSOLUTE', 'CO2_INTENSITY', 'LTIFR', 'CEMENT_VOLUME',
] as const

interface AnalyzeRequest {
  report_id: string
  company_name?: string
}

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
    // 1. Load the report + PDF
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
    // companyName will be overridden by AI-extracted name after analysis
    const companyNameHint = overrideName ?? company.name

    // ------------------------------------------------------------------
    // 2. Generate signed URL for PDF (avoids base64 payload size limits)
    // ------------------------------------------------------------------
    const { data: signedUrlData, error: signedUrlError } = await adminClient.storage
      .from('reports')
      .createSignedUrl(report.pdf_storage_path, 600) // 10 min expiry

    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw new Error(`Failed to create signed URL: ${signedUrlError?.message ?? 'no URL returned'}`)
    }

    const pdfUrl = signedUrlData.signedUrl
    console.log(`[analyze-accounting-profile] PDF URL generated for: ${report.pdf_storage_path}`)

    // ------------------------------------------------------------------
    // 3. Claude: Extract accounting framework (PDF document)
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
        max_tokens: 8192,
        stream: true,
        tools: [
          {
            name: 'extract_accounting_profile',
            description:
              'Extract the accounting framework, policies, and KPI calculation methods from this annual report',
            input_schema: {
              type: 'object',
              properties: {
                company_name: {
                  type: 'string',
                  description: 'The official company name as stated in the annual report (e.g., "Holcim Ltd", "LafargeHolcim")',
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
                        threshold: { type: 'string', description: 'When capitalization starts (e.g., development_phase)' },
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
                          description: 'Items excluded from EBITDA (e.g., restructuring, impairments, share_based_comp)',
                        },
                        includes: {
                          type: 'array',
                          items: { type: 'string' },
                          description: 'Non-standard items included in EBITDA (e.g., joint_venture_income)',
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
                          description: 'Debt items included (e.g., bank_borrowings, bonds, lease_liabilities)',
                        },
                        excludes: {
                          type: 'array',
                          items: { type: 'string' },
                          description: 'Items excluded from debt (e.g., pension_obligations)',
                        },
                        deducts: {
                          type: 'array',
                          items: { type: 'string' },
                          description: 'Items deducted from debt (e.g., cash, short_term_investments)',
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
                  description: 'Companies explicitly mentioned as competitors, peers, or used for benchmarking in the report. Only include companies clearly identified as industry peers or competitors — not suppliers, customers, or partners.',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', description: 'Official company name' },
                      ticker: { type: 'string', description: 'Stock ticker if mentioned' },
                      context: { type: 'string', description: 'Brief context of how/where the company is mentioned (e.g., "peer comparison table", "market share analysis")' },
                    },
                    required: ['name'],
                  },
                },
              },
              required: ['company_name', 'accounting_standard', 'accounting_standard_confidence', 'policies', 'kpi_mappings', 'mentioned_competitors'],
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'extract_accounting_profile' },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'url',
                  url: pdfUrl,
                },
              },
              {
                type: 'text',
                text: `You are an expert financial reporting analyst. Analyze this annual report${companyNameHint !== 'Pending Analysis' ? ` for "${companyNameHint}"` : ''} and extract their complete accounting framework. First, identify the official company name as stated in the report.

FOCUS ON THE ACCOUNTING POLICIES SECTION (typically in the Notes to the Financial Statements).

For each area, extract:
1. **Accounting standard** — Is this IFRS, US GAAP, Swiss GAAP FER, HGB, or other?
2. **Revenue recognition** — Over time, point in time, percentage of completion?
3. **R&D treatment** — Do they capitalize or expense R&D? At what stage?
4. **Lease treatment** — IFRS 16 (on balance sheet) or operating leases?
5. **EBITDA definition** — What do they include/exclude? This is CRITICAL. Many companies define "recurring EBITDA" or "adjusted EBITDA" differently.
6. **Net debt definition** — What's included in debt? Do they include lease liabilities? What do they deduct (cash, investments)?
7. **Goodwill** — Amortize or impairment-only?
8. **Pension accounting** — Projected unit credit, defined contribution, other?
9. **FX translation** — Closing rate, temporal? What's the functional currency?
10. **Segment reporting** — Geographic, product line, or business unit? List the segments.

For KPI MAPPINGS, find how this company calculates each of these KPIs and record:
- The formula they use
- Any adjustments they make to the standard definition
- The exact label they use in their report (e.g., "Recurring EBITDA" vs "Adjusted EBITDA")
- The page number where you found it

KPI codes to map: ${KPI_CODES.join(', ')}

ALWAYS include the source_page number for each finding. This is essential for auditability.
If you cannot find information about a specific policy, skip it rather than guessing.

For MENTIONED COMPETITORS: Carefully scan the ENTIRE report for any companies explicitly named as competitors, peers, or used in benchmarking comparisons. Pay special attention to:
- Business overview / market position sections (typically pages 5-30)
- Competitive landscape or market share discussions
- Peer group or benchmarking comparison tables
- Industry overview sections
- CEO/Chairman letters mentioning other players
Include the stock ticker if mentioned and brief context of where/how each company appears. This is critical — do NOT skip this extraction. If genuinely no competitors are named anywhere in the report, return an empty array.`,
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

    // ------------------------------------------------------------------
    // 4a. Parse streaming SSE response to reassemble the full message
    // ------------------------------------------------------------------
    const reader = claudeResponse.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let inputTokens = 0
    let outputTokens = 0
    const contentBlocks: Array<{ type: string; id?: string; name?: string; input?: string }> = []
    let currentBlockIdx = -1
    let currentInput = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue

        try {
          const evt = JSON.parse(data)

          if (evt.type === 'message_start' && evt.message?.usage) {
            inputTokens = evt.message.usage.input_tokens ?? 0
          }
          if (evt.type === 'content_block_start') {
            currentBlockIdx = evt.index
            const block = evt.content_block
            contentBlocks[currentBlockIdx] = {
              type: block.type,
              id: block.id,
              name: block.name,
              input: '',
            }
            currentInput = ''
          }
          if (evt.type === 'content_block_delta') {
            const delta = evt.delta
            if (delta?.type === 'input_json_delta' && delta.partial_json) {
              currentInput += delta.partial_json
            }
          }
          if (evt.type === 'content_block_stop') {
            if (contentBlocks[currentBlockIdx]) {
              contentBlocks[currentBlockIdx].input = currentInput
            }
          }
          if (evt.type === 'message_delta' && evt.usage) {
            outputTokens = evt.usage.output_tokens ?? 0
          }
        } catch {
          // Skip unparseable SSE lines
        }
      }
    }

    // Reconstruct the tool_use content block
    const toolBlock = contentBlocks.find((b) => b.type === 'tool_use')
    if (!toolBlock) throw new Error('No tool_use block in Claude response')

    const claudeJson = {
      content: [{
        type: 'tool_use',
        id: toolBlock.id,
        name: toolBlock.name,
        input: JSON.parse(toolBlock.input ?? '{}'),
      }],
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    }

    await logAnthropicUsage('BenchmarkSignal', 'analyze-accounting-profile', claudeJson)

    // Sonnet 4.6 pricing: $3/MTok input, $15/MTok output
    const estimatedCostUsd = (inputTokens * 3 + outputTokens * 15) / 1_000_000

    // ------------------------------------------------------------------
    // 4b. Parse tool-use response
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
    // Use AI-extracted company name, fall back to hint
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

    // Upsert: if profile exists for this user, update it
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

    // Update the company name in the companies table with AI-extracted name
    if (result.company_name && report.company_id) {
      await adminClient
        .from('companies')
        .update({ name: result.company_name })
        .eq('id', report.company_id)
    }

    // Log usage to console for debugging
    console.log(`[analyze-accounting-profile] Tokens: ${inputTokens} in / ${outputTokens} out | Cost: $${estimatedCostUsd.toFixed(4)} | Company: ${companyName}`)

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
      },
    })
  } catch (err) {
    console.error('[analyze-accounting-profile] Error:', err instanceof Error ? err.message : String(err))
    console.error('[analyze-accounting-profile] Stack:', err instanceof Error ? err.stack : 'no stack')
    return errorResponse(err)
  }
})
