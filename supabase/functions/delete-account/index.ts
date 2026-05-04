import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { sendEmail, accountDeletedEmail } from '../_shared/email.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { user, adminClient } = await authenticateRequest(req)

    // Cancel Stripe subscription if exists
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (stripeSecretKey) {
      try {
        const { data: subscription } = await adminClient
          .from('subscriptions')
          .select('stripe_subscription_id, stripe_customer_id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (subscription?.stripe_subscription_id) {
          await fetch(
            `https://api.stripe.com/v1/subscriptions/${subscription.stripe_subscription_id}`,
            { method: 'DELETE', headers: { Authorization: `Bearer ${stripeSecretKey}` } }
          )
        }

        if (subscription?.stripe_customer_id) {
          await fetch(
            `https://api.stripe.com/v1/customers/${subscription.stripe_customer_id}`,
            { method: 'DELETE', headers: { Authorization: `Bearer ${stripeSecretKey}` } }
          )
        }
      } catch (stripeErr) {
        console.error('Stripe cleanup failed (continuing):', stripeErr)
      }
    }

    // Delete user data from application tables (order matters for FK constraints)
    // alert_history → alerts → peer_group_members → peer_groups → user_profiles → subscriptions
    const { data: alerts } = await adminClient
      .from('alerts')
      .select('id')
      .eq('user_id', user.id)

    const alertIds = alerts?.map((a: { id: string }) => a.id) ?? []
    if (alertIds.length > 0) {
      await adminClient.from('alert_history').delete().in('alert_id', alertIds)
    }

    await adminClient.from('alerts').delete().eq('user_id', user.id)

    const { data: peerGroups } = await adminClient
      .from('peer_groups')
      .select('id')
      .eq('owner_id', user.id)

    const pgIds = peerGroups?.map((pg: { id: string }) => pg.id) ?? []
    if (pgIds.length > 0) {
      await adminClient.from('peer_group_members').delete().in('peer_group_id', pgIds)
    }

    await adminClient.from('peer_groups').delete().eq('owner_id', user.id)
    await adminClient.from('user_profiles').delete().eq('id', user.id)
    await adminClient.from('subscriptions').delete().eq('user_id', user.id)

    // Capture user info for confirmation email before deleting auth user
    const { data: { user: authUser } } = await adminClient.auth.admin.getUserById(user.id)
    const userEmail = authUser?.email
    const userName = authUser?.user_metadata?.full_name ?? 'there'

    // Delete the auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)
    if (deleteError) {
      console.error('Failed to delete user:', deleteError)
      return jsonResponse({ error: 'Failed to delete account' }, 500)
    }

    // Send confirmation email (best-effort)
    if (userEmail) {
      try {
        const template = accountDeletedEmail(userName)
        await sendEmail({ to: userEmail, ...template })
      } catch (emailErr) {
        console.error('Failed to send deletion email:', emailErr)
      }
    }

    return jsonResponse({ success: true })
  } catch (err) {
    return errorResponse(err)
  }
})
