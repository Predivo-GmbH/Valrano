import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { user, adminClient } = await authenticateRequest(req)

    const formData = await req.formData()
    const file = formData.get('file') as File
    const companyId = formData.get('company_id') as string
    const reportType = formData.get('report_type') as string
    const fiscalYearRaw = formData.get('fiscal_year') as string
    const fiscalQuarterRaw = formData.get('fiscal_quarter') as string | null

    const fiscalYear = fiscalYearRaw ? parseInt(fiscalYearRaw, 10) : (new Date().getFullYear() - 1)
    const fiscalQuarter = fiscalQuarterRaw ? parseInt(fiscalQuarterRaw, 10) : null
    const effectiveReportType = reportType || 'annual'

    // Required field validation
    if (!file || !companyId) {
      return jsonResponse(
        { error: 'Missing required fields: file, company_id' },
        400,
      )
    }

    // File type validation
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return jsonResponse({ error: 'Only PDF files are accepted' }, 400)
    }

    // File size validation — 50 MB max
    if (file.size > 50 * 1024 * 1024) {
      return jsonResponse({ error: 'File too large. Maximum 50MB.' }, 400)
    }

    // Verify company exists
    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .select('id')
      .eq('id', companyId)
      .maybeSingle()

    if (companyError) throw new Error(`Company lookup failed: ${companyError.message}`)
    if (!company) {
      return jsonResponse({ error: `Company not found: ${companyId}` }, 404)
    }

    // Data isolation: verify company is in user's peer groups
    const { data: visibleIds } = await adminClient
      .rpc('visible_company_ids_for_user', { p_user_id: user.id })
    const visible = new Set((visibleIds ?? []) as string[])
    if (!visible.has(companyId)) {
      return jsonResponse({ error: 'Company not in your peer groups' }, 403)
    }

    // Upload PDF to Supabase Storage
    const storagePath = `${companyId}/${fiscalYear}/${file.name}`
    const fileBuffer = await file.arrayBuffer()

    const { error: uploadError } = await adminClient.storage
      .from('reports')
      .upload(storagePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

    // Create report record
    const { data: report, error: insertError } = await adminClient
      .from('reports')
      .insert({
        company_id: companyId,
        report_type: effectiveReportType,
        fiscal_year: fiscalYear,
        fiscal_quarter: fiscalQuarter,
        title: file.name.replace(/\.pdf$/i, ''),
        pdf_storage_path: storagePath,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError) throw new Error(`Report insert failed: ${insertError.message}`)

    return jsonResponse({ report_id: report.id, storage_path: storagePath })
  } catch (err) {
    return errorResponse(err)
  }
})
