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
 * Returns the correct corporate website if Brandfetch returned a wrong one.
 */
async function verifyWebsiteWithLLM(
  companyName: string,
  brandfetchDomain: string | null,
): Promise<{ domain: string; confidence: number; reasoning: string } | null> {
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicApiKey) return null

  const prompt = brandfetchDomain
    ? `Company name: "${companyName}"
A brand search API returned the domain "${brandfetchDomain}" as this company's website.

Is "${brandfetchDomain}" the correct MAIN CORPORATE website for "${companyName}"?
If not, what is the correct corporate website domain?

Consider:
- Companies may have rebranded (e.g. HeidelbergCement → Heidelberg Materials)
- Subsidiary/product domains are NOT the corporate website
- The correct answer is the domain where you'd find annual reports and investor relations`
    : `Company name: "${companyName}"
A brand search API returned no results for this company.

What is the correct MAIN CORPORATE website domain for "${companyName}"?
The correct answer is the domain where you'd find annual reports and investor relations.`

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
                description: '0-1 confidence. 0.9+ if well-known company. 0.5-0.8 if uncertain.',
              },
              reasoning: {
                type: 'string',
                description: 'Brief explanation (1 sentence)',
              },
            },
            required: ['correct_domain', 'confidence', 'reasoning'],
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
      reasoning: toolBlock.input.reasoning ?? '',
    }
  } catch (e) {
    console.error('LLM verification failed:', e)
    return null
  }
}

/**
 * Get a reliable logo URL for a company domain.
 * Uses Google's favicon service (always available, no auth needed, 128px).
 * Also tries Brandfetch icon if available.
 */
function getLogoUrl(domain: string, brandfetchIcon: string | null): string {
  // Brandfetch search result icon is highest quality when available
  if (brandfetchIcon) return brandfetchIcon
  // Google's gstatic favicon service: reliable, high-res, no auth needed
  return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { adminClient, user } = await authenticateRequest(req)
    const { name, company_id } = await req.json() as { name: string; company_id?: string }

    if (!name || name.trim().length < 2) {
      return jsonResponse({ error: 'Company name is required (min 2 chars)' }, 400)
    }

    const brandfetchClientId = Deno.env.get('BRANDFETCH_CLIENT_ID')
    if (!brandfetchClientId) {
      return jsonResponse({ error: 'Brandfetch not configured' }, 500)
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

    // --- Step 2: LLM verification ---
    // Always verify with Claude to catch rebrands and wrong matches
    const llmResult = await verifyWebsiteWithLLM(name.trim(), brandfetchDomain)

    // Use LLM result if confident, otherwise fall back to Brandfetch
    let finalDomain: string | null
    let source: string

    if (llmResult && llmResult.confidence >= 0.7) {
      finalDomain = llmResult.domain
      source = brandfetchDomain === llmResult.domain ? 'brandfetch_verified' : 'llm_corrected'
      if (source === 'llm_corrected') {
        console.log(`LLM corrected domain: ${brandfetchDomain} → ${llmResult.domain} (${llmResult.reasoning})`)
      }
    } else if (brandfetchDomain) {
      finalDomain = brandfetchDomain
      source = 'brandfetch_unverified'
    } else if (llmResult) {
      finalDomain = llmResult.domain
      source = 'llm_low_confidence'
    } else {
      finalDomain = null
      source = 'none'
    }

    if (!finalDomain) {
      return jsonResponse({ website_url: null, domain: null, source }, 200)
    }

    const website_url = `https://${finalDomain}`

    // --- Step 3: Get logo URL ---
    const logo_url = getLogoUrl(finalDomain, brandfetchIcon)

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
