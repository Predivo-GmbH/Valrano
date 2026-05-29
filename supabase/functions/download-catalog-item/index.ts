import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'

/**
 * download-catalog-item — User-initiated download & analysis of an IR catalog item
 *
 * 1. Loads the catalog item
 * 2. Creates a reports row (company_id, report_type, fiscal_year, source_url)
 * 3. Links catalog item to report (report_id, is_downloaded)
 * 4. Triggers pipeline-orchestrator (download → extract-kpis → normalize-kpis)
 *
 * User-initiated only. No automatic mass-download.
 */

/** Map catalog document_type to report_type */
function mapDocumentTypeToReportType(docType: string | null): string | null {
  const mapping: Record<string, string> = {
    annual_report: 'annual',
    quarterly_report: 'quarterly',
    half_year_report: 'half_year',
    sustainability_report: 'sustainability',
    financial_statements: 'annual',
  }
  return docType ? mapping[docType] ?? null : null
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { user, adminClient } = await authenticateRequest(req)
    const authHeader = req.headers.get('Authorization')!
    const { catalog_item_id, company_id } = await req.json()

    if (!catalog_item_id) {
      return jsonResponse({ error: 'catalog_item_id is required' }, 400)
    }

    // Load catalog item
    const { data: item, error: itemErr } = await adminClient
      .from('ir_catalog_items')
      .select('*')
      .eq('id', catalog_item_id)
      .single()

    if (itemErr || !item) {
      return jsonResponse({ error: 'Catalog item not found' }, 404)
    }

    if (item.is_downloaded && item.report_id) {
      return jsonResponse({
        error: 'This document has already been downloaded and analyzed',
        report_id: item.report_id,
      }, 409)
    }

    // Map document type to report type
    const reportType = mapDocumentTypeToReportType(item.document_type)
    if (!reportType) {
      return jsonResponse({
        error: 'This document type cannot be analyzed (presentations, press releases, etc.)',
        document_type: item.document_type,
      }, 400)
    }

    // Create report row — use the caller's company_id (from their peer group) if provided,
    // falling back to the catalog item's company_id. This avoids data isolation failures
    // when catalog items are linked to duplicate company records from other users.
    const effectiveCompanyId = company_id || item.company_id

    const { data: report, error: reportErr } = await adminClient
      .from('reports')
      .insert({
        company_id: effectiveCompanyId,
        report_type: reportType,
        fiscal_year: item.fiscal_year ?? new Date().getFullYear(),
        fiscal_quarter: item.fiscal_quarter,
        source_url: item.document_url,
        title: item.title,
        status: 'pending',
      })
      .select('id')
      .single()

    if (reportErr || !report) {
      return jsonResponse({ error: `Failed to create report: ${reportErr?.message}` }, 500)
    }

    // Link catalog item to report
    await adminClient
      .from('ir_catalog_items')
      .update({
        is_downloaded: true,
        report_id: report.id,
      })
      .eq('id', catalog_item_id)

    // Trigger pipeline-orchestrator asynchronously via pg_net.
    // pg_net sends the HTTP request from Postgres, independent of this function's lifecycle.
    // This avoids the 150s idle timeout that kills long-running synchronous pipeline chains.
    const token = authHeader.replace('Bearer ', '')
    const { error: rpcError } = await adminClient.rpc('fire_edge_function', {
      p_function_name: 'pipeline-orchestrator',
      p_body: { report_id: report.id },
      p_auth_token: token,
    })

    return jsonResponse({
      success: true,
      report_id: report.id,
      catalog_item_id,
      pipeline_triggered: !rpcError,
      pipeline_status: rpcError ? 'failed' : 'started',
    })
  } catch (err) {
    return errorResponse(err)
  }
})
