const ALLOWED_ORIGINS = [
  'https://benchmarksignal.predivo.ch',
  'http://localhost:5173',
]

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

// Static export for simple cases
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://benchmarksignal.predivo.ch',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Handle CORS preflight. Use at the top of every edge function:
 *
 *   if (req.method === 'OPTIONS') {
 *     return new Response('ok', { headers: getCorsHeaders(req) })
 *   }
 */
