import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { logAnthropicUsage } from '../_shared/log-usage.ts'

/**
 * enrich-company — Auto-fetch ticker, exchange, sector from company name
 *
 * 1. Tries Wikidata SPARQL for structured ticker/exchange data (free)
 * 2. Falls back to Gemini 2.5 Flash for any missing fields
 * 3. Returns { ticker, exchange, sector } without persisting
 *
 * POST { name: string, wikidata_id?: string }
 * Returns { ticker, exchange, sector, confidence, source }
 */

const GEMINI_MODEL = 'gemini-2.5-flash'

const SECTOR_OPTIONS = [
  'Construction & Materials',
  'Industrials',
  'Technology',
  'Healthcare',
  'Financial Services',
  'Consumer Goods',
  'Energy',
  'Utilities',
  'Real Estate',
  'Telecommunications',
  'Other',
] as const

const EXCHANGE_OPTIONS = ['NYSE', 'NASDAQ', 'LSE', 'SIX', 'XETRA', 'Euronext', 'Other'] as const

interface EnrichResult {
  ticker: string | null
  exchange: string | null
  sector: string | null
  confidence: number
  source: 'wikidata' | 'gemini' | 'combined'
}

// ---------------------------------------------------------------------------
// Wikidata SPARQL — free structured data for listed companies
// ---------------------------------------------------------------------------

const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql'

interface WikidataBinding {
  ticker?: { value: string }
  exchangeLabel?: { value: string }
  industryLabel?: { value: string }
}

async function queryWikidata(companyName: string, wikidataId?: string): Promise<{
  ticker: string | null
  exchange: string | null
  industry: string | null
}> {
  // Build SPARQL query — use QID if available, else search by label
  let sparql: string
  if (wikidataId && /^Q\d+$/.test(wikidataId)) {
    sparql = `
      SELECT ?ticker ?exchangeLabel ?industryLabel WHERE {
        OPTIONAL { wd:${wikidataId} wdt:P249 ?ticker. }
        OPTIONAL { wd:${wikidataId} wdt:P414 ?exchange. ?exchange rdfs:label ?exchangeLabel. FILTER(LANG(?exchangeLabel) = "en") }
        OPTIONAL { wd:${wikidataId} wdt:P452 ?industry. ?industry rdfs:label ?industryLabel. FILTER(LANG(?industryLabel) = "en") }
      } LIMIT 1
    `
  } else {
    sparql = `
      SELECT ?ticker ?exchangeLabel ?industryLabel WHERE {
        ?company rdfs:label "${companyName.replace(/"/g, '\\"')}"@en.
        ?company wdt:P31/wdt:P279* wd:Q4830453.
        OPTIONAL { ?company wdt:P249 ?ticker. }
        OPTIONAL { ?company wdt:P414 ?exchange. ?exchange rdfs:label ?exchangeLabel. FILTER(LANG(?exchangeLabel) = "en") }
        OPTIONAL { ?company wdt:P452 ?industry. ?industry rdfs:label ?industryLabel. FILTER(LANG(?industryLabel) = "en") }
      } LIMIT 1
    `
  }

  try {
    const params = new URLSearchParams({ query: sparql, format: 'json' })
    const res = await fetch(`${WIKIDATA_SPARQL}?${params}`, {
      headers: { 'Accept': 'application/sparql-results+json', 'User-Agent': 'Valrano/1.0' },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return { ticker: null, exchange: null, industry: null }

    const data = await res.json()
    const bindings = (data.results?.bindings ?? []) as WikidataBinding[]
    if (bindings.length === 0) return { ticker: null, exchange: null, industry: null }

    const b = bindings[0]
    return {
      ticker: b.ticker?.value ?? null,
      exchange: b.exchangeLabel?.value ?? null,
      industry: b.industryLabel?.value ?? null,
    }
  } catch (err) {
    console.warn('[enrich-company] Wikidata SPARQL error:', (err as Error).message)
    return { ticker: null, exchange: null, industry: null }
  }
}

// ---------------------------------------------------------------------------
// Map exchange names to our UI options
// ---------------------------------------------------------------------------

const EXCHANGE_MAP: Record<string, string> = {
  'new york stock exchange': 'NYSE',
  'nyse': 'NYSE',
  'nasdaq': 'NASDAQ',
  'london stock exchange': 'LSE',
  'lse': 'LSE',
  'six swiss exchange': 'SIX',
  'six': 'SIX',
  'bx swiss': 'SIX',
  'scoach': 'SIX',
  'frankfurt stock exchange': 'XETRA',
  'xetra': 'XETRA',
  'deutsche börse': 'XETRA',
  'euronext': 'Euronext',
  'euronext paris': 'Euronext',
  'euronext amsterdam': 'Euronext',
  'euronext brussels': 'Euronext',
  'euronext lisbon': 'Euronext',
  'toronto stock exchange': 'Other',
  'tokyo stock exchange': 'Other',
  'hong kong stock exchange': 'Other',
  'shanghai stock exchange': 'Other',
  'australian securities exchange': 'Other',
}

function normalizeExchange(raw: string | null): string | null {
  if (!raw) return null
  const lower = raw.toLowerCase().trim()
  return EXCHANGE_MAP[lower] ?? 'Other'
}

// ---------------------------------------------------------------------------
// Map Wikidata industry labels to our sector options
// ---------------------------------------------------------------------------

const SECTOR_MAP: Record<string, string> = {
  'construction': 'Construction & Materials',
  'building materials': 'Construction & Materials',
  'cement': 'Construction & Materials',
  'concrete': 'Construction & Materials',
  'manufacturing': 'Industrials',
  'industrial': 'Industrials',
  'engineering': 'Industrials',
  'automotive': 'Industrials',
  'aerospace': 'Industrials',
  'technology': 'Technology',
  'software': 'Technology',
  'information technology': 'Technology',
  'electronics': 'Technology',
  'semiconductor': 'Technology',
  'pharmaceutical': 'Healthcare',
  'healthcare': 'Healthcare',
  'biotechnology': 'Healthcare',
  'medical': 'Healthcare',
  'banking': 'Financial Services',
  'financial': 'Financial Services',
  'insurance': 'Financial Services',
  'investment': 'Financial Services',
  'asset management': 'Financial Services',
  'food': 'Consumer Goods',
  'beverage': 'Consumer Goods',
  'consumer': 'Consumer Goods',
  'retail': 'Consumer Goods',
  'luxury': 'Consumer Goods',
  'cosmetics': 'Consumer Goods',
  'energy': 'Energy',
  'oil': 'Energy',
  'gas': 'Energy',
  'petroleum': 'Energy',
  'mining': 'Energy',
  'electric utility': 'Utilities',
  'utility': 'Utilities',
  'water': 'Utilities',
  'power': 'Utilities',
  'real estate': 'Real Estate',
  'property': 'Real Estate',
  'telecommunications': 'Telecommunications',
  'telecom': 'Telecommunications',
  'media': 'Telecommunications',
}

function normalizeSector(raw: string | null): string | null {
  if (!raw) return null
  const lower = raw.toLowerCase().trim()
  for (const [keyword, sector] of Object.entries(SECTOR_MAP)) {
    if (lower.includes(keyword)) return sector
  }
  return 'Other'
}

// ---------------------------------------------------------------------------
// Gemini fallback for missing fields
// ---------------------------------------------------------------------------

const ENRICH_SCHEMA = {
  type: 'object',
  properties: {
    ticker: {
      type: 'string',
      description: 'Stock ticker symbol (e.g. "AAPL", "HOLN", "SIE"). Empty string if not publicly listed.',
    },
    exchange: {
      type: 'string',
      enum: [...EXCHANGE_OPTIONS],
      description: 'Stock exchange where the company is listed.',
    },
    sector: {
      type: 'string',
      enum: [...SECTOR_OPTIONS],
      description: 'Primary business sector of the company.',
    },
    is_public: {
      type: 'boolean',
      description: 'Whether the company is publicly traded on a stock exchange.',
    },
    ir_page_url: {
      type: 'string',
      description: 'Investor relations page URL (e.g. "https://www.holcim.com/investors"). Empty string if unknown or private company.',
    },
    confidence: {
      type: 'number',
      description: 'Overall confidence 0-1.',
    },
  },
  required: ['ticker', 'exchange', 'sector', 'is_public', 'ir_page_url', 'confidence'],
} as const

async function enrichWithGemini(
  companyName: string,
  partialData: { ticker?: string | null; exchange?: string | null; sector?: string | null },
): Promise<{ ticker: string | null; exchange: string | null; sector: string | null; ir_url: string | null; confidence: number } | null> {
  const geminiApiKey = Deno.env.get('GOOGLE_AI_API_KEY')
  if (!geminiApiKey) return null

  const knownFields: string[] = []
  if (partialData.ticker) knownFields.push(`Known ticker: ${partialData.ticker}`)
  if (partialData.exchange) knownFields.push(`Known exchange: ${partialData.exchange}`)
  if (partialData.sector) knownFields.push(`Known sector: ${partialData.sector}`)

  const prompt = `Company: "${companyName}"
${knownFields.length ? knownFields.join('\n') : 'No data available yet.'}

Identify or confirm the stock ticker, exchange, business sector, and investor relations page URL for this company.

Rules:
- If the company is not publicly traded, set ticker to empty string and is_public to false
- For exchange, use one of: ${EXCHANGE_OPTIONS.join(', ')}
- For sector, use one of: ${SECTOR_OPTIONS.join(', ')}
- Be precise with tickers (e.g. Holcim = "HOLN", not "HLN")
- Swiss companies are typically on SIX
- For ir_page_url, provide the main investor relations landing page (e.g. https://www.holcim.com/investors). Empty string if unknown.`

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          systemInstruction: {
            parts: [{
              text: 'You are a financial data expert. Return accurate stock ticker, exchange, and sector information for companies. Be precise and conservative — only return data you are confident about.',
            }],
          },
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: ENRICH_SCHEMA,
            temperature: 0,
          },
        }),
        signal: AbortSignal.timeout(10000),
      },
    )

    if (!resp.ok) {
      console.warn(`[enrich-company] Gemini error: ${resp.status}`)
      return null
    }

    const json = await resp.json()
    const inputTokens = json.usageMetadata?.promptTokenCount ?? 0
    const outputTokens = json.usageMetadata?.candidatesTokenCount ?? 0

    await logAnthropicUsage('Valrano', 'enrich-company', {
      model: GEMINI_MODEL,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    })

    const text = json.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return null

    const result = JSON.parse(text) as {
      ticker: string
      exchange: string
      sector: string
      is_public: boolean
      ir_page_url: string
      confidence: number
    }

    return {
      ticker: result.is_public && result.ticker ? result.ticker : null,
      exchange: result.is_public && result.exchange ? result.exchange : null,
      sector: result.sector || null,
      ir_url: result.ir_page_url || null,
      confidence: result.confidence ?? 0.5,
    }
  } catch (err) {
    console.error('[enrich-company] Gemini error:', (err as Error).message)
    return null
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    await authenticateRequest(req)

    const { name, wikidata_id } = await req.json() as { name: string; wikidata_id?: string }
    if (!name || name.trim().length < 2) {
      return jsonResponse({ error: 'Company name is required (min 2 chars)' }, 400)
    }

    const companyName = name.trim()

    // Step 1: Try Wikidata SPARQL (free, structured)
    const wiki = await queryWikidata(companyName, wikidata_id)

    const wikiTicker = wiki.ticker
    const wikiExchange = normalizeExchange(wiki.exchange)
    const wikiSector = normalizeSector(wiki.industry)

    // Step 2: If any field is missing, use Gemini Flash
    const needsGemini = !wikiTicker || !wikiExchange || !wikiSector
    let geminiResult: { ticker: string | null; exchange: string | null; sector: string | null; ir_url: string | null; confidence: number } | null = null

    if (needsGemini) {
      geminiResult = await enrichWithGemini(companyName, {
        ticker: wikiTicker,
        exchange: wikiExchange,
        sector: wikiSector,
      })
    }

    // Merge: prefer Wikidata (structured), fill gaps with Gemini
    const result = {
      ticker: wikiTicker || geminiResult?.ticker || null,
      exchange: wikiExchange || geminiResult?.exchange || null,
      sector: wikiSector || geminiResult?.sector || null,
      ir_url: geminiResult?.ir_url || null,
      confidence: wikiTicker ? 0.95 : (geminiResult?.confidence ?? 0.5),
      source: wikiTicker && geminiResult ? 'combined' : wikiTicker ? 'wikidata' : 'gemini',
    }

    return jsonResponse(result)
  } catch (err) {
    return errorResponse(err)
  }
})
