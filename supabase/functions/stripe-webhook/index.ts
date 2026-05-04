/**
 * stripe-webhook — Handles Stripe webhook events for BenchmarkSignal.
 * Syncs subscription state to the `subscriptions` table.
 *
 * Events: checkout.session.completed, customer.subscription.updated,
 *         customer.subscription.deleted, invoice.paid, invoice.payment_failed
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')
if (!STRIPE_WEBHOOK_SECRET) throw new Error('Missing STRIPE_WEBHOOK_SECRET')

const MAX_TIMESTAMP_AGE_S = 300 // 5 minutes — Stripe standard

async function verifySignature(body: string, signature: string): Promise<boolean> {
  const parts = signature.split(',')
  const timestamp = parts.find((p) => p.startsWith('t='))?.slice(2)
  const v1Sig = parts.find((p) => p.startsWith('v1='))?.slice(3)
  if (!timestamp || !v1Sig) return false

  // Reject replayed events older than 5 minutes
  const age = Math.floor(Date.now() / 1000) - Number(timestamp)
  if (Number.isNaN(age) || age > MAX_TIMESTAMP_AGE_S) return false

  const payload = `${timestamp}.${body}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(STRIPE_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))

  // Timing-safe comparison
  const expectedBytes = new Uint8Array(sig)
  const receivedHex = v1Sig.match(/.{2}/g)
  if (!receivedHex || receivedHex.length !== expectedBytes.length) return false
  const receivedBytes = new Uint8Array(receivedHex.map((h) => parseInt(h, 16)))

  let result = 0
  for (let i = 0; i < expectedBytes.length; i++) {
    result |= expectedBytes[i] ^ receivedBytes[i]
  }
  return result === 0
}

function tierFromProductId(productId: string): string {
  const map: Record<string, string> = {
    'prod_USLURy91PhLmay': 'starter',
    'prod_USLVnq8sZNUW9K': 'professional',
    'prod_USLV3SOECaWbqX': 'enterprise',
  }
  return map[productId] ?? 'starter'
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const body = await req.text()
  const signature = req.headers.get('stripe-signature')
  if (!signature || !(await verifySignature(body, signature))) {
    return new Response('Invalid signature', { status: 400 })
  }

  const event = JSON.parse(body)
  const sbUrl = Deno.env.get('SUPABASE_URL')
  const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!sbUrl || !sbKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  const adminClient = createClient(sbUrl, sbKey)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.mode !== 'subscription') break
        const customerId = session.customer
        const subscriptionId = session.subscription
        const userId = session.client_reference_id ?? session.metadata?.user_id
        if (!userId) break

        // Fetch subscription details from Stripe
        const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
        if (!stripeKey) throw new Error('Missing STRIPE_SECRET_KEY')
        const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
          headers: { Authorization: `Bearer ${stripeKey}` },
        })
        const sub = await subRes.json()
        const productId = sub.items?.data?.[0]?.price?.product
        const tier = tierFromProductId(productId)

        await adminClient.from('subscriptions').upsert({
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          tier,
          status: sub.status,
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        }, { onConflict: 'user_id' })
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const { data: existing } = await adminClient
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', sub.id)
          .maybeSingle()

        if (!existing) break

        const productId = sub.items?.data?.[0]?.price?.product
        const tier = productId ? tierFromProductId(productId) : undefined

        await adminClient
          .from('subscriptions')
          .update({
            status: sub.status,
            ...(tier && { tier }),
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          })
          .eq('stripe_subscription_id', sub.id)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object
        if (!invoice.subscription) break
        await adminClient
          .from('subscriptions')
          .update({ status: 'active' })
          .eq('stripe_subscription_id', invoice.subscription)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        if (!invoice.subscription) break
        await adminClient
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_subscription_id', invoice.subscription)
        break
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response(JSON.stringify({ error: 'Webhook handler failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
