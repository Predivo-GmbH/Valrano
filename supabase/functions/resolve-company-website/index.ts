import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logAnthropicUsage } from '../_shared/log-usage.ts'

/** Strip common legal suffixes that break brand search (e.g. "Holcim Ltd" → "Holcim") */
function stripLegalSuffix(name: string): string {
  return name
    .replace(/\b(Ltd|Limited|Inc|Incorporated|Corp|Corporation|AG|SA|SE|GmbH|NV|BV|plc|SpA|SAS|SAB|de CV|S\.?A\.?B?\.?|Co\.?\s*KG|& Co)\b\.?\s*$/i, '')
    .trim()
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
- The correct answer is the domain where you'd find annual reports and investor relations${contextBlock}`
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
 * Get a reliable logo URL for a company domain.
 * Uses Google's favicon service as primary (always correct for the domain).
 * Brandfetch icon only used if domain matches what Brandfetch returned.
 */
function getLogoUrl(domain: string, brandfetchDomain: string | null, brandfetchIcon: string | null): string {
  // Only use Brandfetch icon if the domain matches what Brandfetch searched
  if (brandfetchIcon && brandfetchDomain === domain) return brandfetchIcon
  // Google's gstatic favicon service: reliable, high-res, no auth needed
  return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`
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

    const MIN_CONFIDENCE = 0.85

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
