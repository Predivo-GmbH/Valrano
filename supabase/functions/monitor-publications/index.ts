import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { jsonResponse, errorResponse } from '../_shared/auth.ts'

/**
 * monitor-publications — Automated scheduler
 *
 * Called periodically by GitHub Actions cron.
 * Queries publication_events in their monitoring window and triggers
 * check-publication for each one.
 *
 * Smart Monitoring Windows:
 * - 3 days before expected_date → check every 6h
 * - On expected_date → check every 30min
 * - 1-7 days overdue → check every 2h
 * - 8-30 days overdue → check every 12h
 * - >30 days overdue → mark stale, stop checking
 *
 * Also auto-manages event statuses: due_today, overdue.
 *
 * Auth: Uses service role key (no user JWT needed for cron).
 */

interface PublicationEvent {
  id: string
  expected_date: string
  status: string
  last_checked_at: string | null
}

function getMonitoringInterval(daysFromExpected: number): number | null {
  // daysFromExpected: negative = before, 0 = today, positive = overdue
  if (daysFromExpected < -3) return null // too early
  if (daysFromExpected <= -1) return 6 * 60 // 3 days before: 6h in minutes
  if (daysFromExpected === 0) return 30 // on day: 30min
  if (daysFromExpected <= 7) return 2 * 60 // 1-7 days overdue: 2h
  if (daysFromExpected <= 30) return 12 * 60 // 8-30 days: 12h
  return null // >30 days: stale
}

function minutesSince(dateStr: string | null): number {
  if (!dateStr) return Infinity
  return (Date.now() - new Date(dateStr).getTime()) / 60_000
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const sbUrl = Deno.env.get('SUPABASE_URL')
    const sbServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!sbUrl || !sbServiceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    }

    // Validate cron secret (prevents unauthorized invocation)
    const cronSecret = Deno.env.get('CRON_SECRET')
    if (cronSecret) {
      const providedSecret = req.headers.get('x-cron-secret')
      if (providedSecret !== cronSecret) {
        return jsonResponse({ error: 'Unauthorized' }, 401)
      }
    }

    const adminClient = createClient(sbUrl, sbServiceKey)
    const today = new Date().toISOString().split('T')[0]

    // ------------------------------------------------------------------
    // 1. Load all active publication events (scheduled, due_today, overdue)
    // ------------------------------------------------------------------
    const { data: events, error: eventsError } = await adminClient
      .from('publication_events')
      .select('id, expected_date, status, last_checked_at')
      .in('status', ['scheduled', 'due_today', 'overdue'])

    if (eventsError) throw new Error(`Events query failed: ${eventsError.message}`)
    if (!events || events.length === 0) {
      return jsonResponse({ message: 'No active events to monitor', checked: 0 })
    }

    const results: { event_id: string; action: string; detail?: string }[] = []

    for (const event of events as PublicationEvent[]) {
      const expectedDate = new Date(event.expected_date)
      const todayDate = new Date(today)
      const daysFromExpected = Math.round(
        (todayDate.getTime() - expectedDate.getTime()) / 86_400_000
      )

      // ------------------------------------------------------------------
      // 2. Auto-manage statuses
      // ------------------------------------------------------------------
      if (daysFromExpected > 30 && event.status !== 'stale') {
        await adminClient
          .from('publication_events')
          .update({ status: 'stale' })
          .eq('id', event.id)
        results.push({ event_id: event.id, action: 'marked_stale' })
        continue
      }

      if (daysFromExpected === 0 && event.status === 'scheduled') {
        await adminClient
          .from('publication_events')
          .update({ status: 'due_today' })
          .eq('id', event.id)
        results.push({ event_id: event.id, action: 'status_update', detail: 'due_today' })
      } else if (daysFromExpected > 0 && event.status !== 'overdue') {
        await adminClient
          .from('publication_events')
          .update({ status: 'overdue' })
          .eq('id', event.id)
        results.push({ event_id: event.id, action: 'status_update', detail: 'overdue' })
      }

      // ------------------------------------------------------------------
      // 3. Determine if we should check now
      // ------------------------------------------------------------------
      const interval = getMonitoringInterval(daysFromExpected)
      if (interval === null) {
        results.push({ event_id: event.id, action: 'skipped', detail: 'outside_window' })
        continue
      }

      const minutesSinceLastCheck = minutesSince(event.last_checked_at)
      if (minutesSinceLastCheck < interval) {
        results.push({ event_id: event.id, action: 'skipped', detail: 'too_recent' })
        continue
      }

      // ------------------------------------------------------------------
      // 4. Trigger check-publication
      // ------------------------------------------------------------------
      try {
        const checkUrl = `${sbUrl}/functions/v1/check-publication`
        const resp = await fetch(checkUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sbServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ publication_event_id: event.id }),
        })

        const checkResult = await resp.json()

        // Update last_checked_at
        await adminClient
          .from('publication_events')
          .update({ last_checked_at: new Date().toISOString() })
          .eq('id', event.id)

        if (checkResult.detected) {
          results.push({ event_id: event.id, action: 'detected', detail: checkResult.found_url })

          // Auto-trigger pipeline if report was created
          if (checkResult.report_id) {
            const pipelineUrl = `${sbUrl}/functions/v1/pipeline-orchestrator`
            await fetch(pipelineUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${sbServiceKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ report_id: checkResult.report_id }),
            })
            results.push({ event_id: event.id, action: 'pipeline_triggered', detail: checkResult.report_id })
          }
        } else {
          results.push({ event_id: event.id, action: 'checked', detail: 'not_found' })
        }
      } catch (checkErr) {
        results.push({
          event_id: event.id,
          action: 'check_error',
          detail: (checkErr as Error).message,
        })
      }
    }

    return jsonResponse({
      success: true,
      total_events: events.length,
      checked: results.filter(r => r.action === 'checked' || r.action === 'detected').length,
      detected: results.filter(r => r.action === 'detected').length,
      results,
    })
  } catch (err) {
    return errorResponse(err)
  }
})
