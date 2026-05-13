import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

/** Strip common legal suffixes that break brand search (e.g. "Holcim Ltd" → "Holcim") */
function stripLegalSuffix(name: string): string {
  return name
    .replace(/\b(Ltd|Limited|Inc|Incorporated|Corp|Corporation|AG|SA|SE|GmbH|NV|BV|plc|SpA|SAS|SAB|de CV|S\.?A\.?B?\.?|Co\.?\s*KG|& Co)\b\.?\s*$/i, '')
    .trim()
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

    // Try with original name first, fall back to stripped name
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

    if (!results.length || !results[0].domain) {
      return jsonResponse({ website_url: null, domain: null }, 200)
    }

    const domain = results[0].domain
    const website_url = `https://${domain}`

    // If company_id provided, update the company record directly
    if (company_id) {
      const { error } = await adminClient
        .from('companies')
        .update({ website_url })
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

    return jsonResponse({ website_url, domain })
  } catch (err) {
    return errorResponse(err)
  }
})
