import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'

/**
 * pipeline-orchestrator — Runs the full analysis pipeline for a report.
 *
 * Supports a `phase` parameter to split work across multiple invocations,
 * avoiding the 150s edge function idle timeout:
 *   phase 1 (default): download + extract-kpis → fires phase 2 via pg_net
 *   phase 2: normalize + extract-report-context + generate-benchmark → fires phase 3 via pg_net
 *   phase 3: generate-insights + update publication events
 */

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  let _reportId: string | null = null
  let _adminClient: any = null
  try {
    const { adminClient } = await authenticateRequest(req)
    _adminClient = adminClient
    const authHeader = req.headers.get('Authorization')!

    const { report_id, phase } = await req.json()
    _reportId = report_id
    if (!report_id) {
      return jsonResponse({ error: 'Missing required field: report_id' }, 400)
    }

    const currentPhase = phase ?? 1
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    if (!supabaseUrl) throw new Error('SUPABASE_URL not set')

    // Load report
    const { data: report, error: reportError } = await adminClient
      .from('reports')
      .select('id, status, pdf_storage_path, source_url')
      .eq('id', report_id)
      .single()

    if (reportError) throw new Error(`Report lookup failed: ${reportError.message}`)
    if (!report) return jsonResponse({ error: `Report not found: ${report_id}` }, 404)

    const steps: { step: string; status: string; duration_ms?: number }[] = []

    // Helper: call an edge function synchronously
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

    // Helper: fire next phase asynchronously via pg_net
    async function fireNextPhase(nextPhase: number): Promise<void> {
      const token = authHeader.replace('Bearer ', '')
      await adminClient.rpc('fire_edge_function', {
        p_function_name: 'pipeline-orchestrator',
        p_body: { report_id, phase: nextPhase },
        p_auth_token: token,
      })
    }

    if (currentPhase === 1) {
      // Phase 1: Download + Extract KPIs

      // Download report (if not already downloaded)
      if (!report.pdf_storage_path && report.source_url) {
        const start = Date.now()
        await callEdgeFunction('download-report', { report_id })
        steps.push({ step: 'download-report', status: 'completed', duration_ms: Date.now() - start })
      } else {
        steps.push({ step: 'download-report', status: 'skipped' })
      }

      // Extract KPIs from the PDF
      {
        const start = Date.now()
        await callEdgeFunction('extract-kpis', { report_id })
        steps.push({ step: 'extract-kpis', status: 'completed', duration_ms: Date.now() - start })
      }

      // Fire phase 2 asynchronously
      await fireNextPhase(2)

      return jsonResponse({ success: true, report_id, phase: 1, steps })

    } else if (currentPhase === 2) {
      // Phase 2: Normalize + Context + Benchmark

      // Normalize KPI values
      await adminClient.from('reports').update({ status: 'normalized' }).eq('id', report_id)
      {
        const start = Date.now()
        await callEdgeFunction('normalize-kpis', { report_id })
        steps.push({ step: 'normalize-kpis', status: 'completed', duration_ms: Date.now() - start })
      }

      // Extract strategic context (non-fatal)
      {
        const start = Date.now()
        try {
          await callEdgeFunction('extract-report-context', { report_id })
          steps.push({ step: 'extract-report-context', status: 'completed', duration_ms: Date.now() - start })
        } catch (err) {
          console.error('extract-report-context failed (non-fatal):', (err as Error).message)
          steps.push({ step: 'extract-report-context', status: 'failed', duration_ms: Date.now() - start })
        }
      }

      // Generate benchmark document
      await adminClient.from('reports').update({ status: 'benchmark_ready' }).eq('id', report_id)
      {
        const start = Date.now()
        await callEdgeFunction('generate-benchmark', { report_id })
        steps.push({ step: 'generate-benchmark', status: 'completed', duration_ms: Date.now() - start })
      }

      // Update report status to reviewed
      await adminClient
        .from('reports')
        .update({ status: 'reviewed' })
        .eq('id', report_id)

      // Fire phase 3 asynchronously (insights + events — non-critical)
      await fireNextPhase(3)

      return jsonResponse({ success: true, report_id, phase: 2, steps })

    } else if (currentPhase === 3) {
      // Phase 3: AI Insights + Publication Events (non-critical)

      // Auto-generate AI Insights
      {
        const start = Date.now()
        try {
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
          console.error('generate-insights auto-trigger failed (non-fatal):', (err as Error).message)
          steps.push({ step: 'generate-insights', status: 'failed', duration_ms: Date.now() - start })
        }
      }

      // Update linked publication event if exists
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

      return jsonResponse({ success: true, report_id, phase: 3, steps })
    }

    return jsonResponse({ error: `Unknown phase: ${currentPhase}` }, 400)
  } catch (err) {
    // Mark report as error so it doesn't stay pending forever
    if (_reportId && _adminClient) {
      try {
        await _adminClient.from('reports').update({ status: 'error' }).eq('id', _reportId)
      } catch { /* best effort cleanup */ }
    }
    return errorResponse(err)
  }
})
