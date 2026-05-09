import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { adminClient } = await authenticateRequest(req)
    const authHeader = req.headers.get('Authorization')!

    const { report_id } = await req.json()
    if (!report_id) {
      return jsonResponse({ error: 'Missing required field: report_id' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    if (!supabaseUrl) throw new Error('SUPABASE_URL not set')

    // 1. Load report
    const { data: report, error: reportError } = await adminClient
      .from('reports')
      .select('id, status, pdf_storage_path, source_url')
      .eq('id', report_id)
      .single()

    if (reportError) throw new Error(`Report lookup failed: ${reportError.message}`)
    if (!report) return jsonResponse({ error: `Report not found: ${report_id}` }, 404)

    const steps: { step: string; status: string; duration_ms?: number }[] = []

    // Helper: call an edge function
    async function callEdgeFunction(fnName: string, body: Record<string, unknown>): Promise<Response> {
      const url = `${supabaseUrl}/functions/v1/${fnName}`
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      if (!resp.ok) {
        const errText = await resp.text()
        throw new Error(`${fnName} failed (${resp.status}): ${errText}`)
      }
      return resp
    }

    // 2. Download report (if not already downloaded)
    if (!report.pdf_storage_path && report.source_url) {
      const start = Date.now()
      await callEdgeFunction('download-report', { report_id })
      steps.push({ step: 'download-report', status: 'completed', duration_ms: Date.now() - start })
    } else {
      steps.push({ step: 'download-report', status: 'skipped' })
    }

    // 3. Extract KPIs from the PDF
    {
      const start = Date.now()
      await callEdgeFunction('extract-kpis', { report_id })
      steps.push({ step: 'extract-kpis', status: 'completed', duration_ms: Date.now() - start })
    }

    // 4. Normalize KPI values (currency conversion to CHF)
    {
      const start = Date.now()
      await callEdgeFunction('normalize-kpis', { report_id })
      steps.push({ step: 'normalize-kpis', status: 'completed', duration_ms: Date.now() - start })
    }

    // 4b. Extract strategic context + segment breakdowns (parallel-safe, non-blocking)
    {
      const start = Date.now()
      try {
        await callEdgeFunction('extract-report-context', { report_id })
        steps.push({ step: 'extract-report-context', status: 'completed', duration_ms: Date.now() - start })
      } catch (err) {
        // Non-fatal — benchmark can still generate without context
        console.error('extract-report-context failed (non-fatal):', (err as Error).message)
        steps.push({ step: 'extract-report-context', status: 'failed', duration_ms: Date.now() - start })
      }
    }

    // 5. Generate benchmark document
    {
      const start = Date.now()
      await callEdgeFunction('generate-benchmark', { report_id })
      steps.push({ step: 'generate-benchmark', status: 'completed', duration_ms: Date.now() - start })
    }

    // 6. Update report status
    await adminClient
      .from('reports')
      .update({ status: 'reviewed' })
      .eq('id', report_id)

    // 6b. Auto-generate AI Insights after new KPI data is available
    {
      const start = Date.now()
      try {
        // Check if user had a recent auto-gen (within last hour) to avoid spam
        const { data: recentGen } = await adminClient
          .from('ai_insight_auto_gen_log')
          .select('id')
          .eq('user_id', (await adminClient.auth.getUser()).data.user?.id ?? '')
          .eq('triggered_by', 'upload')
          .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
          .limit(1)

        if (!recentGen || recentGen.length === 0) {
          await callEdgeFunction('generate-insights', {
            auto_generated: true,
            triggered_by: 'upload',
          })
          steps.push({ step: 'generate-insights', status: 'completed', duration_ms: Date.now() - start })
        } else {
          steps.push({ step: 'generate-insights', status: 'skipped' })
        }
      } catch (err) {
        // Non-fatal — insights are supplementary
        console.error('generate-insights auto-trigger failed (non-fatal):', (err as Error).message)
        steps.push({ step: 'generate-insights', status: 'failed', duration_ms: Date.now() - start })
      }
    }

    // 7. Update linked publication event if exists
    const { data: events } = await adminClient
      .from('publication_events')
      .select('id')
      .eq('report_id', report_id)
      .limit(1)

    if (events && events.length > 0) {
      await adminClient
        .from('publication_events')
        .update({ status: 'benchmark_ready' })
        .eq('id', events[0].id)
    }

    return jsonResponse({
      success: true,
      report_id,
      pipeline_status: 'benchmark_ready',
      steps,
    })
  } catch (err) {
    return errorResponse(err)
  }
})
