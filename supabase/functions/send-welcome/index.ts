import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'
import { sendEmail, welcomeEmail } from '../_shared/email.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { adminClient, user } = await authenticateRequest(req)

    const { data: { user: authUser }, error } = await adminClient.auth.admin.getUserById(user.id)
    if (error || !authUser?.email) {
      return jsonResponse({ sent: false, reason: 'User not found' })
    }

    const userName = authUser.user_metadata?.full_name ?? 'there'
    const template = welcomeEmail(userName)

    await sendEmail({
      to: authUser.email,
      subject: template.subject,
      html: template.html,
    })

    return jsonResponse({ sent: true })
  } catch (err) {
    return errorResponse(err)
  }
})
