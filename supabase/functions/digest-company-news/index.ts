/**
 * digest-company-news — AI-summarizes recent news into weekly/monthly digests.
 * Called by cron (weekly on Sundays) or manually.
 *
 * POST { company_id, digest_type?: 'weekly'|'monthly' } → one company
 * POST { all: true } → all companies with recent news (cron mode)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { authenticateRequest } from '../_shared/auth.ts'
import { logAnthropicUsage } from '../_shared/log-usage.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

interface DigestResult {
  summary: string
  key_events: { date: string; title: string; impact: string; category: string }[]
  sentiment_trend: 'improving' | 'stable' | 'deteriorating' | 'mixed'
}

async function generateDigest(
  companyName: string,
  articles: { title: string; published_at: string | null; ai_summary: string | null; sentiment: string | null; topics: string[] }[],
  periodStart: string,
  periodEnd: string,
): Promise<DigestResult> {
  const articleList = articles
    .map((a, i) => `[${i + 1}] ${a.published_at?.slice(0, 10) ?? '?'} | ${a.sentiment ?? '?'} | ${a.title}${a.ai_summary ? ` — ${a.ai_summary}` : ''}`)
    .join('\n')

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6-20250514',
      max_tokens: 2000,
      temperature: 0,
      system: `You are a financial news analyst creating a digest for "${companyName}" covering ${periodStart} to ${periodEnd}. Return ONLY valid JSON with: {summary: string (2-4 sentence narrative overview of key developments), key_events: [{date: "YYYY-MM-DD", title: string, impact: "high"|"medium"|"low", category: string}], sentiment_trend: "improving"|"stable"|"deteriorating"|"mixed"}. No markdown.`,
      messages: [{ role: 'user', content: `Here are ${articles.length} news articles:\n\n${articleList}` }],
    }),
  })

  if (!resp.ok) {
    console.error('Digest generation failed:', resp.status)
    return { summary: 'Digest generation failed.', key_events: [], sentiment_trend: 'stable' }
  }

  const data = await resp.json()
  await logAnthropicUsage('BenchmarkSignal', 'digest-company-news', data)
  const text = data.content?.[0]?.text ?? '{}'
  const jsonStr = text.replace(/```json?\s*/g, '').replace(/```/g, '').trim()
  return JSON.parse(jsonStr) as DigestResult
}

async function createDigestForCompany(
  companyId: string,
  companyName: string,
  digestType: 'weekly' | 'monthly' = 'weekly'
): Promise<boolean> {
  const now = new Date()
  let periodStart: Date
  if (digestType === 'weekly') {
    periodStart = new Date(now)
    periodStart.setDate(now.getDate() - 7)
  } else {
    periodStart = new Date(now)
    periodStart.setMonth(now.getMonth() - 1)
  }

  const startStr = periodStart.toISOString().slice(0, 10)
  const endStr = now.toISOString().slice(0, 10)

  // Check if digest already exists
  const { data: existing } = await admin
    .from('news_digests')
    .select('id')
    .eq('company_id', companyId)
    .eq('digest_type', digestType)
    .eq('period_start', startStr)
    .limit(1)

  if (existing && existing.length > 0) return false // already exists

  // Get articles for the period
  const { data: articles } = await admin
    .from('company_news')
    .select('title, published_at, ai_summary, sentiment, topics')
    .eq('company_id', companyId)
    .eq('is_relevant', true)
    .gte('published_at', periodStart.toISOString())
    .lte('published_at', now.toISOString())
    .order('published_at', { ascending: true })

  if (!articles || articles.length < 2) return false // not enough articles

  const result = await generateDigest(companyName, articles, startStr, endStr)

  const { error } = await admin
    .from('news_digests')
    .insert({
      company_id: companyId,
      period_start: startStr,
      period_end: endStr,
      digest_type: digestType,
      summary: result.summary,
      key_events: result.key_events,
      sentiment_trend: result.sentiment_trend,
      article_count: articles.length,
      ai_model_used: 'claude-sonnet-4-6',
    })

  if (error) {
    console.error(`Digest insert error for ${companyName}:`, error.message)
    return false
  }

  return true
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 })
  }

  const body = await req.json().catch(() => ({}))

  // Cron mode
  if (body.all === true) {
    const cronSecret = req.headers.get('x-cron-secret') ?? ''
    if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const { data: companies } = await admin
      .from('companies')
      .select('id, name')
      .eq('is_active', true)

    let created = 0
    for (const c of companies ?? []) {
      const ok = await createDigestForCompany(c.id, c.name, 'weekly')
      if (ok) created++
    }

    return new Response(JSON.stringify({ digests_created: created }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Single company — requires JWT auth
  try {
    await authenticateRequest(req)
  } catch {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const companyId = body.company_id as string
  if (!companyId) {
    return new Response(JSON.stringify({ error: 'company_id required' }), { status: 400 })
  }

  const { data: company } = await admin
    .from('companies')
    .select('id, name')
    .eq('id', companyId)
    .single()

  if (!company) {
    return new Response(JSON.stringify({ error: 'Company not found' }), { status: 404 })
  }

  const ok = await createDigestForCompany(company.id, company.name, body.digest_type ?? 'weekly')

  return new Response(JSON.stringify({ company: company.name, created: ok }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
