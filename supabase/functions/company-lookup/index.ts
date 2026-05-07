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
 * POST { query: string }
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
// Wikidata API (international companies, free, no API key)
// ---------------------------------------------------------------------------

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php'

interface WikiSearchResult {
  id: string
  label: string
  description: string
}

// Map nationality words in Wikidata descriptions to country/currency
const DESCRIPTION_COUNTRY_MAP: Record<string, { country: string; code: string; currency: string }> = {
  american: { country: 'United States', code: 'us', currency: 'USD' },
  british: { country: 'United Kingdom', code: 'gb', currency: 'GBP' },
  german: { country: 'Germany', code: 'de', currency: 'EUR' },
  french: { country: 'France', code: 'fr', currency: 'EUR' },
  italian: { country: 'Italy', code: 'it', currency: 'EUR' },
  spanish: { country: 'Spain', code: 'es', currency: 'EUR' },
  dutch: { country: 'Netherlands', code: 'nl', currency: 'EUR' },
  swedish: { country: 'Sweden', code: 'se', currency: 'SEK' },
  norwegian: { country: 'Norway', code: 'no', currency: 'NOK' },
  danish: { country: 'Denmark', code: 'dk', currency: 'DKK' },
  finnish: { country: 'Finland', code: 'fi', currency: 'EUR' },
  austrian: { country: 'Austria', code: 'at', currency: 'EUR' },
  japanese: { country: 'Japan', code: 'jp', currency: 'JPY' },
  chinese: { country: 'China', code: 'cn', currency: 'CNY' },
  canadian: { country: 'Canada', code: 'ca', currency: 'CAD' },
  australian: { country: 'Australia', code: 'au', currency: 'AUD' },
  indian: { country: 'India', code: 'in', currency: 'INR' },
  korean: { country: 'South Korea', code: 'kr', currency: 'KRW' },
  brazilian: { country: 'Brazil', code: 'br', currency: 'BRL' },
  singaporean: { country: 'Singapore', code: 'sg', currency: 'SGD' },
  luxembourgish: { country: 'Luxembourg', code: 'lu', currency: 'EUR' },
  irish: { country: 'Ireland', code: 'ie', currency: 'EUR' },
  belgian: { country: 'Belgium', code: 'be', currency: 'EUR' },
  portuguese: { country: 'Portugal', code: 'pt', currency: 'EUR' },
}

// Filter: only accept results that look like companies
const COMPANY_KEYWORDS = [
  'company', 'corporation', 'bank', 'insurance', 'firm', 'conglomerate',
  'manufacturer', 'airline', 'automaker', 'retailer', 'pharmaceutical',
  'technology', 'telecom', 'energy', 'financial', 'services', 'group',
  'multinational', 'holding', 'enterprise', 'brand', 'provider',
]

async function searchWikidata(query: string): Promise<CompanyResult[]> {
  try {
    const params = new URLSearchParams({
      action: 'wbsearchentities',
      search: query,
      language: 'en',
      type: 'item',
      limit: '15',
      format: 'json',
      origin: '*',
    })

    const res = await fetch(`${WIKIDATA_API}?${params}`)
    if (!res.ok) {
      console.warn(`Wikidata search failed: ${res.status}`)
      return []
    }

    const data = await res.json()
    const items: WikiSearchResult[] = (data.search ?? []).map((s: Record<string, unknown>) => ({
      id: s.id,
      label: s.label ?? s.display?.label?.value ?? '',
      description: s.description ?? s.display?.description?.value ?? '',
    }))

    // Filter to only company-like entities
    const companies = items.filter((item) => {
      const desc = item.description.toLowerCase()
      return COMPANY_KEYWORDS.some((kw) => desc.includes(kw))
    })

    return companies.slice(0, 8).map((item) => {
      const desc = item.description.toLowerCase()

      // Extract country from description nationality words
      let country = ''
      let countryCode = ''
      let currency = 'USD'
      for (const [keyword, info] of Object.entries(DESCRIPTION_COUNTRY_MAP)) {
        if (desc.includes(keyword)) {
          country = info.country
          countryCode = info.code
          currency = info.currency
          break
        }
      }

      // Extract sector from description
      const sector = mapPurposeToSector(item.description)

      return {
        name: item.label,
        jurisdiction: country || 'International',
        country_code: countryCode || '',
        sector,
        currency,
        legal_form: null,
        uid: item.id, // Wikidata QID
        ticker: null,
        source: 'opencorporates' as const, // Keep source label for UI badge
      }
    })
  } catch (err) {
    console.warn('Wikidata search error:', err)
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

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    await authenticateRequest(req)

    const { query } = await req.json()
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return jsonResponse({ results: [] })
    }

    const trimmed = query.trim()

    // Search both sources in parallel
    const [zefixResults, ocResults] = await Promise.all([
      searchZefix(trimmed),
      searchWikidata(trimmed),
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
