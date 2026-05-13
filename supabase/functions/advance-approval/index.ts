import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { user, adminClient } = await authenticateRequest(req)

    const { document_id, action, comments } = await req.json()
    if (!document_id) {
      return jsonResponse({ error: 'Missing required field: document_id' }, 400)
    }
    if (!action || !['approve', 'request_changes'].includes(action)) {
      return jsonResponse({ error: 'Invalid action. Must be "approve" or "request_changes"' }, 400)
    }

    // 1. Load the current approval step (status = 'in_review')
    const { data: currentStep, error: stepError } = await adminClient
      .from('approval_steps')
      .select('*')
      .eq('document_id', document_id)
      .eq('status', 'in_review')
      .order('step_number', { ascending: true })
      .limit(1)
      .single()

    if (stepError) {
      return jsonResponse({ error: 'No active approval step found for this document' }, 404)
    }

    // Ownership check: user must be the assignee for this step
    if (currentStep.assignee_id && currentStep.assignee_id !== user.id) {
      return jsonResponse({ error: 'You are not assigned to this approval step' }, 403)
    }

    const now = new Date().toISOString()

    if (action === 'approve') {
      // Mark current step as approved
      await adminClient
        .from('approval_steps')
        .update({
          status: 'approved',
          assignee_id: user.id,
          reviewed_at: now,
          comments: comments ?? null,
        })
        .eq('id', currentStep.id)

      // Check if there's a next step
      const { data: nextStep } = await adminClient
        .from('approval_steps')
        .select('*')
        .eq('document_id', document_id)
        .eq('status', 'pending')
        .order('step_number', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (nextStep) {
        // Advance to next step
        await adminClient
          .from('approval_steps')
          .update({ status: 'in_review' })
          .eq('id', nextStep.id)

        // Create notification for the next assignee
        if (nextStep.assignee_id) {
          await adminClient.from('notifications').insert({
            user_id: nextStep.assignee_id,
            type: 'approval_assigned',
            title: 'Document awaiting your review',
            body: `A benchmark document requires your approval (step ${nextStep.step_number}).`,
            link: `/documents/${document_id}`,
            related_document_id: document_id,
          })
        }

        return jsonResponse({
          success: true,
          document_status: 'in_review',
          current_step_id: nextStep.id,
          current_step_number: nextStep.step_number,
        })
      } else {
        // Final step approved — mark document as approved
        await adminClient
          .from('benchmark_documents')
          .update({ status: 'approved' })
          .eq('id', document_id)

        // Notify document creator
        const { data: doc } = await adminClient
          .from('benchmark_documents')
          .select('created_at, benchmark_rule_id, benchmark_rules(created_by)')
          .eq('id', document_id)
          .single()

        const creatorId = (doc?.benchmark_rules as { created_by: string | null } | null)?.created_by
        if (creatorId) {
          await adminClient.from('notifications').insert({
            user_id: creatorId,
            type: 'approval_action',
            title: 'Document approved',
            body: 'Your benchmark document has been fully approved.',
            link: `/documents/${document_id}`,
            related_document_id: document_id,
          })
        }

        return jsonResponse({
          success: true,
          document_status: 'approved',
        })
      }
    } else {
      // action === 'request_changes'
      await adminClient
        .from('approval_steps')
        .update({
          status: 'changes_requested',
          assignee_id: user.id,
          reviewed_at: now,
          comments: comments ?? null,
        })
        .eq('id', currentStep.id)

      // Mark document as rejected
      await adminClient
        .from('benchmark_documents')
        .update({ status: 'rejected' })
        .eq('id', document_id)

      // Notify document creator
      const { data: doc } = await adminClient
        .from('benchmark_documents')
        .select('benchmark_rules(created_by)')
        .eq('id', document_id)
        .single()

      const creatorId = (doc?.benchmark_rules as { created_by: string | null } | null)?.created_by
      if (creatorId) {
        await adminClient.from('notifications').insert({
          user_id: creatorId,
          type: 'approval_action',
          title: 'Changes requested on document',
          body: comments
            ? `Changes requested: ${comments}`
            : 'Changes have been requested on your benchmark document.',
          link: `/documents/${document_id}`,
          related_document_id: document_id,
        })
      }

      return jsonResponse({
        success: true,
        document_status: 'rejected',
        comments: comments ?? null,
      })
    }
  } catch (err) {
    return errorResponse(err)
  }
})
