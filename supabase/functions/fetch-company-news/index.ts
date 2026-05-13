/**
 * fetch-company-news — Fetches news for all companies with active sources.
 * Called by cron (every 6h) or manually per company.
 *
 * Modes:
 *   POST { company_id } → fetch for one company
 *   POST { all: true }  → fetch for all companies with due sources (cron)
 *
 * Requires CRON_SECRET header for cron mode.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { authenticateRequest } from '../_shared/auth.ts'
import { logAnthropicUsage } from '../_shared/log-usage.ts'

/** Reject URLs targeting internal/private networks (SSRF prevention) */
function isPublicUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (!['http:', 'https:'].includes(u.protocol)) return false
    const host = u.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return false
    if (host.endsWith('.local') || host.endsWith('.internal')) return false
    if (/^10\./.test(host) || /^192\.168\./.test(host)) return false
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false
    if (host.startsWith('169.254.')) return false
    if (host === '0.0.0.0' || host.startsWith('0.')) return false
    return true
  } catch {
    return false
  }
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// ── RSS Parser (minimal, no deps) ────────────────────────────────────────────

interface RssItem {
  title: string
  url: string
  published_at: string | null
  snippet: string
  source_name: string
}

function parseRssXml(xml: string): RssItem[] {
  const items: RssItem[] = []
  // Match each <item>...</item>
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  let match: RegExpExecArray | null
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]
    const title = extractTag(block, 'title')
    const link = extractTag(block, 'link')
    const pubDate = extractTag(block, 'pubDate')
    const description = extractTag(block, 'description')
    const source = extractTag(block, 'source')
    if (title && link) {
      items.push({
        title: decodeHtmlEntities(title),
        url: link.trim(),
        published_at: pubDate ? new Date(pubDate).toISOString() : null,
        snippet: decodeHtmlEntities(stripHtml(description ?? '').slice(0, 500)),
        source_name: decodeHtmlEntities(source ?? ''),
      })
    }
  }
  return items
}

function extractTag(xml: string, tag: string): string | null {
  // Handle CDATA
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i')
  const cdataMatch = cdataRe.exec(xml)
  if (cdataMatch) return cdataMatch[1]
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i')
  const m = re.exec(xml)
  return m ? m[1] : null
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'").replace(/&#x2F;/g, '/')
}

// ── AI Classification (Claude Haiku — cheap) ────────────────────────────────

interface ClassifiedArticle {
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
  relevance_score: number
  topics: string[]
  ai_summary: string
  is_relevant: boolean
}

async function classifyArticles(
  articles: { title: string; snippet: string }[],
  companyName: string
): Promise<ClassifiedArticle[]> {
  if (!ANTHROPIC_API_KEY || articles.length === 0) {
    return articles.map(() => ({
      sentiment: 'neutral' as const,
      relevance_score: 0.5,
      topics: [],
      ai_summary: '',
      is_relevant: true,
    }))
  }

  // Batch up to 20 articles per call
  const batches: typeof articles[] = []
  for (let i = 0; i < articles.length; i += 20) {
    batches.push(articles.slice(i, i + 20))
  }

  const results: ClassifiedArticle[] = []

  for (const batch of batches) {
    const articlesText = batch
      .map((a, i) => `[${i}] "${a.title}" — ${a.snippet.slice(0, 200)}`)
      .join('\n')

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          temperature: 0,
          system: `Classify news articles about "${companyName}". For each article return a JSON array with objects: {sentiment: "positive"|"negative"|"neutral"|"mixed", relevance_score: 0.0-1.0 (how relevant to the company's business/financials), topics: string[] (from: "earnings", "M&A", "ESG", "restructuring", "legal", "product", "market", "leadership", "regulation", "guidance", "dividend", "credit_rating", "partnership"), ai_summary: string (1 sentence), is_relevant: boolean}. Return ONLY the JSON array, no markdown.`,
          messages: [{ role: 'user', content: articlesText }],
        }),
      })

      if (!resp.ok) {
        console.error('Haiku classification failed:', resp.status)
        results.push(...batch.map(() => ({
          sentiment: 'neutral' as const, relevance_score: 0.5, topics: [], ai_summary: '', is_relevant: true,
        })))
        continue
      }

      const data = await resp.json()
      await logAnthropicUsage('BenchmarkSignal', 'fetch-company-news', data)
      const text = data.content?.[0]?.text ?? '[]'
      // Extract JSON from potential markdown code block
      const jsonStr = text.replace(/```json?\s*/g, '').replace(/```/g, '').trim()
      const classified: ClassifiedArticle[] = JSON.parse(jsonStr)
      results.push(...classified)
    } catch (err) {
      console.error('Classification error:', (err as Error).message)
      results.push(...batch.map(() => ({
        sentiment: 'neutral' as const, relevance_score: 0.5, topics: [], ai_summary: '', is_relevant: true,
      })))
    }
  }

  return results
}

// ── Fetch news for a single source ───────────────────────────────────────────

async function fetchFromSource(
  source: { id: string; source_url: string; source_type: string; source_name: string },
  companyId: string,
  companyName: string
): Promise<number> {
  let items: RssItem[] = []

  try {
    if (!isPublicUrl(source.source_url)) {
      console.warn('Skipping non-public URL:', source.source_url)
      return 0
    }
    const resp = await fetch(source.source_url, {
      headers: { 'User-Agent': 'BenchmarkSignal/1.0 (news aggregator)' },
      signal: AbortSignal.timeout(15000),
    })
    if (!resp.ok) {
      console.error(`Fetch failed for ${source.source_name}: ${resp.status}`)
      return 0
    }
    const xml = await resp.text()
    items = parseRssXml(xml)
  } catch (err) {
    console.error(`Fetch error for ${source.source_name}:`, (err as Error).message)
    return 0
  }

  if (items.length === 0) return 0

  // Deduplicate against existing URLs
  const urls = items.map(i => i.url)
  const { data: existing } = await admin
    .from('company_news')
    .select('url')
    .eq('company_id', companyId)
    .in('url', urls)

  const existingUrls = new Set((existing ?? []).map(e => e.url))
  const newItems = items.filter(i => !existingUrls.has(i.url))

  if (newItems.length === 0) return 0

  // Classify with AI
  const classifications = await classifyArticles(
    newItems.map(i => ({ title: i.title, snippet: i.snippet })),
    companyName
  )

  // Insert
  const rows = newItems.map((item, i) => ({
    company_id: companyId,
    source_id: source.id,
    title: item.title,
    url: item.url,
    published_at: item.published_at,
    snippet: item.snippet,
    language: 'en',
    sentiment: classifications[i]?.sentiment ?? 'neutral',
    relevance_score: classifications[i]?.relevance_score ?? 0.5,
    topics: classifications[i]?.topics ?? [],
    ai_summary: classifications[i]?.ai_summary ?? '',
    is_relevant: classifications[i]?.is_relevant ?? true,
  }))

  const { error } = await admin
    .from('company_news')
    .upsert(rows, { onConflict: 'company_id,url', ignoreDuplicates: true })

  if (error) {
    console.error('Insert error:', error.message)
    return 0
  }

  // Update last_fetched_at
  await admin
    .from('news_sources')
    .update({ last_fetched_at: new Date().toISOString() })
    .eq('id', source.id)

  return newItems.length
}

// ── Auto-create sources for a company ────────────────────────────────────────

async function ensureSourcesExist(companyId: string, companyName: string, ticker?: string) {
  const { data: existing } = await admin
    .from('news_sources')
    .select('id')
    .eq('company_id', companyId)
    .limit(1)

  if (existing && existing.length > 0) return // already has sources

  // Build Google News RSS query: "Company Name" OR "TICKER"
  const parts = [`"${companyName}"`]
  if (ticker) parts.push(`"${ticker}"`)
  const query = parts.join(' OR ')
  const encodedQuery = encodeURIComponent(query)

  const sources = [
    {
      company_id: companyId,
      source_type: 'google_news_rss',
      source_url: `https://news.google.com/rss/search?q=${encodedQuery}&hl=en&gl=US&ceid=US:en`,
      source_name: `Google News — ${companyName}`,
      search_query: query,
      fetch_interval_hours: 6,
    },
  ]

  await admin.from('news_sources').insert(sources)
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 })
  }

  const body = await req.json().catch(() => ({}))

  // Cron mode: fetch all due sources
  if (body.all === true) {
    const cronSecret = req.headers.get('x-cron-secret') ?? ''
    if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    // Get all companies with peer group membership
    const { data: companies } = await admin
      .from('companies')
      .select('id, name, ticker')
      .eq('is_active', true)

    if (!companies || companies.length === 0) {
      return new Response(JSON.stringify({ message: 'No active companies' }), { status: 200 })
    }

    // Ensure sources exist for all companies
    for (const c of companies) {
      await ensureSourcesExist(c.id, c.name, c.ticker)
    }

    // Get all due sources (last_fetched_at is null or past interval)
    const { data: sources } = await admin
      .from('news_sources')
      .select('id, company_id, source_url, source_type, source_name')
      .eq('is_active', true)
      .or(`last_fetched_at.is.null,last_fetched_at.lt.${new Date(Date.now() - 6 * 3600_000).toISOString()}`)

    if (!sources || sources.length === 0) {
      return new Response(JSON.stringify({ message: 'No sources due for fetch' }), { status: 200 })
    }

    // Build company name lookup
    const companyMap = new Map(companies.map(c => [c.id, c.name]))

    let totalNew = 0
    let sourcesProcessed = 0
    for (const source of sources) {
      const companyName = companyMap.get(source.company_id) ?? 'Unknown'
      const count = await fetchFromSource(source, source.company_id, companyName)
      totalNew += count
      sourcesProcessed++
    }

    console.log(`Cron complete: ${sourcesProcessed} sources, ${totalNew} new articles`)
    return new Response(JSON.stringify({ sources_processed: sourcesProcessed, new_articles: totalNew }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Single company mode — requires JWT auth
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
    .select('id, name, ticker')
    .eq('id', companyId)
    .single()

  if (!company) {
    return new Response(JSON.stringify({ error: 'Company not found' }), { status: 404 })
  }

  await ensureSourcesExist(company.id, company.name, company.ticker)

  const { data: sources } = await admin
    .from('news_sources')
    .select('id, company_id, source_url, source_type, source_name')
    .eq('company_id', companyId)
    .eq('is_active', true)

  let totalNew = 0
  for (const source of (sources ?? [])) {
    totalNew += await fetchFromSource(source, companyId, company.name)
  }

  return new Response(JSON.stringify({ company: company.name, new_articles: totalNew }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
