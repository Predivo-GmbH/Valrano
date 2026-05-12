import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { logAnthropicUsage } from '../_shared/log-usage.ts'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KPI_CODES = [
  'REVENUE', 'EBITDA', 'EBITDA_ADJ', 'EBITDA_MARGIN', 'EBIT',
  'NET_INCOME', 'EPS_BASIC', 'NET_DEBT', 'NET_DEBT_EBITDA', 'ROIC',
  'CAPEX', 'CO2_ABSOLUTE', 'CO2_INTENSITY', 'LTIFR', 'CEMENT_VOLUME',
] as const

interface AnalyzeRequest {
  report_id: string
  company_name?: string
}

// ---------------------------------------------------------------------------
// Gemini API call
// ---------------------------------------------------------------------------

async function uploadToGeminiFileApi(
  apiKey: string,
  pdfBuffer: ArrayBuffer,
  displayName: string,
): Promise<string> {
  // Step 1: Start resumable upload
  const startRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'x-goog-upload-protocol': 'resumable',
        'x-goog-upload-command': 'start',
        'x-goog-upload-header-content-length': String(pdfBuffer.byteLength),
        'x-goog-upload-header-content-type': 'application/pdf',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: displayName } }),
    },
  )

  const uploadUrl = startRes.headers.get('x-goog-upload-url')
  if (!uploadUrl) throw new Error('Failed to get upload URL from Gemini File API')

  // Step 2: Upload the file
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'x-goog-upload-command': 'upload, finalize',
      'x-goog-upload-offset': '0',
      'content-length': String(pdfBuffer.byteLength),
    },
    body: pdfBuffer,
  })

  if (!uploadRes.ok) {
    const err = await uploadRes.text()
    throw new Error(`Gemini file upload failed: ${err}`)
  }

  const fileInfo = await uploadRes.json()
  const fileUri = fileInfo.file?.uri
  if (!fileUri) throw new Error('No file URI in upload response')

  // Step 3: Wait for file to be ACTIVE (processing may take a moment)
  const fileName = fileInfo.file?.name
  for (let i = 0; i < 30; i++) {
    const statusRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`,
    )
    const status = await statusRes.json()
    if (status.state === 'ACTIVE') return fileUri
    if (status.state === 'FAILED') throw new Error('Gemini file processing failed')
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error('Gemini file processing timed out')
}

async function callGemini(
  apiKey: string,
  fileUri: string,
  userPrompt: string,
  systemPrompt: string,
): Promise<{ result: Record<string, unknown>; inputTokens: number; outputTokens: number }> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { file_data: { mime_type: 'application/pdf', file_uri: fileUri } },
              { text: userPrompt },
            ],
          },
        ],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: EXTRACTION_SCHEMA,
          temperature: 0,
        },
      }),
    },
  )

  if (!response.ok) {
    const errBody = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${errBody}`)
  }

  const json = await response.json()

  const inputTokens = json.usageMetadata?.promptTokenCount ?? 0
  const outputTokens = json.usageMetadata?.candidatesTokenCount ?? 0

  const candidate = json.candidates?.[0]
  if (!candidate?.content?.parts?.[0]?.text) {
    throw new Error('Gemini did not return a valid response')
  }

  const parsed = JSON.parse(candidate.content.parts[0].text)
  return { result: parsed, inputTokens, outputTokens }
}

// ---------------------------------------------------------------------------
// Extraction schema (Gemini JSON mode)
// ---------------------------------------------------------------------------

const EXTRACTION_SCHEMA = {
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
}

// ---------------------------------------------------------------------------
// Progress tracking helper — writes to processing_status for Realtime
// ---------------------------------------------------------------------------

async function emitProgress(
  adminClient: ReturnType<typeof import('https://esm.sh/@supabase/supabase-js@2').createClient>,
  reportId: string,
  step: string,
  status: string,
  message: string,
) {
  await adminClient.from('processing_status').insert({
    report_id: reportId,
    step,
    status,
    message,
  }).then(({ error }) => {
    if (error) console.error(`[progress] Failed to emit ${step}/${status}:`, error.message)
  })
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  let _adminClient: Awaited<ReturnType<typeof authenticateRequest>>['adminClient'] | null = null
  let _reportId: string | null = null

  try {
    const { user, adminClient } = await authenticateRequest(req)
    _adminClient = adminClient

    const { report_id: reportId, company_name: overrideName } =
      (await req.json()) as AnalyzeRequest
    _reportId = reportId ?? null
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

    await emitProgress(adminClient, reportId, 'processing_file', 'in_progress', 'Processing your PDF file…')

    // ------------------------------------------------------------------
    // 2. Download PDF and extract ALL text
    // ------------------------------------------------------------------
    const { data: pdfBytes, error: downloadError } = await adminClient.storage
      .from('reports')
      .download(report.pdf_storage_path)

    if (downloadError || !pdfBytes) {
      throw new Error(`Failed to download PDF: ${downloadError?.message ?? 'no data'}`)
    }

    const geminiApiKey = Deno.env.get('GOOGLE_AI_API_KEY')
    if (!geminiApiKey) throw new Error('GOOGLE_AI_API_KEY is not set')

    await emitProgress(adminClient, reportId, 'processing_file', 'done', 'PDF file ready')
    await emitProgress(adminClient, reportId, 'uploading_to_ai', 'in_progress', 'Uploading PDF to AI engine…')

    // Upload PDF to Gemini File API, then reference it in the prompt.
    // Inline data has a 20MB limit; File API handles any size up to 2GB.
    const pdfBuffer = await pdfBytes.arrayBuffer()
    const pdfSizeMB = (pdfBuffer.byteLength / 1_048_576).toFixed(1)
    console.log(`[analyze] Uploading ${pdfSizeMB}MB PDF to Gemini File API`)

    const fileUri = await uploadToGeminiFileApi(geminiApiKey, pdfBuffer, report.pdf_storage_path)

    await emitProgress(adminClient, reportId, 'uploading_to_ai', 'done', 'PDF uploaded to AI engine')
    await emitProgress(adminClient, reportId, 'analyzing', 'in_progress', 'AI is reading your annual report…')

    // ------------------------------------------------------------------
    // 3. Extract accounting profile with Gemini 2.5 Pro
    // ------------------------------------------------------------------
    const systemPrompt = `You are an expert financial reporting analyst. Analyze this annual report PDF and extract the complete accounting framework.

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

For MENTIONED COMPETITORS: Scan the ENTIRE document for companies explicitly named as competitors, peers, or used in benchmarking comparisons (including compensation/remuneration peer groups). If none found, return an empty array.`

    const userPrompt = `Analyze this annual report${companyNameHint !== 'Pending Analysis' ? ` for "${companyNameHint}"` : ''} and extract the accounting framework, KPI definitions, and mentioned competitors.`

    const { result, inputTokens, outputTokens } = await callGemini(
      geminiApiKey,
      fileUri,
      userPrompt,
      systemPrompt,
    )

    await emitProgress(adminClient, reportId, 'analyzing', 'done', 'Analysis complete')
    await emitProgress(adminClient, reportId, 'saving', 'in_progress', 'Saving your company profile…')

    // Gemini 2.5 Pro pricing (>200K tokens): $1.25/M input, $10/M output
    const estimatedCostUsd = (inputTokens * 1.25 + outputTokens * 10) / 1_000_000

    // Log usage (reuse existing log infrastructure)
    await logAnthropicUsage('BenchmarkSignal', 'analyze-accounting-profile', {
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
      model: 'gemini-2.5-pro',
    })

    // ------------------------------------------------------------------
    // 4. Upsert accounting_profiles row
    // ------------------------------------------------------------------
    const companyName = (result.company_name as string) || companyNameHint

    const profileData = {
      user_id: user.id,
      company_name: companyName,
      accounting_standard: result.accounting_standard as string,
      accounting_standard_confidence: result.accounting_standard_confidence as number,
      policies: result.policies as Record<string, unknown>,
      kpi_mappings: result.kpi_mappings as Record<string, unknown>,
      mentioned_competitors: (result.mentioned_competitors as Array<{ name: string; ticker?: string; context?: string }>) ?? [],
      source_report_id: reportId,
      source_report_title: report.title ?? `${companyName} Annual Report`,
      ai_model: 'gemini-2.5-pro',
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

    await emitProgress(adminClient, reportId, 'saving', 'done', 'Profile saved')
    await emitProgress(adminClient, reportId, 'complete', 'done', 'All done!')

    // ------------------------------------------------------------------
    // 5. Return the extracted profile
    // ------------------------------------------------------------------
    const policyCount = Object.keys(result.policies as Record<string, unknown>).length
    const kpiMappingCount = Object.keys(result.kpi_mappings as Record<string, unknown>).length

    if (result.company_name && report.company_id) {
      await adminClient
        .from('companies')
        .update({ name: result.company_name as string })
        .eq('id', report.company_id)
    }

    console.log(`[analyze] Tokens: ${inputTokens} in / ${outputTokens} out | Cost: $${estimatedCostUsd.toFixed(4)} | Company: ${companyName} | PDF: ${pdfSizeMB}MB`)

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
        model: 'gemini-2.5-pro',
        pdf_size_mb: parseFloat(pdfSizeMB),
      },
    })
  } catch (err) {
    console.error('[analyze] Error:', err instanceof Error ? err.message : String(err))
    console.error('[analyze] Stack:', err instanceof Error ? err.stack : 'no stack')

    // Emit error status so the frontend knows processing failed
    if (_adminClient && _reportId) {
      await emitProgress(_adminClient, _reportId, 'error', 'error', err instanceof Error ? err.message : 'Analysis failed').catch(() => {})
    }

    return errorResponse(err)
  }
})
