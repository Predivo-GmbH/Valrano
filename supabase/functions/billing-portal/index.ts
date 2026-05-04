import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { user, adminClient } = await authenticateRequest(req)
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) throw new Error('Missing STRIPE_SECRET_KEY')

    const { data: subscription } = await adminClient
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!subscription?.stripe_customer_id) {
      return jsonResponse({ error: 'No active subscription found' }, 404)
    }

    const appUrl = Deno.env.get('APP_URL') ?? 'https://benchmarksignal.predivo.ch'

    const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: subscription.stripe_customer_id,
        return_url: `${appUrl}/dashboard`,
      }),
    })

    const session = await res.json()
    if (!res.ok) throw new Error(session.error?.message ?? 'Portal creation failed')

    return jsonResponse({ url: session.url })
  } catch (err) {
    return errorResponse(err)
  }
})
