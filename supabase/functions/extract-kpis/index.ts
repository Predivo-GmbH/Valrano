import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { extractTextFromPdf } from '../_shared/pdf-text.ts'
import { logAnthropicUsage } from '../_shared/log-usage.ts'

const GEMINI_MODEL = 'gemini-2.5-pro'

// ---------------------------------------------------------------------------
// KPI codes recognised by the extraction tool (must be before schema)
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

// Gemini JSON mode schema for KPI extraction
const KPI_EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    report_type: {
      type: 'string',
      enum: ['annual', 'quarterly', 'half_year', 'sustainability'],
      description: 'Detected type of report: annual report, quarterly report, half-year/semi-annual report, or sustainability/ESG report',
    },
    fiscal_year: {
      type: 'integer',
      description: 'The primary fiscal year this report covers (e.g. 2025 for a "2025 Annual Report")',
    },
    fiscal_quarter: {
      type: 'integer',
      description: 'The fiscal quarter if quarterly (1-4), or 0 for annual/half-year/sustainability',
    },
    kpis: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kpi_code: { type: 'string', enum: KPI_CODES as unknown as string[] },
          raw_value: { type: 'number' },
          raw_currency: { type: 'string' },
          raw_label: { type: 'string', description: 'The exact label as printed in the report' },
          fiscal_year: { type: 'integer' },
          fiscal_quarter: { type: 'integer', description: '0 for annual reports' },
          confidence: { type: 'number', description: '0-1 confidence score' },
          source_page: { type: 'integer' },
          source_text: { type: 'string', description: 'The surrounding text context' },
        },
        required: ['kpi_code', 'raw_value', 'raw_currency', 'raw_label', 'fiscal_year', 'confidence', 'source_page'],
      },
    },
  },
  required: ['report_type', 'fiscal_year', 'fiscal_quarter', 'kpis'],
} as const

// Schema for optional company metadata extraction
const COMPANY_METADATA_SCHEMA = {
  type: 'object',
  properties: {
    company_metadata: {
      type: 'object',
      description: 'Company-level metadata extracted from the report. Only populate fields clearly stated in the report.',
      properties: {
        sector: {
          type: 'string',
          description: 'Industry sector (e.g. "Building Materials", "Pharmaceuticals", "Banking"). Use broad sector names.',
        },
        country: {
          type: 'string',
          description: 'Country of headquarters as full name (e.g. "Switzerland", "Germany", "United States").',
        },
        reporting_currency: {
          type: 'string',
          description: 'Primary reporting currency as ISO 4217 code (e.g. "CHF", "EUR", "USD").',
        },
        headcount: {
          type: 'integer',
          description: 'Total number of employees (FTE or headcount) as stated in the report.',
        },
        founded_year: {
          type: 'integer',
          description: 'Year the company was founded/incorporated, if mentioned.',
        },
        website_url: {
          type: 'string',
          description: 'Company website URL if stated in the report (e.g. "https://www.holcim.com").',
        },
      },
    },
  },
} as const

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

interface CompanyMetadata {
  sector?: string
  country?: string
  reporting_currency?: string
  headcount?: number
  founded_year?: number
  website_url?: string
}

interface ClaudeToolResult {
  report_type: 'annual' | 'quarterly' | 'half_year' | 'sustainability'
  fiscal_year: number
  fiscal_quarter: number
  kpis: ExtractedKpi[]
  company_metadata?: CompanyMetadata
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
        model_used: GEMINI_MODEL,
        started_at: new Date().toISOString(),
        status: 'running',
        total_kpis_extracted: 0,
      })
      .select()
      .single()

    if (extractionError) throw new Error(`Extraction insert failed: ${extractionError.message}`)

    // ------------------------------------------------------------------
    // 4. Download PDF → extract text
    // ------------------------------------------------------------------
    const { data: pdfData, error: downloadError } = await adminClient.storage
      .from('reports')
      .download(report.pdf_storage_path)

    if (downloadError) throw new Error(`PDF download failed: ${downloadError.message}`)

    const pdfArrayBuffer = await pdfData.arrayBuffer()
    // Limit to first 80 pages to stay within compute limits (financial data is typically in first half)
    const { text: fullText, pageCount, extractedPages } = await extractTextFromPdf(pdfArrayBuffer, [{ start: 1, end: 80 }])
    // Truncate to ~500K chars max to fit Gemini context window and edge function limits
    const pdfText = fullText.length > 500000 ? fullText.slice(0, 500000) : fullText
    const charCount = pdfText.length

    if (!pdfText || charCount < 100) {
      return jsonResponse({ error: 'Could not extract text from PDF. The file may be image-only or corrupt.' }, 422)
    }

    console.log(`[extract-kpis] Extracted ${charCount} chars from ${pageCount} pages`)

    // ------------------------------------------------------------------
    // 5. Call Gemini 2.5 Pro with extracted text
    // ------------------------------------------------------------------
    const geminiApiKey = Deno.env.get('GOOGLE_AI_API_KEY')
    if (!geminiApiKey) throw new Error('GOOGLE_AI_API_KEY is not set')

    const systemPrompt = `You are a financial data extraction expert. Extract KPIs from this corporate report for ${companyName}${companyTicker ? ` (${companyTicker})` : ''}.
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
- Note the fiscal_year and fiscal_quarter (use 0 for annual)
- Assign a confidence score (0-1): 1.0 = clearly stated, 0.9 = derived/calculated, 0.7 = estimated from context
- Record the source_page number
- Include surrounding source_text for audit trail${accountingProfile ? '\n- In source_text, note any accounting policy differences vs the user\'s framework (e.g., "Competitor includes restructuring in EBITDA; user excludes it")' : ''}

Important: Values are typically in millions unless stated otherwise. Convert all values to millions.

ALSO determine the report metadata:
- report_type: "annual" for annual/yearly reports, "quarterly" for Q1-Q4 reports, "half_year" for H1/H2/semi-annual, "sustainability" for ESG/sustainability reports. If unclear, default to "annual".
- fiscal_year: The primary fiscal year covered (e.g. 2025 for "Annual Report 2025"). Look at the cover page, title, or header.
- fiscal_quarter: The quarter number (1-4) for quarterly reports, or 0 for annual/half_year/sustainability.

ALSO extract company metadata if clearly stated in the report (populate company_metadata object):
- sector: The company's industry sector (e.g. "Building Materials", "Pharmaceuticals", "Banking")
- country: Country of headquarters as full name (e.g. "Switzerland", "Germany")
- reporting_currency: The primary currency of the financial statements (CHF, EUR, USD) — infer from currency used for revenue
- headcount: Total number of employees (FTE) if stated
- founded_year: Year the company was founded, if mentioned
- website_url: The company's website URL if printed in the report
Only include fields you can extract with high confidence. Omit any you are unsure about.`

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: `<annual_report>\n${pdfText}\n</annual_report>` }],
          }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              ...KPI_EXTRACTION_SCHEMA,
              properties: {
                ...KPI_EXTRACTION_SCHEMA.properties,
                ...COMPANY_METADATA_SCHEMA.properties,
              },
            },
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

    await logAnthropicUsage('Valrano', 'extract-kpis', {
      model: GEMINI_MODEL,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    })

    // ------------------------------------------------------------------
    // 6. Parse Gemini JSON response
    // ------------------------------------------------------------------
    const candidate = geminiJson.candidates?.[0]
    if (!candidate?.content?.parts?.[0]?.text) {
      throw new Error('Gemini did not return a valid response')
    }

    const parsed = JSON.parse(candidate.content.parts[0].text) as ClaudeToolResult
    const extractedKpis: ExtractedKpi[] = (parsed.kpis ?? []).map(kpi => ({
      ...kpi,
      // Gemini uses 0 for annual (null not supported in JSON schema), convert back
      fiscal_quarter: kpi.fiscal_quarter === 0 ? null : kpi.fiscal_quarter,
    }))

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
        kpi_definition_id: kpiDefMap.get(kpi.kpi_code) as string,
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

    // Update report status → extracted, and set AI-detected report_type + fiscal_year
    const reportUpdate: Record<string, unknown> = { status: 'extracted' }
    if (parsed.report_type) reportUpdate.report_type = parsed.report_type
    if (parsed.fiscal_year) reportUpdate.fiscal_year = parsed.fiscal_year
    if (parsed.fiscal_quarter && parsed.fiscal_quarter > 0) {
      reportUpdate.fiscal_quarter = parsed.fiscal_quarter
    }

    await adminClient
      .from('reports')
      .update(reportUpdate)
      .eq('id', reportId)

    // ------------------------------------------------------------------
    // 10. Auto-populate my_companies metadata (only null fields)
    // ------------------------------------------------------------------
    let metadataFieldsPopulated = 0
    if (parsed.company_metadata) {
      try {
        const { data: myCompany } = await adminClient
          .from('my_companies')
          .select('id, sector, country, reporting_currency, headcount, founded_year, website_url')
          .eq('user_id', user.id)
          .eq('company_id', company.id)
          .maybeSingle()

        if (myCompany) {
          const meta = parsed.company_metadata
          const metaUpdate: Record<string, unknown> = {}

          if (!myCompany.sector && meta.sector) metaUpdate.sector = meta.sector
          if (!myCompany.country && meta.country) metaUpdate.country = meta.country
          if (!myCompany.reporting_currency && meta.reporting_currency) metaUpdate.reporting_currency = meta.reporting_currency
          if (!myCompany.headcount && meta.headcount) metaUpdate.headcount = meta.headcount
          if (!myCompany.founded_year && meta.founded_year) metaUpdate.founded_year = meta.founded_year
          if (!myCompany.website_url && meta.website_url) metaUpdate.website_url = meta.website_url

          if (Object.keys(metaUpdate).length > 0) {
            await adminClient
              .from('my_companies')
              .update(metaUpdate)
              .eq('id', myCompany.id)

            metadataFieldsPopulated = Object.keys(metaUpdate).length
            console.log(`[extract-kpis] Auto-populated ${metadataFieldsPopulated} metadata fields for my_company ${myCompany.id}`)
          }
        }
      } catch (metaErr) {
        // Non-blocking: metadata population is best-effort
        console.warn('[extract-kpis] Failed to auto-populate metadata:', metaErr)
      }
    }

    return jsonResponse({
      extraction_id: extraction.id,
      total_kpis_extracted: totalExtracted,
      avg_confidence: avgConfidence,
      needs_review_count: kpiValuesToInsert.filter((v) => v.needs_review).length,
      detected_report_type: parsed.report_type ?? null,
      detected_fiscal_year: parsed.fiscal_year ?? null,
      metadata_fields_populated: metadataFieldsPopulated,
    })
  } catch (err) {
    return errorResponse(err)
  }
})
