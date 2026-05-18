import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logAnthropicUsage } from '../_shared/log-usage.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip common legal suffixes that break brand search (e.g. "Holcim Ltd" → "Holcim") */
function stripLegalSuffix(name: string): string {
  return name
    .replace(/\b(Ltd|Limited|Inc|Incorporated|Corp|Corporation|AG|SA|SE|GmbH|NV|BV|plc|SpA|SAS|SAB|de CV|S\.?A\.?B?\.?|Co\.?\s*KG|& Co)\b\.?\s*$/i, '')
    .trim()
}

/** Extract root domain from a URL string (strips www, path, protocol) */
function extractDomain(url: string): string | null {
  try {
    const u = url.startsWith('http') ? new URL(url) : new URL(`https://${url}`)
    return u.hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

/** Check if a Brandfetch icon URL is a lettermark fallback (not a real logo) */
function isLettermarkFallback(iconUrl: string | null | undefined): boolean {
  if (!iconUrl) return true
  return iconUrl.includes('/fallback/lettermark/')
}

// ---------------------------------------------------------------------------
// Phase 1: Multi-source candidate collection
// ---------------------------------------------------------------------------

interface Candidate {
  domain: string
  name: string | null
  source: 'brandfetch' | 'serpapi'
  icon: string | null
}

/** Search Brandfetch for company domains */
async function searchBrandfetch(
  companyName: string,
  clientId: string,
): Promise<Candidate[]> {
  const cleanName = stripLegalSuffix(companyName)
  const namesToTry = cleanName !== companyName ? [companyName, cleanName] : [companyName]
  const candidates: Candidate[] = []

  for (const searchName of namesToTry) {
    try {
      const resp = await fetch(
        `https://api.brandfetch.io/v2/search/${encodeURIComponent(searchName)}?c=${clientId}`,
        { signal: AbortSignal.timeout(5000) },
      )
      if (!resp.ok) continue

      const results = await resp.json() as Array<{ name: string; domain: string; icon: string | null }>
      for (const r of results.slice(0, 5)) {
        if (r.domain && !candidates.some(c => c.domain === r.domain)) {
          candidates.push({ domain: r.domain, name: r.name, source: 'brandfetch', icon: r.icon })
        }
      }
      if (candidates.length > 0) break
    } catch {
      continue
    }
  }

  return candidates
}

/** Search Google via SerpAPI for company domains */
async function searchSerpApi(companyName: string): Promise<Candidate[]> {
  const serpApiKey = Deno.env.get('SERPAPI_API_KEY')
  if (!serpApiKey) {
    console.log('SERPAPI_API_KEY not set — skipping Google search')
    return []
  }

  const query = `"${companyName}" official website investor relations`
  const candidates: Candidate[] = []

  try {
    const params = new URLSearchParams({
      q: query,
      api_key: serpApiKey,
      engine: 'google',
      num: '10',
      hl: 'en',
    })
    const resp = await fetch(`https://serpapi.com/search.json?${params}`, {
      signal: AbortSignal.timeout(10000),
    })
    if (!resp.ok) {
      console.error('SerpAPI error:', resp.status)
      return []
    }

    const data = await resp.json() as {
      organic_results?: Array<{ link: string; title: string }>
    }

    const seen = new Set<string>()
    for (const result of data.organic_results ?? []) {
      const domain = extractDomain(result.link)
      if (!domain || seen.has(domain)) continue
      // Skip search engines, social media, wikipedia (not corporate sites)
      if (/google\.|bing\.|yahoo\.|youtube\.|facebook\.|twitter\.|linkedin\.|wikipedia\.|reddit\./i.test(domain)) continue
      seen.add(domain)
      candidates.push({ domain, name: result.title, source: 'serpapi', icon: null })
    }
  } catch (e) {
    console.error('SerpAPI search failed:', e)
  }

  return candidates
}

// ---------------------------------------------------------------------------
// Phase 2: LLM as constrained selector
// ---------------------------------------------------------------------------

interface LlmSelection {
  selected_domain: string | null
  confidence: number
  reasoning: string
  is_sector_match: boolean
}

async function selectDomainWithLLM(
  companyName: string,
  candidates: Candidate[],
  sectorContext: string | null,
): Promise<LlmSelection | null> {
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicApiKey) return null

  if (candidates.length === 0) return null

  const candidateList = candidates.map((c, i) =>
    `${i + 1}. ${c.domain}${c.name ? ` (brand name: "${c.name}")` : ''} [source: ${c.source}]`
  ).join('\n')

  const contextBlock = sectorContext
    ? `\n\nIMPORTANT CONTEXT: ${sectorContext}
The correct website MUST be for a company operating in this sector.
If "${companyName}" is ambiguous (e.g., could match companies in different industries), you MUST choose the one matching the sector context above.`
    : ''

  const prompt = `Company name: "${companyName}"

Below are candidate domains found by searching brand databases and Google. Your job is to SELECT the correct MAIN CORPORATE website from this list — or select NONE if no candidate is correct.

CANDIDATES:
${candidateList}

RULES:
- You may ONLY select a domain from the list above. You may NOT suggest any domain not in this list.
- The correct domain is where you'd find annual reports, investor relations, and corporate information.
- Be careful with similarly-named companies (e.g. "Fletcher" could be Fletcher Building, Fletcher Hotels, or Fletcher Group — they are different companies).
- Subsidiary, product, or career domains are NOT the main corporate website.
- If NONE of the candidates are the correct corporate website, select null.${contextBlock}`

  try {
    const validDomains = candidates.map(c => c.domain)
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        tools: [{
          name: 'select_website',
          description: 'Select the correct corporate website from the candidate list, or null if none match',
          input_schema: {
            type: 'object',
            properties: {
              selected_domain: {
                type: ['string', 'null'],
                description: `The selected domain from the candidate list. MUST be one of: ${validDomains.join(', ')} — or null if none are correct.`,
              },
              confidence: {
                type: 'number',
                minimum: 0,
                maximum: 1,
                description: '0-1 confidence in the selection. 0.95+ for well-known public companies. Below 0.8 if uncertain.',
              },
              is_sector_match: {
                type: 'boolean',
                description: 'true if the company at this domain operates in the same sector/industry as described in the context.',
              },
              reasoning: {
                type: 'string',
                description: 'Brief explanation (1-2 sentences)',
              },
            },
            required: ['selected_domain', 'confidence', 'is_sector_match', 'reasoning'],
          },
        }],
        tool_choice: { type: 'tool', name: 'select_website' },
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!resp.ok) return null

    const json = await resp.json()
    await logAnthropicUsage('Valrano', 'resolve-company-website', json)

    const toolBlock = json.content?.find((b: { type: string }) => b.type === 'tool_use')
    if (!toolBlock?.input) return null

    const selectedDomain = toolBlock.input.selected_domain
      ? String(toolBlock.input.selected_domain).replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '')
      : null

    // ENFORCE: selected domain MUST be in the candidate list
    if (selectedDomain && !validDomains.includes(selectedDomain)) {
      console.log(`LLM selected domain NOT in candidate list: "${selectedDomain}" — REJECTING (hallucination guard)`)
      return {
        selected_domain: null,
        confidence: 0,
        reasoning: `LLM hallucinated domain "${selectedDomain}" not in candidates — rejected`,
        is_sector_match: false,
      }
    }

    return {
      selected_domain: selectedDomain,
      confidence: toolBlock.input.confidence ?? 0.5,
      is_sector_match: toolBlock.input.is_sector_match ?? false,
      reasoning: toolBlock.input.reasoning ?? '',
    }
  } catch (e) {
    console.error('LLM selection failed:', e)
    return null
  }
}

// ---------------------------------------------------------------------------
// Phase 3: Strict verification
// ---------------------------------------------------------------------------

/** HEAD-check that domain is reachable (200/301/302 only, NOT 403) */
async function validateDomainReachable(domain: string): Promise<{ reachable: boolean; finalDomain: string | null }> {
  try {
    const resp = await fetch(`https://${domain}`, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
    })

    let finalDomain: string | null = null
    if (resp.url) {
      const fd = new URL(resp.url).hostname.replace(/^www\./, '')
      const orig = domain.replace(/^www\./, '')
      if (fd !== orig && !fd.endsWith('.' + orig)) {
        finalDomain = fd
      }
    }

    // Only accept 2xx — NOT 403/405 (can't verify a page that blocks us)
    return { reachable: resp.ok, finalDomain }
  } catch {
    return { reachable: false, finalDomain: null }
  }
}

/**
 * Strict page verification: company name must appear in <title>, <meta>, or <h1>.
 * NO domain-derived word fallback.
 */
async function verifyCompanyNameOnPage(domain: string, companyName: string): Promise<boolean> {
  try {
    const resp = await fetch(`https://${domain}`, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Valrano/1.0)' },
    })
    if (!resp.ok) return false

    const reader = resp.body?.getReader()
    if (!reader) return false
    let html = ''
    const decoder = new TextDecoder()
    while (html.length < 50000) {
      const { done, value } = await reader.read()
      if (done) break
      html += decoder.decode(value, { stream: true })
    }
    reader.cancel()

    const htmlLower = html.toLowerCase()
    const cleanName = stripLegalSuffix(companyName).toLowerCase()

    // Extract structured elements only: <title>, <meta description>, <h1>
    const titleMatch = htmlLower.match(/<title[^>]*>([\s\S]*?)<\/title>/)
    const metaMatch = htmlLower.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/)
      || htmlLower.match(/<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/)
    const h1Matches = [...htmlLower.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map(m => m[1])

    const structuredText = [
      titleMatch?.[1] ?? '',
      metaMatch?.[1] ?? '',
      ...h1Matches,
    ].join(' ')

    // Check full company name in structured elements
    if (structuredText.includes(cleanName)) return true

    // For multi-word names, check if ALL significant words appear in structured elements
    const words = cleanName.split(/\s+/).filter(w => w.length > 2)
    if (words.length >= 2 && words.every(w => structuredText.includes(w))) return true

    // Fallback: check full name anywhere in the HTML body (but NOT domain-derived words)
    if (htmlLower.includes(cleanName)) return true
    if (words.length >= 2 && words.every(w => htmlLower.includes(w))) return true

    return false
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Phase 5: Logo quality gate
// ---------------------------------------------------------------------------

/** Validate logo URL is a real icon, not a lettermark or broken redirect */
async function validateLogoUrl(logoUrl: string): Promise<boolean> {
  if (isLettermarkFallback(logoUrl)) return false

  try {
    const resp = await fetch(logoUrl, {
      method: 'HEAD',
      redirect: 'manual', // Don't follow redirects — detect 302 to docs
      signal: AbortSignal.timeout(5000),
    })

    // 302 to brandfetch docs = not in index
    if (resp.status === 302) {
      const location = resp.headers.get('location') ?? ''
      if (location.includes('brandfetch.com/docs')) return false
    }

    // Must be a successful image response
    return resp.ok && (resp.headers.get('content-type')?.startsWith('image/') ?? false)
  } catch {
    return false
  }
}

/** Build Brandfetch CDN logo URL for a domain */
function buildLogoUrl(domain: string, clientId: string): string {
  return `https://cdn.brandfetch.io/${domain}/w/128/h/128/icon?c=${clientId}`
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { adminClient, user } = await authenticateRequest(req)
    const { name, company_id, sector, industry_context } = await req.json() as {
      name: string
      company_id?: string
      sector?: string
      industry_context?: string
    }

    if (!name || name.trim().length < 2) {
      return jsonResponse({ error: 'Company name is required (min 2 chars)' }, 400)
    }

    const brandfetchClientId = Deno.env.get('BRANDFETCH_CLIENT_ID')
    if (!brandfetchClientId) {
      return jsonResponse({ error: 'Brandfetch not configured' }, 500)
    }

    const companyName = name.trim()

    // -----------------------------------------------------------------------
    // Step 0: Build sector context
    // -----------------------------------------------------------------------
    let sectorContext = industry_context || null

    if (!sectorContext && company_id) {
      const { data: myCompanies } = await adminClient
        .from('my_companies')
        .select('companies(name, sector)')
        .eq('user_id', user.id)
        .eq('is_primary', true)
        .limit(1)

      const primaryCompany = myCompanies?.[0]?.companies as { name: string; sector: string | null } | null

      if (primaryCompany) {
        const { data: profile } = await adminClient
          .from('accounting_profiles')
          .select('company_name, policies')
          .eq('user_id', user.id)
          .maybeSingle()

        const sectorStr = sector || primaryCompany.sector || ''
        const profileIndustry = (profile?.policies as Record<string, string> | null)?.industry || ''

        sectorContext = `This company "${companyName}" is a competitor/peer of "${primaryCompany.name}"${sectorStr ? ` in the ${sectorStr} industry` : ''}${profileIndustry ? ` (specifically: ${profileIndustry})` : ''}. The peer group contains companies that compete in the same markets as ${primaryCompany.name}.`
      }
    } else if (!sectorContext && sector) {
      sectorContext = `This company "${companyName}" operates in the ${sector} industry.`
    }

    // -----------------------------------------------------------------------
    // Step 1: Multi-source candidate collection (Brandfetch + SerpAPI)
    // -----------------------------------------------------------------------
    const [brandfetchCandidates, serpCandidates] = await Promise.all([
      searchBrandfetch(companyName, brandfetchClientId),
      searchSerpApi(companyName),
    ])

    // Merge and deduplicate
    const allCandidates: Candidate[] = [...brandfetchCandidates]
    for (const sc of serpCandidates) {
      if (!allCandidates.some(c => c.domain === sc.domain)) {
        allCandidates.push(sc)
      }
    }

    console.log(`Candidates for "${companyName}": ${allCandidates.map(c => `${c.domain} [${c.source}]`).join(', ') || 'NONE'}`)

    if (allCandidates.length === 0) {
      console.log(`No candidates found for "${companyName}" — returning null`)
      return jsonResponse({
        website_url: null, domain: null, logo_url: null,
        source: 'no_candidates', confidence: 0,
      }, 200)
    }

    // -----------------------------------------------------------------------
    // Step 2: LLM selects from candidates (constrained — no hallucination)
    // -----------------------------------------------------------------------
    const llmResult = await selectDomainWithLLM(companyName, allCandidates, sectorContext)

    let selectedDomain = llmResult?.selected_domain ?? null
    let confidence = llmResult?.confidence ?? 0
    let source = 'none'
    const reasoning = llmResult?.reasoning ?? ''

    if (selectedDomain) {
      source = 'llm_selected'
      console.log(`LLM selected "${selectedDomain}" (conf=${confidence}) for "${companyName}": ${reasoning}`)

      // Sector mismatch with low confidence → reject
      if (sectorContext && llmResult && !llmResult.is_sector_match && confidence < 0.9) {
        console.log(`Sector mismatch rejection: "${companyName}" → ${selectedDomain}`)
        selectedDomain = null
        source = 'sector_mismatch_rejected'
        confidence = 0
      }
    } else {
      console.log(`LLM selected no domain for "${companyName}": ${reasoning}`)
    }

    // -----------------------------------------------------------------------
    // Step 3: Strict verification
    // -----------------------------------------------------------------------
    if (selectedDomain) {
      // 3a: HEAD reachability (200 only, not 403)
      const validation = await validateDomainReachable(selectedDomain)
      if (!validation.reachable) {
        console.log(`Domain unreachable: "${companyName}" → ${selectedDomain}`)
        selectedDomain = null
        source = 'domain_unreachable'
        confidence = 0
      } else if (validation.finalDomain) {
        console.log(`Domain redirects: ${selectedDomain} → ${validation.finalDomain}`)
        // Accept redirect only if the final domain is also in our candidate list
        if (allCandidates.some(c => c.domain === validation.finalDomain)) {
          selectedDomain = validation.finalDomain
          source = 'redirect_to_candidate'
        } else {
          console.log(`Redirect target "${validation.finalDomain}" not in candidates — rejecting`)
          selectedDomain = null
          source = 'redirect_not_in_candidates'
          confidence = 0
        }
      }
    }

    if (selectedDomain) {
      // 3b: Cross-reference with IR URL if available
      if (company_id) {
        const { data: existingCompany } = await adminClient
          .from('companies')
          .select('ir_page_url')
          .eq('id', company_id)
          .maybeSingle()

        if (existingCompany?.ir_page_url) {
          try {
            const irDomain = new URL(existingCompany.ir_page_url).hostname.replace(/^www\./, '')
            const resolvedClean = selectedDomain.replace(/^www\./, '')
            if (irDomain !== resolvedClean && !irDomain.endsWith('.' + resolvedClean) && !resolvedClean.endsWith('.' + irDomain)) {
              // IR URL points to different domain — if it's in candidates, prefer it
              if (allCandidates.some(c => c.domain === irDomain)) {
                console.log(`IR cross-ref corrected: ${selectedDomain} → ${irDomain}`)
                selectedDomain = irDomain
                source = 'ir_crossref_corrected'
              }
            }
          } catch { /* invalid IR URL, ignore */ }
        }
      }

      // 3c: Page content verification (strict — no domain-word fallback)
      const nameOnPage = await verifyCompanyNameOnPage(selectedDomain, companyName)
      if (!nameOnPage) {
        console.log(`Page verification FAILED: "${companyName}" not found on ${selectedDomain}`)
        // Don't reject outright — lower confidence so frontend shows confirmation
        confidence = Math.min(confidence, 0.6)
        source = source + '_unverified'
      }
    }

    // -----------------------------------------------------------------------
    // Step 4: Logo quality gate
    // -----------------------------------------------------------------------
    let logoUrl: string | null = null

    if (selectedDomain) {
      // Try Brandfetch icon from search results first
      const matchingCandidate = allCandidates.find(c => c.domain === selectedDomain && c.icon)
      if (matchingCandidate?.icon && !isLettermarkFallback(matchingCandidate.icon)) {
        logoUrl = matchingCandidate.icon
      }

      // Try Brandfetch CDN URL
      if (!logoUrl) {
        const cdnUrl = buildLogoUrl(selectedDomain, brandfetchClientId)
        const isValid = await validateLogoUrl(cdnUrl)
        if (isValid) logoUrl = cdnUrl
      }

      // Try other candidate domains for a better logo
      if (!logoUrl) {
        for (const c of allCandidates) {
          if (c.domain === selectedDomain) continue
          if (c.icon && !isLettermarkFallback(c.icon)) {
            // Only use another candidate's logo if their name matches our company
            const cNameLower = (c.name ?? '').toLowerCase()
            const companyLower = stripLegalSuffix(companyName).toLowerCase()
            if (cNameLower.includes(companyLower) || companyLower.includes(cNameLower)) {
              const altCdnUrl = buildLogoUrl(c.domain, brandfetchClientId)
              const isValid = await validateLogoUrl(altCdnUrl)
              if (isValid) {
                logoUrl = altCdnUrl
                break
              }
            }
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // Step 5: Confidence gating — decide whether to auto-save
    // -----------------------------------------------------------------------
    const AUTO_SAVE_THRESHOLD = 0.85

    const websiteUrl = selectedDomain ? `https://${selectedDomain}` : null

    if (selectedDomain && confidence >= AUTO_SAVE_THRESHOLD && company_id) {
      // High confidence — auto-save to DB
      const { data: visibleIds } = await adminClient
        .rpc('visible_company_ids_for_user', { p_user_id: user.id })
      const visible = new Set((visibleIds ?? []) as string[])
      if (visible.has(company_id)) {
        const updateData: Record<string, string | null> = {
          website_url: websiteUrl,
          logo_url: logoUrl,
        }

        const { error } = await adminClient
          .from('companies')
          .update(updateData)
          .eq('id', company_id)

        if (error) {
          console.error('Failed to update company:', error.message)
        } else {
          console.log(`Auto-saved (conf=${confidence}): "${companyName}" → ${selectedDomain}`)
        }
      }
    } else if (selectedDomain) {
      console.log(`Low confidence (${confidence}) — NOT auto-saving "${companyName}" → ${selectedDomain}. Frontend should confirm.`)
    }

    // Log API usage
    const services: string[] = ['brandfetch']
    if (serpCandidates.length > 0) services.push('serpapi')

    for (const service of services) {
      await adminClient.from('api_request_logs').insert({
        service,
        endpoint: service === 'brandfetch' ? '/v2/search' : '/search.json',
        call_count: 1,
        user_id: user.id,
        edge_function: 'resolve-company-website',
      }).then(({ error }) => {
        if (error) console.error(`Failed to log ${service} usage:`, error.message)
      })
    }

    return jsonResponse({
      website_url: websiteUrl,
      domain: selectedDomain,
      logo_url: logoUrl,
      source,
      confidence,
      reasoning,
      needs_confirmation: selectedDomain ? confidence < AUTO_SAVE_THRESHOLD : false,
      candidates: allCandidates.map(c => ({ domain: c.domain, name: c.name, source: c.source })),
    })
  } catch (err) {
    return errorResponse(err)
  }
})
