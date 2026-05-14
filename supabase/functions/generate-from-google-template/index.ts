import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

/**
 * generate-from-google-template: Copies a Google Slides/Sheets template,
 * replaces all {{placeholders}} with data, and exports as PDF.
 *
 * Body: { template_id, data?: Record<string, string>, report_id?: string }
 *
 * Flow:
 * 1. Copy the Google template to user's Drive
 * 2. Replace all {{placeholder}} text via Slides/Sheets API
 * 3. Export as PDF
 * 4. Upload PDF to Supabase Storage
 * 5. Clean up the copy from Drive
 *
 * Required env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
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

    if (!template.google_file_id) {
      return jsonResponse({ error: 'Not a Google Workspace template' }, 400)
    }

    // Get user's Google tokens
    const accessToken = await getValidAccessToken(adminClient, user.id)
    if (!accessToken) {
      return jsonResponse({ error: 'Google not connected or token expired. Please reconnect.' }, 401)
    }

    // Build replacement data
    let replacementData: Record<string, string> = data ?? {}

    if (report_id) {
      const { data: report } = await adminClient
        .from('custom_reports')
        .select('content_json')
        .eq('id', report_id)
        .eq('user_id', user.id)
        .single()

      if (report?.content_json) {
        const flattened = flattenObject(report.content_json as Record<string, unknown>)
        replacementData = { ...flattened, ...replacementData }
      }
    }

    // Resolve placeholder_mapping
    const mapping = (template.placeholder_mapping ?? {}) as Record<string, string>
    const kpiData = await fetchKpiData(adminClient, user.id)
    for (const [placeholder, source] of Object.entries(mapping)) {
      if (replacementData[placeholder]) continue
      const value = resolveDataSource(source, kpiData)
      if (value !== undefined) replacementData[placeholder] = value
    }

    // Create export record
    const outputFormat = template.file_format === 'gslides' ? 'gslides_pdf' : 'gsheets_pdf'
    const { data: exportRecord, error: insertErr } = await adminClient
      .from('generated_exports')
      .insert({
        user_id: user.id,
        template_id,
        custom_report_id: report_id ?? null,
        output_format: outputFormat,
        data_snapshot: replacementData,
        status: 'generating',
      })
      .select()
      .single()

    if (insertErr) {
      return jsonResponse({ error: 'Failed to create export record' }, 500)
    }

    try {
      // Step 1: Copy the template
      const copyRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${template.google_file_id}/copy`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: `${template.name} — Generated ${new Date().toISOString().split('T')[0]}`,
          }),
        },
      )

      if (!copyRes.ok) {
        throw new Error(`Failed to copy template: ${await copyRes.text()}`)
      }

      const copy = await copyRes.json()
      const copyId = copy.id

      // Step 2: Replace placeholders
      if (template.file_format === 'gslides') {
        await replaceSlidesPlaceholders(accessToken, copyId, replacementData)
      } else {
        await replaceSheetsPlaceholders(accessToken, copyId, replacementData)
      }

      // Step 3: Export as PDF
      const mimeType = 'application/pdf'
      const exportRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${copyId}/export?mimeType=${encodeURIComponent(mimeType)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      )

      if (!exportRes.ok) {
        throw new Error(`Failed to export PDF: ${await exportRes.text()}`)
      }

      const pdfBuffer = new Uint8Array(await exportRes.arrayBuffer())

      // Step 4: Upload PDF to Supabase Storage
      const outputPath = `${user.id}/exports/${exportRecord.id}.pdf`
      const { error: uploadErr } = await adminClient
        .storage
        .from('corporate-templates')
        .upload(outputPath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        })

      if (uploadErr) {
        throw new Error(`Failed to upload PDF: ${uploadErr.message}`)
      }

      // Step 5: Clean up the Drive copy
      await fetch(`https://www.googleapis.com/drive/v3/files/${copyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })

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
    } catch (genErr) {
      await adminClient
        .from('generated_exports')
        .update({ status: 'error', error_message: (genErr as Error).message })
        .eq('id', exportRecord.id)
      throw genErr
    }
  } catch (err) {
    return errorResponse(err)
  }
})

// ---------------------------------------------------------------------------
// Google Slides: batch replace text
// ---------------------------------------------------------------------------
async function replaceSlidesPlaceholders(
  accessToken: string,
  presentationId: string,
  data: Record<string, string>,
) {
  const requests = Object.entries(data).map(([key, value]) => ({
    replaceAllText: {
      containsText: { text: `{{${key}}}`, matchCase: true },
      replaceText: String(value),
    },
  }))

  if (requests.length === 0) return

  const res = await fetch(
    `https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    },
  )

  if (!res.ok) {
    throw new Error(`Slides batchUpdate failed: ${await res.text()}`)
  }
}

// ---------------------------------------------------------------------------
// Google Sheets: find and replace text in all cells
// ---------------------------------------------------------------------------
async function replaceSheetsPlaceholders(
  accessToken: string,
  spreadsheetId: string,
  data: Record<string, string>,
) {
  const requests = Object.entries(data).map(([key, value]) => ({
    findReplace: {
      find: `{{${key}}}`,
      replacement: String(value),
      allSheets: true,
      matchCase: true,
    },
  }))

  if (requests.length === 0) return

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    },
  )

  if (!res.ok) {
    throw new Error(`Sheets batchUpdate failed: ${await res.text()}`)
  }
}

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------
async function getValidAccessToken(
  adminClient: ReturnType<typeof import('https://esm.sh/@supabase/supabase-js@2').createClient>,
  userId: string,
): Promise<string | null> {
  const { data: conn } = await adminClient
    .from('google_connections')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!conn) return null

  // Check if token is still valid (with 5 min buffer)
  const expiresAt = new Date(conn.token_expires_at).getTime()
  if (Date.now() < expiresAt - 5 * 60 * 1000) {
    return conn.access_token
  }

  // Refresh the token
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  if (!clientId || !clientSecret) return null

  const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  if (!refreshRes.ok) return null

  const tokens = await refreshRes.json()
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  await adminClient
    .from('google_connections')
    .update({
      access_token: tokens.access_token,
      token_expires_at: newExpiresAt,
    })
    .eq('user_id', userId)

  return tokens.access_token
}

// ---------------------------------------------------------------------------
// Shared helpers (duplicated from generate-from-template for isolation)
// ---------------------------------------------------------------------------
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
  adminClient: ReturnType<typeof import('https://esm.sh/@supabase/supabase-js@2').createClient>,
  userId: string,
): Promise<Record<string, string>> {
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
      const key = `kpi.${kpi.kpi_code}`
      if (!result[key]) result[key] = String(kpi.value ?? '')
      result[`kpi.${kpi.kpi_code}.${kpi.fiscal_year}`] = String(kpi.value ?? '')
    }
  }

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

  result['date.today'] = new Date().toISOString().split('T')[0]
  result['date.year'] = String(new Date().getFullYear())

  return result
}

function resolveDataSource(
  source: string,
  kpiData: Record<string, string>,
): string | undefined {
  if (source.startsWith('kpi.') || source.startsWith('company.') || source.startsWith('date.')) {
    return kpiData[source]
  }
  return undefined
}
