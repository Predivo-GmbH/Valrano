import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { getCorsHeaders } from '../_shared/cors.ts'
import { errorResponse, jsonResponse } from '../_shared/auth.ts'
import { sendEmail } from '../_shared/email.ts'

/**
 * Monthly AI Insights Digest
 * Called by GitHub Actions cron (1st of each month).
 * For each user with insights generated in the past 30 days,
 * sends an email summary of top changes (delta labels).
 *
 * Auth: x-cron-secret header (same pattern as monitor-publications).
 */

const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const APP_URL = Deno.env.get('APP_URL') ?? 'https://valrano.com'

const FONT = "'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,'Helvetica Neue',Arial,sans-serif"
const ACCENT = '#3B82F6'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    // Authenticate via cron secret
    const cronSecret = req.headers.get('x-cron-secret')
    if (!cronSecret || cronSecret !== CRON_SECRET) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // Find all users who had insights generated in the last 30 days
    const { data: recentLogs } = await adminClient
      .from('ai_insight_auto_gen_log')
      .select('user_id')
      .gte('created_at', thirtyDaysAgo)

    if (!recentLogs || recentLogs.length === 0) {
      return jsonResponse({ message: 'No users with recent insights', emails_sent: 0 })
    }

    const userIds = [...new Set(recentLogs.map((l: any) => l.user_id))]
    let emailsSent = 0

    for (const userId of userIds) {
      // Get user email
      const { data: userData } = await adminClient.auth.admin.getUserById(userId)
      if (!userData?.user?.email) continue

      // Get recent insights with delta labels
      const { data: insights } = await adminClient
        .from('ai_insights')
        .select('insight_type, title, body, priority, delta_label, data_confidence, created_at')
        .eq('user_id', userId)
        .eq('is_dismissed', false)
        .gte('created_at', thirtyDaysAgo)
        .order('priority', { ascending: false })
        .limit(10)

      if (!insights || insights.length === 0) continue

      // Count deltas
      const newCount = insights.filter((i: any) => i.delta_label === 'new').length
      const worsenedCount = insights.filter((i: any) => i.delta_label === 'worsened').length
      const improvedCount = insights.filter((i: any) => i.delta_label === 'improved').length
      const riskCount = insights.filter((i: any) => i.insight_type === 'risk_flag' && i.priority === 'high').length

      // Build email HTML
      const insightRows = insights.slice(0, 5).map((i: any) => {
        const deltaColor = i.delta_label === 'new' ? '#3B82F6'
          : i.delta_label === 'worsened' ? '#EF4444'
          : i.delta_label === 'improved' ? '#22C55E'
          : '#A1A1AA'
        const deltaText = i.delta_label ? i.delta_label.toUpperCase() : ''
        const typeEmoji = i.insight_type === 'risk_flag' ? '&#9888;'
          : i.insight_type === 'opportunity' ? '&#9889;'
          : i.insight_type === 'trend_reversal' ? '&#8634;'
          : '&#8226;'

        return [
          '<tr>',
          `<td style="padding:12px 0;border-bottom:1px solid #f4f4f5;font-family:${FONT};">`,
          `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">`,
          deltaText ? `<span style="font-size:10px;font-weight:700;color:${deltaColor};background:${deltaColor}11;padding:2px 6px;border-radius:4px;">${deltaText}</span>` : '',
          `<span style="font-size:10px;color:#71717a;text-transform:uppercase;">${typeEmoji} ${i.insight_type?.replace('_', ' ') ?? ''}</span>`,
          `</div>`,
          `<p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#18181b;">${i.title}</p>`,
          `<p style="margin:0;font-size:13px;color:#3f3f46;line-height:1.5;">${i.body.length > 150 ? i.body.slice(0, 150) + '...' : i.body}</p>`,
          '</td>',
          '</tr>',
        ].join('')
      }).join('')

      const summaryParts = []
      if (newCount > 0) summaryParts.push(`<span style="color:#3B82F6;font-weight:600;">${newCount} new</span>`)
      if (worsenedCount > 0) summaryParts.push(`<span style="color:#EF4444;font-weight:600;">${worsenedCount} worsened</span>`)
      if (improvedCount > 0) summaryParts.push(`<span style="color:#22C55E;font-weight:600;">${improvedCount} improved</span>`)
      if (riskCount > 0) summaryParts.push(`<span style="color:#EF4444;font-weight:600;">${riskCount} high-priority risks</span>`)

      const html = [
        '<!DOCTYPE html>',
        '<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>',
        `<body style="margin:0;padding:0;font-family:${FONT};background-color:#f4f4f5;">`,
        '<table role="presentation" width="100%" style="background-color:#f4f4f5;"><tr><td align="center" style="padding:40px 16px;">',
        '<table role="presentation" width="480" style="max-width:480px;width:100%;">',
        `<tr><td align="center" style="padding-bottom:28px;"><span style="font-family:${FONT};font-size:20px;font-weight:700;color:#18181b;">Valrano</span></td></tr>`,
        '<tr><td style="background-color:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:36px 32px;">',
        `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;">Monthly Insights Digest</h1>`,
        `<p style="margin:0 0 16px;font-size:13px;color:#71717a;">${new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>`,
        summaryParts.length > 0 ? `<p style="margin:0 0 20px;font-size:14px;color:#3f3f46;line-height:1.6;">This month: ${summaryParts.join(' &middot; ')}</p>` : '',
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">',
        insightRows,
        '</table>',
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:24px auto 0;">`,
        `<tr><td align="center" bgcolor="${ACCENT}" style="background-color:${ACCENT};border-radius:8px;">`,
        `<a href="${APP_URL}/dashboard" target="_blank" style="display:inline-block;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;padding:14px 40px;">View All Insights</a>`,
        '</td></tr></table>',
        '</td></tr>',
        `<tr><td align="center" style="padding-top:24px;"><p style="font-size:12px;color:#a1a1aa;">&copy; ${new Date().getFullYear()} Valrano by Predivo GmbH. All rights reserved.</p><p style="font-size:11px;color:#a1a1aa;margin-top:6px;">Swiss-made &middot; Software that Thinks Ahead</p></td></tr>`,
        '</table></td></tr></table></body></html>',
      ].join('\n')

      await sendEmail({
        to: userData.user.email,
        subject: `Valrano — Monthly Insights Digest${riskCount > 0 ? ` (${riskCount} risk alerts)` : ''}`,
        html,
      })

      emailsSent++
    }

    return jsonResponse({ message: 'Digest complete', emails_sent: emailsSent, users_checked: userIds.length })
  } catch (err) {
    return errorResponse(err)
  }
})
