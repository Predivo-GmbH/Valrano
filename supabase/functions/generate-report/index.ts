import { authenticateRequest, errorResponse, jsonResponse, AuthError } from '../_shared/auth.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logAnthropicUsage } from '../_shared/log-usage.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
if (!ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY not set')
}

interface GenerateReportRequest {
  report_id: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { user, adminClient } = await authenticateRequest(req)

    const body: GenerateReportRequest = await req.json()
    if (!body.report_id) {
      throw new AuthError('report_id is required', 400)
    }

    // Load report config
    const { data: report, error: reportErr } = await adminClient
      .from('custom_reports')
      .select('*, report_templates(*)')
      .eq('id', body.report_id)
      .eq('user_id', user.id)
      .single()
    if (reportErr || !report) {
      throw new AuthError('Report not found', 404)
    }

    // Update status to generating
    await adminClient
      .from('custom_reports')
      .update({ status: 'generating', error_message: null })
      .eq('id', body.report_id)

    const config = report.config_json as {
      company_ids?: string[]
      kpi_codes?: string[]
      fiscal_year?: number
      peer_group_id?: string
      sections?: string[]
    }

    const templateDef = report.report_templates?.template_json as {
      sections?: string[]
      style?: string
      max_kpis?: number
      include_charts?: boolean
      include_narrative?: boolean
    } | null

    const sections = config.sections ?? templateDef?.sections ?? ['executive_summary', 'kpi_comparison_table', 'peer_ranking']
    const style = templateDef?.style ?? 'executive_brief'
    const fiscalYear = config.fiscal_year ?? new Date().getFullYear() - 1

    // Load companies
    let companyIds = config.company_ids ?? []
    if (config.peer_group_id) {
      const { data: members } = await adminClient
        .from('peer_group_members')
        .select('company_id')
        .eq('peer_group_id', config.peer_group_id)
      companyIds = (members ?? []).map((m: { company_id: string }) => m.company_id)
    }
    if (companyIds.length === 0) {
      const { data: allCo } = await adminClient
        .from('companies')
        .select('id')
        .eq('is_active', true)
      companyIds = (allCo ?? []).map((c: { id: string }) => c.id)
    }

    // Load company names
    const { data: companiesData } = await adminClient
      .from('companies')
      .select('id, name, ticker, sector')
      .in('id', companyIds)

    // Load KPI values
    let kpiQuery = adminClient
      .from('kpi_values')
      .select('*, kpi_definitions(code, name, unit_type)')
      .in('company_id', companyIds)
      .eq('fiscal_year', fiscalYear)

    const { data: kpiValues } = await kpiQuery

    // Filter by KPI codes if specified
    let filteredKpis = kpiValues ?? []
    if (config.kpi_codes?.length) {
      const codeSet = new Set(config.kpi_codes)
      filteredKpis = filteredKpis.filter((k: { kpi_definitions: { code: string } }) =>
        codeSet.has(k.kpi_definitions?.code)
      )
    }

    // Build data summary for AI
    const companyNames = (companiesData ?? []).map((c: { name: string; ticker: string | null }) =>
      `${c.name}${c.ticker ? ` (${c.ticker})` : ''}`
    ).join(', ')

    const kpiSummary = filteredKpis.map((k: { kpi_definitions: { code: string; name: string }; normalized_value: number | null; company_id: string }) => {
      const company = (companiesData ?? []).find((c: { id: string }) => c.id === k.company_id)
      return `${company?.name ?? 'Unknown'} | ${k.kpi_definitions.name}: ${k.normalized_value?.toLocaleString() ?? 'N/A'}`
    }).join('\n')

    // Generate AI content
    const prompt = `You are a senior financial analyst generating a ${style.replace('_', ' ')} report.

REPORT TITLE: "${report.title}"
FISCAL YEAR: ${fiscalYear}
COMPANIES: ${companyNames}
SECTIONS REQUESTED: ${sections.join(', ')}

DATA:
${kpiSummary || 'No KPI data available — generate placeholder content noting data gaps.'}

Generate a comprehensive report with the following sections. Use professional financial language. Include specific numbers from the data. Format as JSON with this structure:
{
  "title": "${report.title}",
  "fiscal_year": ${fiscalYear},
  "generated_at": "${new Date().toISOString()}",
  "sections": [
    {
      "id": "section_id",
      "title": "Section Title",
      "content": "Narrative content with specific data points...",
      "data_points": [{"label": "...", "value": "..."}]
    }
  ],
  "executive_summary": "2-3 sentence overview",
  "key_findings": ["finding 1", "finding 2", "finding 3"]
}

Generate content for these sections: ${sections.join(', ')}
Be specific, use actual numbers from the data, and provide actionable insights.`

    let contentJson = null
    let contentHtml = ''

    if (ANTHROPIC_API_KEY) {
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
            max_tokens: 4096,
            temperature: 0,
            messages: [{ role: 'user', content: prompt }],
          }),
        })

        if (aiResponse.ok) {
          const aiData = await aiResponse.json()
          await logAnthropicUsage('BenchmarkSignal', 'generate-report', aiData)
          const rawText = aiData.content?.[0]?.text ?? ''

          // Parse JSON from response
          const jsonMatch = rawText.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            contentJson = JSON.parse(jsonMatch[0])
          }
        }
      } catch (aiErr) {
        console.error('AI generation failed:', aiErr)
      }
    }

    // Generate HTML from content
    if (contentJson) {
      contentHtml = generateHtml(contentJson, report.title)
    }

    // Fallback if AI failed
    if (!contentJson) {
      contentJson = {
        title: report.title,
        fiscal_year: fiscalYear,
        generated_at: new Date().toISOString(),
        sections: sections.map((s: string) => ({
          id: s,
          title: s.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          content: `Content for ${s} section — pending data enrichment.`,
          data_points: [],
        })),
        executive_summary: `Report for ${companyNames} covering fiscal year ${fiscalYear}.`,
        key_findings: ['Data compilation in progress'],
      }
      contentHtml = generateHtml(contentJson, report.title)
    }

    // Update report with generated content
    const { error: updateErr } = await adminClient
      .from('custom_reports')
      .update({
        content_json: contentJson,
        content_html: contentHtml,
        status: 'ready',
        last_generated_at: new Date().toISOString(),
      })
      .eq('id', body.report_id)

    if (updateErr) {
      throw new AuthError('Failed to save report', 500)
    }

    return jsonResponse({
      report_id: body.report_id,
      status: 'ready',
      sections: contentJson.sections?.length ?? 0,
      title: report.title,
    })
  } catch (err) {
    return errorResponse(err)
  }
})

function generateHtml(content: Record<string, unknown>, title: string): string {
  const sections = (content.sections as Array<{ title: string; content: string; data_points?: Array<{ label: string; value: string }> }>) ?? []
  const execSummary = content.executive_summary as string ?? ''
  const findings = (content.key_findings as string[]) ?? []

  let html = `<div class="report">
<h1>${title}</h1>
<p class="meta">Generated ${new Date().toLocaleDateString()} | Fiscal Year ${content.fiscal_year}</p>
`

  if (execSummary) {
    html += `<div class="executive-summary"><h2>Executive Summary</h2><p>${execSummary}</p></div>\n`
  }

  if (findings.length > 0) {
    html += `<div class="key-findings"><h2>Key Findings</h2><ul>${findings.map((f: string) => `<li>${f}</li>`).join('')}</ul></div>\n`
  }

  for (const section of sections) {
    html += `<div class="section" id="${section.title.toLowerCase().replace(/\s+/g, '-')}">
<h2>${section.title}</h2>
<p>${section.content}</p>
`
    if (section.data_points && section.data_points.length > 0) {
      html += `<table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>`
      for (const dp of section.data_points) {
        html += `<tr><td>${dp.label}</td><td>${dp.value}</td></tr>`
      }
      html += `</tbody></table>\n`
    }
    html += `</div>\n`
  }

  html += `</div>`
  return html
}
