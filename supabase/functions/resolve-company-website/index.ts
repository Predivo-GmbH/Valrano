import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

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

    // Call Brandfetch Search API
    const resp = await fetch(
      `https://api.brandfetch.io/v2/search/${encodeURIComponent(name.trim())}?c=${brandfetchClientId}`,
      { signal: AbortSignal.timeout(5000) },
    )

    if (!resp.ok) {
      console.error('Brandfetch API error:', resp.status, await resp.text())
      return jsonResponse({ website_url: null, domain: null }, 200)
    }

    const results = await resp.json() as Array<{ name: string; domain: string; icon: string | null }>

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
