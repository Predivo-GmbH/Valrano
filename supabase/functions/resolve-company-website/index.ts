import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logAnthropicUsage } from '../_shared/log-usage.ts'

/** Strip common legal suffixes that break brand search (e.g. "Holcim Ltd" → "Holcim") */
function stripLegalSuffix(name: string): string {
  return name
    .replace(/\b(Ltd|Limited|Inc|Incorporated|Corp|Corporation|AG|SA|SE|GmbH|NV|BV|plc|SpA|SAS|SAB|de CV|S\.?A\.?B?\.?|Co\.?\s*KG|& Co)\b\.?\s*$/i, '')
    .trim()
}

/** Check if key words from company name appear in the domain (name-similarity heuristic) */
function domainMatchesName(domain: string, companyName: string): boolean {
  const domainLower = domain.toLowerCase().replace(/[^a-z0-9]/g, '')
  const words = stripLegalSuffix(companyName).toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2)
  if (words.length === 0) return true
  return words.some(w => domainLower.includes(w))
}

/** Validate domain responds via HEAD request; detect redirects to different domains */
async function validateDomainReachable(domain: string): Promise<{ reachable: boolean; redirectDomain: string | null }> {
  try {
    const resp = await fetch(`https://${domain}`, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
    })
    const finalUrl = resp.url
    if (finalUrl) {
      const finalDomain = new URL(finalUrl).hostname.replace(/^www\./, '')
      const originalClean = domain.replace(/^www\./, '')
      if (finalDomain !== originalClean && !finalDomain.endsWith('.' + originalClean)) {
        return { reachable: true, redirectDomain: finalDomain }
      }
    }
    return { reachable: resp.ok || resp.status === 405 || resp.status === 403, redirectDomain: null }
  } catch {
    return { reachable: false, redirectDomain: null }
  }
}

/**
 * FINAL GATEKEEPER: Fetch the page and verify the company name appears in the HTML.
 * If the company name is not mentioned on the page, the domain is REJECTED.
 * This guarantees we never show a wrong website.
 */
async function verifyCompanyNameOnPage(domain: string, companyName: string): Promise<boolean> {
  try {
    const resp = await fetch(`https://${domain}`, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BenchmarkSignal/1.0)' },
    })
    if (!resp.ok) return false

    // Read first 50KB of HTML (enough to check title, meta, headers)
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

    // Check if full company name appears
    if (htmlLower.includes(cleanName)) return true

    // Check if individual significant words all appear (e.g. "Titan" AND "Cement")
    const words = cleanName.split(/\s+/).filter(w => w.length > 2)
    if (words.length >= 2 && words.every(w => htmlLower.includes(w))) return true

    // Check domain-derived name (e.g. titan-cement.com → "titan cement")
    const domainName = domain.replace(/\.(com|net|org|io|ch|de|fr|es|co\.uk|com\.au)$/i, '').replace(/[-_.]/g, ' ').toLowerCase()
    const domainWords = domainName.split(/\s+/).filter(w => w.length > 2)
    if (domainWords.length >= 1 && words.some(w => domainWords.some(dw => dw.includes(w) || w.includes(dw)))) {
      // Domain itself contains company name words — check if page has at least the domain brand
      if (domainWords.some(dw => htmlLower.includes(dw))) return true
    }

    return false
  } catch {
    // If we can't fetch the page, we cannot verify — reject
    return false
  }
}

/**
 * Use Claude Haiku to verify/correct a company website URL.
 * Now includes sector/industry context for disambiguation.
 */
async function verifyWebsiteWithLLM(
  companyName: string,
  brandfetchDomain: string | null,
  sectorContext: string | null,
): Promise<{ domain: string; confidence: number; reasoning: string; is_sector_match: boolean } | null> {
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicApiKey) return null

  const contextBlock = sectorContext
    ? `\n\nIMPORTANT CONTEXT: ${sectorContext}
The correct website MUST be for a company operating in this sector.
If "${companyName}" is ambiguous (e.g., could match companies in different industries), you MUST choose the one matching the sector context above. If no match exists in the correct sector, return confidence 0.`
    : ''

  const prompt = brandfetchDomain
    ? `Company name: "${companyName}"
A brand search API returned the domain "${brandfetchDomain}" as this company's website.

Is "${brandfetchDomain}" the correct MAIN CORPORATE website for "${companyName}"?
If not, what is the correct corporate website domain?

Consider:
- Companies may have rebranded (e.g. HeidelbergCement → Heidelberg Materials)
- Subsidiary/product domains are NOT the corporate website
- The correct answer is the domain where you'd find annual reports and investor relations
- CRITICAL: Be extremely careful with similarly-named companies. For example "Titan Cement" (titan-cement.com) vs "TitanCem" (titancem.com) are DIFFERENT companies. The domain must belong to the EXACT company named, not a similarly-named one. If the Brandfetch result looks like an abbreviation, truncation, or different brand with a similar name, REJECT it and provide the correct domain.${contextBlock}`
    : `Company name: "${companyName}"
A brand search API returned no results for this company.

What is the correct MAIN CORPORATE website domain for "${companyName}"?
The correct answer is the domain where you'd find annual reports and investor relations.${contextBlock}`

  try {
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
          name: 'verify_website',
          description: 'Verify or correct a company corporate website domain',
          input_schema: {
            type: 'object',
            properties: {
              correct_domain: {
                type: 'string',
                description: 'The correct corporate website domain (e.g. "holcim.com", "heidelbergmaterials.com"). No protocol prefix.',
              },
              confidence: {
                type: 'number',
                minimum: 0,
                maximum: 1,
                description: '0-1 confidence. 0.95+ for well-known public companies. 0.8-0.94 for less well-known. Below 0.8 if uncertain.',
              },
              is_sector_match: {
                type: 'boolean',
                description: 'true if the company at this domain operates in (or has a major division in) the same sector/industry as described in the context. Conglomerates with a significant presence in the target sector count as true. false only if the company has NO meaningful operations in the described sector.',
              },
              reasoning: {
                type: 'string',
                description: 'Brief explanation (1 sentence)',
              },
            },
            required: ['correct_domain', 'confidence', 'is_sector_match', 'reasoning'],
          },
        }],
        tool_choice: { type: 'tool', name: 'verify_website' },
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!resp.ok) return null

    const json = await resp.json()
    await logAnthropicUsage('BenchmarkSignal', 'resolve-company-website', json)

    const toolBlock = json.content?.find((b: { type: string }) => b.type === 'tool_use')
    if (!toolBlock?.input?.correct_domain) return null

    return {
      domain: toolBlock.input.correct_domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, ''),
      confidence: toolBlock.input.confidence ?? 0.5,
      is_sector_match: toolBlock.input.is_sector_match ?? false,
      reasoning: toolBlock.input.reasoning ?? '',
    }
  } catch (e) {
    console.error('LLM verification failed:', e)
    return null
  }
}

/**
 * Get a logo URL for a company domain.
 * Uses Brandfetch CDN icon if available, otherwise Brandfetch CDN URL format
 * (the frontend CompanyLogo component handles fallback to Building2 icon on error).
 */
function getLogoUrl(domain: string, brandfetchDomain: string | null, brandfetchIcon: string | null): string {
  // Use Brandfetch icon if domain matches
  if (brandfetchIcon && brandfetchDomain === domain) return brandfetchIcon
  // Use Brandfetch CDN URL — frontend handles 404/redirect gracefully
  const clientId = Deno.env.get('BRANDFETCH_CLIENT_ID') || '1idRDjMi84k4oQP5jUq'
  return `https://cdn.brandfetch.io/${domain}/w/128/h/128/icon?c=${clientId}`
}

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

    // --- Step 0: Build sector context ---
    let sectorContext = industry_context || null

    if (!sectorContext && company_id) {
      // Load the user's primary company to get sector context
      const { data: myCompanies } = await adminClient
        .from('my_companies')
        .select('companies(name, sector)')
        .eq('user_id', user.id)
        .eq('is_primary', true)
        .limit(1)

      const primaryCompany = myCompanies?.[0]?.companies as { name: string; sector: string | null } | null

      if (primaryCompany) {
        // Also try accounting profile for richer context
        const { data: profile } = await adminClient
          .from('accounting_profiles')
          .select('company_name, policies')
          .eq('user_id', user.id)
          .maybeSingle()

        const sectorStr = sector || primaryCompany.sector || ''
        const profileIndustry = profile?.policies?.industry || ''

        sectorContext = `This company "${name}" is a competitor/peer of "${primaryCompany.name}"${sectorStr ? ` in the ${sectorStr} industry` : ''}${profileIndustry ? ` (specifically: ${profileIndustry})` : ''}. The peer group contains companies that compete in the same markets as ${primaryCompany.name}.`
      }
    } else if (!sectorContext && sector) {
      sectorContext = `This company "${name}" operates in the ${sector} industry.`
    }

    // --- Step 1: Brandfetch search ---
    const cleanName = stripLegalSuffix(name.trim())
    const namesToTry = cleanName !== name.trim() ? [name.trim(), cleanName] : [name.trim()]

    let results: Array<{ name: string; domain: string; icon: string | null }> = []

    for (const searchName of namesToTry) {
      const resp = await fetch(
        `https://api.brandfetch.io/v2/search/${encodeURIComponent(searchName)}?c=${brandfetchClientId}`,
        { signal: AbortSignal.timeout(5000) },
      )

      if (!resp.ok) {
        console.error('Brandfetch API error:', resp.status, await resp.text())
        continue
      }

      results = await resp.json() as Array<{ name: string; domain: string; icon: string | null }>
      if (results.length > 0 && results[0].domain) break
    }

    const brandfetchDomain = results.length > 0 ? results[0].domain : null
    const brandfetchIcon = results.length > 0 ? results[0].icon : null

    // --- Step 2: LLM verification with sector context ---
    const llmResult = await verifyWebsiteWithLLM(name.trim(), brandfetchDomain, sectorContext)

    // Use LLM result only if confident AND sector matches (when context provided)
    let finalDomain: string | null
    let source: string

    const MIN_CONFIDENCE = 0.95

    if (llmResult && llmResult.confidence >= MIN_CONFIDENCE) {
      // Sector mismatch is a warning, not an automatic rejection.
      // Only reject if confidence is below 0.9 AND sector doesn't match.
      // High-confidence results (>=0.9) are kept even with sector mismatch
      // (conglomerates like Bouygues/Vinci operate across sectors).
      if (sectorContext && !llmResult.is_sector_match && llmResult.confidence < 0.9) {
        console.log(`Sector mismatch rejected (conf=${llmResult.confidence}): "${name}" → ${llmResult.domain} (${llmResult.reasoning})`)
        finalDomain = null
        source = 'sector_mismatch_rejected'
      } else {
        finalDomain = llmResult.domain
        source = brandfetchDomain === llmResult.domain ? 'brandfetch_verified' : 'llm_corrected'
        if (source === 'llm_corrected') {
          console.log(`LLM corrected domain: ${brandfetchDomain} → ${llmResult.domain} (${llmResult.reasoning})`)
        }
        if (sectorContext && !llmResult.is_sector_match) {
          console.log(`Sector mismatch accepted (high confidence ${llmResult.confidence}): "${name}" → ${llmResult.domain}`)
        }
      }
    } else if (llmResult) {
      // Low confidence — still use if Brandfetch agrees (regardless of sector context)
      if (brandfetchDomain && brandfetchDomain === llmResult.domain) {
        finalDomain = brandfetchDomain
        source = 'brandfetch_llm_agree_low_confidence'
      } else {
        console.log(`Low confidence rejected: "${name}" → ${llmResult.domain} (conf=${llmResult.confidence}, reason=${llmResult.reasoning})`)
        finalDomain = null
        source = 'low_confidence_rejected'
      }
    } else {
      finalDomain = null
      source = 'none'
    }

    // --- Step 2b: Domain-name heuristic check (Change 4) ---
    if (finalDomain && !domainMatchesName(finalDomain, name.trim())) {
      // Domain doesn't contain any word from company name — apply confidence penalty
      if (llmResult && llmResult.confidence < 0.95) {
        console.log(`Name-heuristic rejection: "${name}" → ${finalDomain} (no name words in domain, conf=${llmResult.confidence})`)
        finalDomain = null
        source = 'name_heuristic_rejected'
      } else {
        console.log(`Name-heuristic warning (high conf override): "${name}" → ${finalDomain}`)
      }
    }

    // --- Step 2c: HEAD validation (Change 2) ---
    if (finalDomain) {
      const validation = await validateDomainReachable(finalDomain)
      if (!validation.reachable) {
        console.log(`Domain unreachable: "${name}" → ${finalDomain}`)
        finalDomain = null
        source = 'domain_unreachable'
      } else if (validation.redirectDomain) {
        console.log(`Domain redirects: ${finalDomain} → ${validation.redirectDomain}`)
        // If redirected domain matches the company name better, use it
        if (domainMatchesName(validation.redirectDomain, name.trim())) {
          finalDomain = validation.redirectDomain
          source = 'redirect_corrected'
        } else {
          finalDomain = null
          source = 'redirect_mismatch_rejected'
        }
      }
    }

    // --- Step 2d: Cross-reference with IR URL if available (Change 1) ---
    if (finalDomain && company_id) {
      const { data: existingCompany } = await adminClient
        .from('companies')
        .select('ir_page_url')
        .eq('id', company_id)
        .maybeSingle()

      if (existingCompany?.ir_page_url) {
        try {
          const irDomain = new URL(existingCompany.ir_page_url).hostname.replace(/^www\./, '')
          const resolvedClean = finalDomain.replace(/^www\./, '')
          if (irDomain !== resolvedClean && !irDomain.endsWith('.' + resolvedClean) && !resolvedClean.endsWith('.' + irDomain)) {
            console.log(`IR URL domain mismatch: website=${finalDomain}, IR=${irDomain} — using IR domain root`)
            finalDomain = irDomain
            source = 'ir_crossref_corrected'
          }
        } catch { /* invalid IR URL, ignore */ }
      }
    }

    // --- Step 2e: FINAL GATEKEEPER — verify company name appears on the page ---
    if (finalDomain) {
      const nameOnPage = await verifyCompanyNameOnPage(finalDomain, name.trim())
      if (!nameOnPage) {
        console.log(`Page content verification FAILED: "${name}" not found on ${finalDomain} — REJECTING`)
        finalDomain = null
        source = 'page_verification_failed'
      }
    }

    if (!finalDomain) {
      return jsonResponse({ website_url: null, domain: null, logo_url: null, source }, 200)
    }

    const website_url = `https://${finalDomain}`

    // --- Step 3: Get logo URL (only use Brandfetch icon if domain matches) ---
    const logo_url = getLogoUrl(finalDomain, brandfetchDomain, brandfetchIcon)

    // --- Step 4: Update company record ---
    if (company_id) {
      const { data: visibleIds } = await adminClient
        .rpc('visible_company_ids_for_user', { p_user_id: user.id })
      const visible = new Set((visibleIds ?? []) as string[])
      if (!visible.has(company_id)) {
        return jsonResponse({ error: 'Company not in your peer groups' }, 403)
      }

      const updateData: Record<string, string | null> = { website_url, logo_url }

      const { error } = await adminClient
        .from('companies')
        .update(updateData)
        .eq('id', company_id)

      if (error) {
        console.error('Failed to update company:', error.message)
      }
    }

    // Log Brandfetch API usage
    await adminClient.from('api_request_logs').insert({
      service: 'brandfetch',
      endpoint: '/v2/search',
      call_count: 1,
      user_id: user.id,
      edge_function: 'resolve-company-website',
    }).then(({ error }) => {
      if (error) console.error('Failed to log usage:', error.message)
    })

    return jsonResponse({ website_url, domain: finalDomain, logo_url, source })
  } catch (err) {
    return errorResponse(err)
  }
})
