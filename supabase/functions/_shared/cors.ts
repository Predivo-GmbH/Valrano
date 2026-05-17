const ALLOWED_ORIGINS = [
  'https://valrano.com',
  'http://localhost:5173',
]

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

// Static export for simple cases
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://valrano.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * Handle CORS preflight. Use at the top of every edge function:
 *
 *   if (req.method === 'OPTIONS') {
 *     return new Response('ok', { headers: getCorsHeaders(req) })
 *   }
 */
