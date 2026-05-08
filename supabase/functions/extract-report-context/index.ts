/**
 * extract-report-context — Extracts strategic context + segment breakdowns from annual reports.
 * Called after extract-kpis completes, or manually.
 *
 * POST { report_id }
 *
 * Reads the full PDF via Claude's document understanding, extracts:
 * - Competitor mentions (matched to companies table)
 * - Strategic initiatives, risk factors, M&A activity
 * - Management guidance, restructuring notes, key quotes
 * - Business segment breakdowns (revenue, EBITDA by segment)
 * - Geographic mix
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return errorResponse('POST only', 405)
  }

  // Allow both JWT auth and service_role calls (from pipeline-orchestrator)
  const authHeader = req.headers.get('authorization') ?? ''
  const isServiceRole = authHeader.includes(SERVICE_ROLE_KEY)
  if (!isServiceRole) {
    const user = await authenticateRequest(req)
    if (!user) return errorResponse('Unauthorized', 401)
  }

  const { report_id } = await req.json().catch(() => ({ report_id: null }))
  if (!report_id) return errorResponse('report_id required', 400)

  // Load report + company
  const { data: report } = await admin
    .from('reports')
    .select('id, company_id, fiscal_year, pdf_storage_path, title')
    .eq('id', report_id)
    .single()

  if (!report) return errorResponse('Report not found', 404)
  if (!report.pdf_storage_path) return errorResponse('No PDF uploaded for this report', 400)

  const { data: company } = await admin
    .from('companies')
    .select('id, name, ticker, sector, country')
    .eq('id', report.company_id)
    .single()

  if (!company) return errorResponse('Company not found', 404)

  // Load all companies for competitor matching
  const { data: allCompanies } = await admin
    .from('companies')
    .select('id, name, ticker')
    .eq('is_active', true)

  const companyNames = (allCompanies ?? []).map(c => ({
    id: c.id,
    name: c.name,
    ticker: c.ticker,
  }))

  // Download PDF from storage
  const { data: pdfData, error: dlError } = await admin
    .storage
    .from('reports')
    .download(report.pdf_storage_path)

  if (dlError || !pdfData) {
    return errorResponse('Failed to download PDF: ' + (dlError?.message ?? 'unknown'), 500)
  }

  // Convert to base64 in chunks
  const buffer = await pdfData.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let base64 = ''
  const CHUNK = 8192
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK, bytes.length))
    base64 += btoa(String.fromCharCode(...chunk))
  }

  // Build the extraction prompt
  const companyList = companyNames
    .filter(c => c.id !== company.id)
    .map(c => `- ${c.name}${c.ticker ? ` (${c.ticker})` : ''}`)
    .join('\n')

  const systemPrompt = `You are a senior financial analyst extracting strategic intelligence from annual reports. You are analyzing the FY${report.fiscal_year} annual report of ${company.name} (${company.sector}, ${company.country}).

Extract ALL of the following using the extract_report_context tool. Be thorough — this data feeds competitive intelligence systems.

For competitor_mentions: Look for ANY mention of these known companies (or their subsidiaries/brands). Match them to the list below:
${companyList}

For business segments: Extract the FULL financial breakdown per segment. Annual reports always have a segment reporting section (usually IFRS 8 or similar). Get revenue, EBITDA/operating profit, assets, capex for EACH segment. This is critical for comparability analysis.

For management guidance: Extract any forward-looking statements about expected revenue growth, margin targets, capex plans, volume targets.

Be precise with page numbers. If something spans multiple pages, use the first page.`

  // Call Claude with document + tool_use
  const toolSchema = {
    name: 'extract_report_context',
    description: 'Extract strategic context and segment breakdowns from an annual report',
    input_schema: {
      type: 'object' as const,
      required: ['competitor_mentions', 'strategic_initiatives', 'risk_factors', 'business_segments', 'segment_financials'],
      properties: {
        competitor_mentions: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              company_name: { type: 'string' as const, description: 'Name as it appears in the report' },
              matched_company_id: { type: 'string' as const, description: 'UUID from the known companies list, or null if not in list' },
              context: { type: 'string' as const, description: 'The sentence/paragraph where mentioned' },
              sentiment: { type: 'string' as const, enum: ['positive', 'negative', 'neutral'] },
              page: { type: 'integer' as const },
            },
          },
        },
        strategic_initiatives: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              initiative: { type: 'string' as const },
              description: { type: 'string' as const },
              timeline: { type: 'string' as const },
              page: { type: 'integer' as const },
            },
          },
        },
        risk_factors: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              factor: { type: 'string' as const },
              description: { type: 'string' as const },
              severity: { type: 'string' as const, enum: ['high', 'medium', 'low'] },
              page: { type: 'integer' as const },
            },
          },
        },
        market_commentary: { type: 'string' as const, description: 'Overall market outlook narrative from the report' },
        management_guidance: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              metric: { type: 'string' as const, description: 'e.g. Revenue growth, EBITDA margin, Capex' },
              guidance_value: { type: 'string' as const, description: 'e.g. "3-5%", "CHF 2.5-3.0bn", ">18%"' },
              guidance_type: { type: 'string' as const, enum: ['target', 'expectation', 'range', 'ambition'] },
              comparison_period: { type: 'string' as const, description: 'e.g. "FY2026", "medium-term", "by 2030"' },
              page: { type: 'integer' as const },
            },
          },
        },
        restructuring_notes: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              description: { type: 'string' as const },
              financial_impact_mln: { type: 'number' as const },
              currency: { type: 'string' as const },
              page: { type: 'integer' as const },
            },
          },
        },
        ma_activity: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              type: { type: 'string' as const, enum: ['acquisition', 'divestiture', 'joint_venture', 'merger'] },
              target: { type: 'string' as const },
              description: { type: 'string' as const },
              value_mln: { type: 'number' as const },
              currency: { type: 'string' as const },
              page: { type: 'integer' as const },
            },
          },
        },
        key_quotes: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              quote: { type: 'string' as const },
              speaker: { type: 'string' as const },
              role: { type: 'string' as const },
              page: { type: 'integer' as const },
            },
          },
        },
        business_segments: {
          type: 'array' as const,
          description: 'High-level list of business segments',
          items: {
            type: 'object' as const,
            properties: {
              name: { type: 'string' as const },
              description: { type: 'string' as const },
              products: { type: 'string' as const, description: 'Key products/services in this segment' },
              revenue_pct: { type: 'number' as const },
              page: { type: 'integer' as const },
            },
          },
        },
        geographic_mix: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              region: { type: 'string' as const },
              revenue_pct: { type: 'number' as const },
              page: { type: 'integer' as const },
            },
          },
        },
        segment_financials: {
          type: 'array' as const,
          description: 'Detailed financial breakdown per segment from the segment reporting note',
          items: {
            type: 'object' as const,
            properties: {
              segment_name: { type: 'string' as const },
              segment_type: { type: 'string' as const, enum: ['product', 'geography', 'business_unit'] },
              revenue: { type: 'number' as const, description: 'In millions, reporting currency' },
              ebitda: { type: 'number' as const, description: 'In millions, if available' },
              ebit: { type: 'number' as const, description: 'Operating profit in millions' },
              operating_profit: { type: 'number' as const },
              assets: { type: 'number' as const, description: 'Segment assets in millions' },
              capex: { type: 'number' as const, description: 'Capital expenditure in millions' },
              employees: { type: 'integer' as const },
              revenue_pct: { type: 'number' as const },
              ebitda_pct: { type: 'number' as const },
              currency: { type: 'string' as const },
              source_page: { type: 'integer' as const },
              confidence: { type: 'number' as const, description: '0.0-1.0' },
              notes: { type: 'string' as const, description: 'Any accounting notes about this segment' },
            },
          },
        },
      },
    },
  }

  try {
    const apiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6-20250514',
        max_tokens: 16000,
        temperature: 0,
        system: systemPrompt,
        tools: [toolSchema],
        tool_choice: { type: 'tool', name: 'extract_report_context' },
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64 },
              cache_control: { type: 'ephemeral' },
            },
            {
              type: 'text',
              text: `Extract all strategic context and segment breakdowns from this ${company.name} FY${report.fiscal_year} annual report. Be thorough with segment financials — the comparability engine depends on accurate segment-level revenue and EBITDA data.`,
            },
          ],
        }],
      }),
    })

    if (!apiResp.ok) {
      const errText = await apiResp.text()
      console.error('Claude API error:', apiResp.status, errText)
      return errorResponse('AI extraction failed: ' + apiResp.status, 500)
    }

    const result = await apiResp.json()
    const toolUse = result.content?.find((c: { type: string }) => c.type === 'tool_use')
    if (!toolUse?.input) {
      return errorResponse('No tool_use response from AI', 500)
    }

    const extracted = toolUse.input

    // Insert report_contexts
    const { error: ctxErr } = await admin
      .from('report_contexts')
      .upsert({
        report_id: report.id,
        company_id: company.id,
        fiscal_year: report.fiscal_year,
        competitor_mentions: extracted.competitor_mentions ?? [],
        strategic_initiatives: extracted.strategic_initiatives ?? [],
        risk_factors: extracted.risk_factors ?? [],
        market_commentary: extracted.market_commentary ?? null,
        management_guidance: extracted.management_guidance ?? [],
        restructuring_notes: extracted.restructuring_notes ?? [],
        ma_activity: extracted.ma_activity ?? [],
        key_quotes: extracted.key_quotes ?? [],
        business_segments: extracted.business_segments ?? [],
        geographic_mix: extracted.geographic_mix ?? [],
        ai_model_used: 'claude-sonnet-4-6',
        extraction_confidence: 0.85,
      }, { onConflict: 'report_id' })

    if (ctxErr) {
      console.error('report_contexts insert error:', ctxErr.message)
      return errorResponse('Failed to save context: ' + ctxErr.message, 500)
    }

    // Insert segment_breakdowns
    const segments = (extracted.segment_financials ?? []).map((s: Record<string, unknown>) => ({
      report_id: report.id,
      company_id: company.id,
      fiscal_year: report.fiscal_year,
      segment_name: s.segment_name,
      segment_type: s.segment_type ?? 'business_unit',
      revenue: s.revenue,
      ebitda: s.ebitda,
      ebit: s.ebit,
      operating_profit: s.operating_profit,
      assets: s.assets,
      capex: s.capex,
      employees: s.employees,
      revenue_pct: s.revenue_pct,
      ebitda_pct: s.ebitda_pct,
      currency: s.currency ?? company.country === 'Switzerland' ? 'CHF' : 'EUR',
      source_page: s.source_page,
      confidence: s.confidence ?? 0.8,
      notes: s.notes,
      ai_model_used: 'claude-sonnet-4-6',
    }))

    if (segments.length > 0) {
      // Delete existing segments for this report before inserting new ones
      await admin
        .from('segment_breakdowns')
        .delete()
        .eq('report_id', report.id)

      const { error: segErr } = await admin
        .from('segment_breakdowns')
        .insert(segments)

      if (segErr) {
        console.error('segment_breakdowns insert error:', segErr.message)
        // Non-fatal — context was already saved
      }
    }

    console.log(`Extracted context for ${company.name} FY${report.fiscal_year}: ${(extracted.competitor_mentions ?? []).length} competitor mentions, ${segments.length} segments, ${(extracted.strategic_initiatives ?? []).length} initiatives`)

    return jsonResponse({
      report_id: report.id,
      company: company.name,
      fiscal_year: report.fiscal_year,
      competitor_mentions: (extracted.competitor_mentions ?? []).length,
      segments: segments.length,
      strategic_initiatives: (extracted.strategic_initiatives ?? []).length,
      risk_factors: (extracted.risk_factors ?? []).length,
      ma_activity: (extracted.ma_activity ?? []).length,
      management_guidance: (extracted.management_guidance ?? []).length,
    })
  } catch (err) {
    console.error('extract-report-context error:', (err as Error).message)
    return errorResponse('Extraction failed: ' + (err as Error).message, 500)
  }
})
