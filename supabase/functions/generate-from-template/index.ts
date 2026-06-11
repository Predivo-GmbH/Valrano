import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import JSZip from 'https://esm.sh/jszip@3.10.1'

/**
 * generate-from-template: Takes a corporate template + data mapping,
 * replaces all {{placeholders}} with actual values, and saves the output.
 *
 * Body: { template_id, data?: Record<string, string>, report_id?: string }
 * - If report_id is given, data is sourced from the custom_report's content.
 * - If data is given directly, those values are used.
 */
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { user, adminClient } = await authenticateRequest(req)
    const { template_id, data, report_id } = await req.json()

    if (!template_id) {
      return jsonResponse({ error: 'template_id is required' }, 400)
    }

    // Fetch template
    const { data: template, error: tplErr } = await adminClient
      .from('corporate_templates')
      .select('*')
      .eq('id', template_id)
      .eq('user_id', user.id)
      .single()

    if (tplErr || !template) {
      return jsonResponse({ error: 'Template not found' }, 404)
    }

    if (template.status !== 'ready') {
      return jsonResponse({ error: 'Template is not ready (parse first)' }, 400)
    }

    // Build replacement data
    let replacementData: Record<string, string> = data ?? {}

    // If report_id specified, merge report content as data source
    if (report_id) {
      const { data: report } = await adminClient
        .from('custom_reports')
        .select('content_json, config_json')
        .eq('id', report_id)
        .eq('user_id', user.id)
        .single()

      if (report?.content_json) {
        // Flatten content_json into string key-value pairs
        const flattened = flattenObject(report.content_json as Record<string, unknown>)
        replacementData = { ...flattened, ...replacementData }
      }
    }

    // Also resolve placeholder_mapping from template
    const mapping = (template.placeholder_mapping ?? {}) as Record<string, string>

    // Fetch KPI data for dynamic mappings
    const kpiData = await fetchKpiData(adminClient, user.id)

    // Resolve mappings: placeholder_key -> data_source -> actual value
    for (const [placeholder, source] of Object.entries(mapping)) {
      if (replacementData[placeholder]) continue // explicit data takes precedence
      const value = resolveDataSource(source, kpiData, replacementData)
      if (value !== undefined) {
        replacementData[placeholder] = value
      }
    }

    // Create generated_exports record
    const { data: exportRecord, error: insertErr } = await adminClient
      .from('generated_exports')
      .insert({
        user_id: user.id,
        template_id,
        custom_report_id: report_id ?? null,
        output_format: template.file_format === 'xlsx' ? 'xlsx' : 'pptx',
        data_snapshot: replacementData,
        status: 'generating',
      })
      .select()
      .single()

    if (insertErr) {
      return jsonResponse({ error: 'Failed to create export record' }, 500)
    }

    // Download and process template file
    const { data: fileData } = await adminClient
      .storage
      .from('corporate-templates')
      .download(template.storage_path)

    if (!fileData) {
      await adminClient
        .from('generated_exports')
        .update({ status: 'error', error_message: 'Failed to download template' })
        .eq('id', exportRecord.id)
      return jsonResponse({ error: 'Failed to download template' }, 500)
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)

    // For .xlsx: handle sharedStrings.xml (where cell text lives) + inline strings
    // For .pptx: replace across all XML files (slides, layouts, masters)
    if (template.file_format === 'xlsx') {
      // SharedStrings.xml holds most cell text in Excel
      const sharedStrings = zip.file('xl/sharedStrings.xml')
      if (sharedStrings) {
        let content = await sharedStrings.async('string')
        let modified = false
        for (const [key, value] of Object.entries(replacementData)) {
          const pattern = `{{${key}}}`
          if (content.includes(pattern)) {
            content = content.replaceAll(pattern, escapeXml(String(value)))
            modified = true
          }
        }
        if (modified) zip.file('xl/sharedStrings.xml', content)
      }

      // Also replace in worksheet inline strings and header/footer
      for (const [path, file] of Object.entries(zip.files)) {
        if (path.startsWith('xl/worksheets/') && path.endsWith('.xml')) {
          let content = await (file as JSZip.JSZipObject).async('string')
          let modified = false
          for (const [key, value] of Object.entries(replacementData)) {
            const pattern = `{{${key}}}`
            if (content.includes(pattern)) {
              content = content.replaceAll(pattern, escapeXml(String(value)))
              modified = true
            }
          }
          if (modified) zip.file(path, content)
        }
      }
    } else {
      // .pptx: replace in all XML files
      for (const [path, file] of Object.entries(zip.files)) {
        if (path.endsWith('.xml') || path.endsWith('.xml.rels')) {
          let content = await (file as JSZip.JSZipObject).async('string')
          let modified = false
          for (const [key, value] of Object.entries(replacementData)) {
            const pattern = `{{${key}}}`
            if (content.includes(pattern)) {
              content = content.replaceAll(pattern, escapeXml(String(value)))
              modified = true
            }
          }
          if (modified) zip.file(path, content)
        }
      }
    }

    // Generate output
    const outputBuffer = await zip.generateAsync({ type: 'uint8array' })
    const outputPath = `${user.id}/exports/${exportRecord.id}.${template.file_format}`

    // Upload to storage
    const { error: uploadErr } = await adminClient
      .storage
      .from('corporate-templates')
      .upload(outputPath, outputBuffer, {
        contentType: template.file_format === 'pptx'
          ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
      })

    if (uploadErr) {
      await adminClient
        .from('generated_exports')
        .update({ status: 'error', error_message: 'Failed to upload generated file' })
        .eq('id', exportRecord.id)
      return jsonResponse({ error: 'Failed to upload generated file' }, 500)
    }

    // Update export record
    await adminClient
      .from('generated_exports')
      .update({ status: 'ready', output_path: outputPath })
      .eq('id', exportRecord.id)

    return jsonResponse({
      export_id: exportRecord.id,
      output_path: outputPath,
      placeholders_replaced: Object.keys(replacementData).length,
      status: 'ready',
    })
  } catch (err) {
    return errorResponse(err)
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey))
    } else {
      result[fullKey] = String(value ?? '')
    }
  }
  return result
}

async function fetchKpiData(
  adminClient: ReturnType<typeof import('https://esm.sh/@supabase/supabase-js@2.49.4').createClient>,
  userId: string,
): Promise<Record<string, string>> {
  // Fetch the user's primary company KPIs
  const { data: companies } = await adminClient
    .from('my_companies')
    .select('company_id')
    .eq('user_id', userId)
    .eq('is_primary', true)
    .limit(1)

  if (!companies?.length) return {}

  const companyId = companies[0].company_id
  const { data: kpis } = await adminClient
    .from('kpi_values')
    .select('kpi_code, value, fiscal_year')
    .eq('company_id', companyId)
    .order('fiscal_year', { ascending: false })

  const result: Record<string, string> = {}
  if (kpis) {
    for (const kpi of kpis) {
      // Use most recent value for each KPI
      const key = `kpi.${kpi.kpi_code}`
      if (!result[key]) {
        result[key] = String(kpi.value ?? '')
      }
      // Also store year-specific
      result[`kpi.${kpi.kpi_code}.${kpi.fiscal_year}`] = String(kpi.value ?? '')
    }
  }

  // Fetch company info
  const { data: company } = await adminClient
    .from('companies')
    .select('name, ticker, sector, industry, country, website')
    .eq('id', companyId)
    .single()

  if (company) {
    result['company.name'] = company.name ?? ''
    result['company.ticker'] = company.ticker ?? ''
    result['company.sector'] = company.sector ?? ''
    result['company.industry'] = company.industry ?? ''
    result['company.country'] = company.country ?? ''
    result['company.website'] = company.website ?? ''
  }

  // Current date info
  result['date.today'] = new Date().toISOString().split('T')[0]
  result['date.year'] = String(new Date().getFullYear())

  return result
}

function resolveDataSource(
  source: string,
  kpiData: Record<string, string>,
  explicitData: Record<string, string>,
): string | undefined {
  // Direct KPI reference: "kpi.revenue" or "kpi.revenue.2025"
  if (source.startsWith('kpi.') || source.startsWith('company.') || source.startsWith('date.')) {
    return kpiData[source]
  }
  // Explicit data reference
  return explicitData[source]
}
