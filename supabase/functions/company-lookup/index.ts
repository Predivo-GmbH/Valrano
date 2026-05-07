import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'

/**
 * company-lookup — Company autocomplete search
 *
 * Searches Zefix (Swiss companies) and OpenCorporates (international)
 * based on a partial name query. Returns normalized results with
 * sector, country, currency, and other metadata auto-detected.
 *
 * POST { query: string, country_filter?: string }
 * Returns { results: CompanyResult[] }
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompanyResult {
  name: string
  jurisdiction: string   // e.g. "Switzerland", "Germany"
  country_code: string   // e.g. "ch", "de"
  sector: string | null
  currency: string
  legal_form: string | null
  uid: string | null      // Swiss UID (CHE-xxx.xxx.xxx)
  ticker: string | null
  source: 'zefix' | 'opencorporates'
}

// ---------------------------------------------------------------------------
// Zefix API
// ---------------------------------------------------------------------------

const ZEFIX_BASE = 'https://www.zefix.admin.ch/ZefixPublicREST/api/v1'

interface ZefixCompany {
  uid: string
  name: string
  legalSeat: string
  canton: string
  legalForm: { name?: { de?: string } }
  purpose?: { de?: string }
  status: string
  shabDate?: string
}

async function searchZefix(query: string): Promise<CompanyResult[]> {
  const username = Deno.env.get('ZEFIX_USERNAME')
  const password = Deno.env.get('ZEFIX_PASSWORD')
  if (!username || !password) return []

  try {
    const res = await fetch(`${ZEFIX_BASE}/company/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
      },
      body: JSON.stringify({
        name: query,
        maxEntries: 8,
        activeOnly: true,
      }),
    })

    if (!res.ok) {
      console.warn(`Zefix search failed: ${res.status}`)
      return []
    }

    const data: ZefixCompany[] = await res.json()
    return data.map((c) => ({
      name: c.name,
      jurisdiction: 'Switzerland',
      country_code: 'ch',
      sector: mapPurposeToSector(c.purpose?.de ?? ''),
      currency: 'CHF',
      legal_form: c.legalForm?.name?.de ?? null,
      uid: formatUid(c.uid),
      ticker: null,
      source: 'zefix' as const,
    }))
  } catch (err) {
    console.warn('Zefix search error:', err)
    return []
  }
}

function formatUid(uid: string): string {
  // Format CHE-123.456.789 from raw UID
  if (!uid) return uid
  const clean = uid.replace(/\D/g, '')
  if (clean.length === 9) {
    return `CHE-${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}`
  }
  return uid
}

// ---------------------------------------------------------------------------
// OpenCorporates API
// ---------------------------------------------------------------------------

const OC_BASE = 'https://api.opencorporates.com/v0.4.8'

interface OCCompany {
  company: {
    name: string
    jurisdiction_code: string
    company_type: string | null
    company_number: string | null
    current_status: string | null
    incorporation_date: string | null
    industry_codes?: Array<{ industry_code: { code: string; description: string; code_scheme_id: string } }>
    registered_address?: { country: string } | null
  }
}

async function searchOpenCorporates(query: string, countryFilter?: string): Promise<CompanyResult[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      per_page: '8',
      order: 'score',
    })
    if (countryFilter) {
      const jCode = COUNTRY_TO_JURISDICTION[countryFilter.toLowerCase()]
      if (jCode) params.set('jurisdiction_code', jCode)
    }

    const res = await fetch(`${OC_BASE}/companies/search?${params}`, {
      headers: { 'Accept': 'application/json' },
    })

    if (!res.ok) {
      console.warn(`OpenCorporates search failed: ${res.status}`)
      return []
    }

    const data = await res.json()
    const companies: OCCompany[] = data?.results?.companies ?? []

    return companies.map((c) => {
      const jCode = c.company.jurisdiction_code?.toLowerCase() ?? ''
      const country = JURISDICTION_TO_COUNTRY[jCode] ?? jCode.toUpperCase()
      const countryCode = jCode.split('_')[0]

      return {
        name: c.company.name,
        jurisdiction: country,
        country_code: countryCode,
        sector: mapIndustryCodesToSector(c.company.industry_codes ?? []),
        currency: COUNTRY_CODE_TO_CURRENCY[countryCode] ?? 'USD',
        legal_form: c.company.company_type ?? null,
        uid: c.company.company_number ?? null,
        ticker: null,
        source: 'opencorporates' as const,
      }
    })
  } catch (err) {
    console.warn('OpenCorporates search error:', err)
    return []
  }
}

// ---------------------------------------------------------------------------
// Sector Mapping — NOGA/Purpose (Swiss) and Industry Codes (International)
// ---------------------------------------------------------------------------

const SECTOR_KEYWORDS: Record<string, string[]> = {
  'Banking & Financial Services': ['bank', 'finanz', 'kredit', 'kapital', 'finance', 'lending', 'credit', 'mortgage', 'investment bank'],
  'Insurance': ['versicherung', 'insurance', 'assurance', 'rückversicherung', 'reinsurance'],
  'Asset Management': ['vermögensverwaltung', 'asset management', 'fund', 'portfolio', 'wealth management', 'anlage'],
  'Real Estate': ['immobilien', 'real estate', 'property', 'liegenschaft', 'grundstück'],
  'Technology': ['software', 'technolog', 'digital', 'cyber', 'saas', 'cloud', 'IT-', 'informatik', 'daten', 'data'],
  'Healthcare & Pharma': ['pharma', 'medizin', 'gesundheit', 'health', 'biotech', 'medical', 'klinik', 'hospital', 'therapeut'],
  'Industrial & Manufacturing': ['industri', 'manufactur', 'maschinen', 'produktion', 'fertigung', 'engineering', 'mechanical'],
  'Energy & Utilities': ['energie', 'energy', 'strom', 'power', 'solar', 'wind', 'elektrizität', 'gas', 'utility'],
  'Consumer Goods': ['konsumgüter', 'consumer', 'lebensmittel', 'food', 'beverage', 'getränk', 'nahrung', 'kosmetik'],
  'Retail & E-Commerce': ['handel', 'retail', 'e-commerce', 'shop', 'verkauf', 'detailhandel', 'grosshandel'],
  'Telecommunications': ['telekom', 'telecom', 'kommunikation', 'mobile', 'netzwerk', 'network'],
  'Transportation & Logistics': ['transport', 'logistik', 'logistics', 'spedition', 'shipping', 'freight', 'aviation', 'luftfahrt'],
  'Media & Entertainment': ['medien', 'media', 'verlag', 'publishing', 'entertainment', 'film', 'broadcast'],
  'Construction & Materials': ['bau', 'construct', 'cement', 'zement', 'material', 'architektur', 'architect'],
}

function mapPurposeToSector(purpose: string): string | null {
  if (!purpose) return null
  const lower = purpose.toLowerCase()
  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return sector
  }
  return null
}

function mapIndustryCodesToSector(
  codes: Array<{ industry_code: { code: string; description: string; code_scheme_id: string } }>,
): string | null {
  if (codes.length === 0) return null
  // Try to map from description
  for (const entry of codes) {
    const desc = entry.industry_code.description?.toLowerCase() ?? ''
    for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
      if (keywords.some((kw) => desc.includes(kw))) return sector
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Country / Jurisdiction / Currency Mappings
// ---------------------------------------------------------------------------

const JURISDICTION_TO_COUNTRY: Record<string, string> = {
  ch: 'Switzerland', de: 'Germany', at: 'Austria', fr: 'France',
  gb: 'United Kingdom', us: 'United States', us_de: 'United States', us_ny: 'United States', us_ca: 'United States',
  nl: 'Netherlands', lu: 'Luxembourg', it: 'Italy', es: 'Spain',
  se: 'Sweden', no: 'Norway', dk: 'Denmark', fi: 'Finland',
  be: 'Belgium', ie: 'Ireland', pt: 'Portugal', jp: 'Japan',
  cn: 'China', au: 'Australia', ca: 'Canada', sg: 'Singapore',
  hk: 'Hong Kong', kr: 'South Korea', in: 'India', br: 'Brazil',
}

const COUNTRY_TO_JURISDICTION: Record<string, string> = {
  switzerland: 'ch', germany: 'de', austria: 'at', france: 'fr',
  'united kingdom': 'gb', 'united states': 'us', netherlands: 'nl',
  luxembourg: 'lu', italy: 'it', spain: 'es', sweden: 'se',
  norway: 'no', denmark: 'dk', finland: 'fi',
}

const COUNTRY_CODE_TO_CURRENCY: Record<string, string> = {
  ch: 'CHF', de: 'EUR', at: 'EUR', fr: 'EUR', nl: 'EUR', lu: 'EUR',
  it: 'EUR', es: 'EUR', fi: 'EUR', be: 'EUR', ie: 'EUR', pt: 'EUR',
  gb: 'GBP', us: 'USD', se: 'SEK', no: 'NOK', dk: 'DKK',
  jp: 'JPY', cn: 'CNY', au: 'AUD', ca: 'CAD', sg: 'SGD',
  hk: 'HKD', kr: 'KRW', in: 'INR', br: 'BRL',
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    await authenticateRequest(req)

    const { query, country_filter } = await req.json()
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return jsonResponse({ results: [] })
    }

    const trimmed = query.trim()

    // Search both sources in parallel
    const [zefixResults, ocResults] = await Promise.all([
      searchZefix(trimmed),
      searchOpenCorporates(trimmed, country_filter),
    ])

    // Deduplicate: if a company appears in both Zefix and OC, prefer Zefix (richer data)
    const seen = new Set<string>()
    const results: CompanyResult[] = []

    for (const r of zefixResults) {
      const key = r.name.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        results.push(r)
      }
    }

    for (const r of ocResults) {
      const key = r.name.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        results.push(r)
      }
    }

    // Limit to 10 results total
    return jsonResponse({ results: results.slice(0, 10) })
  } catch (err) {
    return errorResponse(err)
  }
})
