import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { jsonResponse, errorResponse } from '../_shared/auth.ts'

/**
 * monitor-publications — Automated scheduler (time-precise)
 *
 * Called every 2 minutes by GitHub Actions cron.
 * Uses exact expected_date + expected_time for precision monitoring.
 *
 * Smart Monitoring Windows (based on minutes from expected datetime):
 * - > 3 days before → don't check (too early)
 * - 3 days to 1 hour before → check every 6h (safety net)
 * - 1 hour before to 30 min after → check every 2 min (HOT WINDOW)
 * - 30 min to 4 hours after → check every 5 min
 * - 4 to 24 hours after → check every 30 min
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
  expected_time: string | null
  status: string
  last_checked_at: string | null
}

/**
 * Returns the expected publication datetime as a Date object.
 * Combines expected_date + expected_time. If no time, defaults to 07:00 (common publication time).
 */
function getExpectedDatetime(event: PublicationEvent): Date {
  const date = event.expected_date
  const time = event.expected_time ?? '07:00:00'
  return new Date(`${date}T${time}`)
}

/**
 * Returns the required interval (in minutes) between checks based on
 * how many minutes until/since the expected publication datetime.
 */
function getMonitoringInterval(minutesFromExpected: number): number | null {
  // minutesFromExpected: negative = before, positive = after expected time
  const THREE_DAYS = 3 * 24 * 60
  const ONE_HOUR = 60
  const THIRTY_MIN = 30
  const FOUR_HOURS = 4 * 60
  const ONE_DAY = 24 * 60
  const SEVEN_DAYS = 7 * 24 * 60
  const THIRTY_DAYS = 30 * 24 * 60

  if (minutesFromExpected < -THREE_DAYS) return null // too early
  if (minutesFromExpected < -ONE_HOUR) return 6 * 60 // 3d to 1h before: every 6h
  if (minutesFromExpected <= THIRTY_MIN) return 2 // HOT WINDOW: every 2 minutes
  if (minutesFromExpected <= FOUR_HOURS) return 5 // 30min to 4h after: every 5 min
  if (minutesFromExpected <= ONE_DAY) return 30 // 4h to 24h after: every 30 min
  if (minutesFromExpected <= SEVEN_DAYS) return 2 * 60 // 1-7 days overdue: 2h
  if (minutesFromExpected <= THIRTY_DAYS) return 12 * 60 // 8-30 days: 12h
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
      .select('id, expected_date, expected_time, status, last_checked_at')
      .in('status', ['scheduled', 'due_today', 'overdue'])

    if (eventsError) throw new Error(`Events query failed: ${eventsError.message}`)
    if (!events || events.length === 0) {
      return jsonResponse({ message: 'No active events to monitor', checked: 0 })
    }

    const results: { event_id: string; action: string; detail?: string }[] = []

    for (const event of events as PublicationEvent[]) {
      const expectedDatetime = getExpectedDatetime(event)
      const now = Date.now()
      const minutesFromExpected = (now - expectedDatetime.getTime()) / 60_000
      const daysFromExpected = minutesFromExpected / (24 * 60)

      // ------------------------------------------------------------------
      // 2. Auto-manage statuses
      // ------------------------------------------------------------------
      if (daysFromExpected > 30) {
        await adminClient
          .from('publication_events')
          .update({ status: 'stale' })
          .eq('id', event.id)
        results.push({ event_id: event.id, action: 'marked_stale' })
        continue
      }

      // Same day as expected and within ±12h of expected time
      if (Math.abs(minutesFromExpected) <= 12 * 60 && event.status === 'scheduled') {
        await adminClient
          .from('publication_events')
          .update({ status: 'due_today' })
          .eq('id', event.id)
        results.push({ event_id: event.id, action: 'status_update', detail: 'due_today' })
      } else if (minutesFromExpected > 24 * 60 && event.status !== 'overdue') {
        // More than 24h past expected time → overdue
        await adminClient
          .from('publication_events')
          .update({ status: 'overdue' })
          .eq('id', event.id)
        results.push({ event_id: event.id, action: 'status_update', detail: 'overdue' })
      }

      // ------------------------------------------------------------------
      // 3. Determine if we should check now (time-precise)
      // ------------------------------------------------------------------
      const interval = getMonitoringInterval(minutesFromExpected)
      if (interval === null) {
        results.push({ event_id: event.id, action: 'skipped', detail: 'outside_window' })
        continue
      }

      const minutesSinceLastCheck = minutesSince(event.last_checked_at)
      if (minutesSinceLastCheck < interval) {
        results.push({ event_id: event.id, action: 'skipped', detail: `too_recent (interval=${interval}min)` })
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
