import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'

/**
 * suggest-ir-url — AI-powered IR page discovery
 *
 * Given a company name, finds the investor relations page URL.
 * Validates it exists via HEAD request, then stores it on the company record.
 *
 * Uses Claude to construct the most likely IR URL, then validates it.
 */

// AI suggestion limits per tier per month
const TIER_LIMITS: Record<string, number> = {
  starter: 5,
  professional: 50,
  enterprise: 999,
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { user, adminClient } = await authenticateRequest(req)

    const { company_id, company_name } = await req.json()
    if (!company_id || !company_name) {
      return jsonResponse({ error: 'Missing required fields: company_id, company_name' }, 400)
    }

    // ------------------------------------------------------------------
    // 1. Check if company already has an IR URL
    // ------------------------------------------------------------------
    const { data: company } = await adminClient
      .from('companies')
      .select('ir_page_url')
      .eq('id', company_id)
      .single()

    if (company?.ir_page_url) {
      return jsonResponse({
        ir_page_url: company.ir_page_url,
        source: 'existing',
        validated: true,
      })
    }

    // ------------------------------------------------------------------
    // 2. Check subscription tier + usage limits
    // ------------------------------------------------------------------
    const { data: subscription } = await adminClient
      .from('subscriptions')
      .select('tier')
      .eq('user_id', user.id)
      .maybeSingle()

    const tier = subscription?.tier ?? 'starter'
    const limit = TIER_LIMITS[tier] ?? 5

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { count: usageCount } = await adminClient
      .from('ai_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('feature', 'suggest_ir_url')
      .gte('created_at', startOfMonth.toISOString())

    const used = usageCount ?? 0
    if (used >= limit) {
      return jsonResponse({
        error: 'Monthly AI suggestion limit reached',
        limit,
        used,
        tier,
      }, 429)
    }

    // ------------------------------------------------------------------
    // 3. Call Claude to find the IR page URL
    // ------------------------------------------------------------------
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) throw new Error('ANTHROPIC_API_KEY is not set')

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        tools: [
          {
            name: 'suggest_ir_url',
            description: 'Suggest the investor relations page URL for a company',
            input_schema: {
              type: 'object',
              properties: {
                ir_page_url: {
                  type: 'string',
                  description: 'The most likely investor relations page URL',
                },
                alternative_urls: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Alternative URLs to try if the primary fails',
                },
                confidence: {
                  type: 'number',
                  minimum: 0,
                  maximum: 1,
                },
              },
              required: ['ir_page_url', 'confidence'],
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'suggest_ir_url' },
        messages: [
          {
            role: 'user',
            content: `What is the investor relations page URL for "${company_name}"?

This is a building materials / construction industry company. I need the URL to the main investor relations landing page where they publish annual reports, quarterly results, and financial publications.

Common patterns:
- https://www.company.com/investors
- https://www.company.com/investor-relations
- https://www.company.com/en/investors
- https://investors.company.com

Return the most likely URL. Only return URLs you are confident about — these will be validated.`,
          },
        ],
      }),
    })

    if (!claudeResponse.ok) {
      const errBody = await claudeResponse.text()
      throw new Error(`Claude API error ${claudeResponse.status}: ${errBody}`)
    }

    const claudeJson = await claudeResponse.json()
    const toolUseBlock = claudeJson.content?.find(
      (block: { type: string }) => block.type === 'tool_use',
    )

    if (!toolUseBlock) {
      throw new Error('Claude did not return a suggestion')
    }

    const suggestion = toolUseBlock.input as {
      ir_page_url: string
      alternative_urls?: string[]
      confidence: number
    }

    // ------------------------------------------------------------------
    // 4. Validate the URL via HEAD request
    // ------------------------------------------------------------------
    let validatedUrl: string | null = null
    const urlsToTry = [suggestion.ir_page_url, ...(suggestion.alternative_urls ?? [])]

    for (const url of urlsToTry) {
      try {
        const resp = await fetch(url, {
          method: 'HEAD',
          redirect: 'follow',
          signal: AbortSignal.timeout(5000),
        })
        if (resp.ok || resp.status === 405) {
          // 405 = method not allowed but page exists
          validatedUrl = url
          break
        }
      } catch {
        // Try next URL
      }
    }

    // ------------------------------------------------------------------
    // 5. Store on company if validated
    // ------------------------------------------------------------------
    if (validatedUrl) {
      await adminClient
        .from('companies')
        .update({ ir_page_url: validatedUrl })
        .eq('id', company_id)
    }

    // ------------------------------------------------------------------
    // 6. Track usage
    // ------------------------------------------------------------------
    await adminClient.from('ai_usage').insert({
      user_id: user.id,
      feature: 'suggest_ir_url',
      model_used: 'claude-haiku-4-5-20251001',
      input_tokens: claudeJson.usage?.input_tokens ?? 0,
      output_tokens: claudeJson.usage?.output_tokens ?? 0,
    })

    return jsonResponse({
      ir_page_url: validatedUrl ?? suggestion.ir_page_url,
      validated: !!validatedUrl,
      confidence: suggestion.confidence,
      stored: !!validatedUrl,
      usage: {
        used: used + 1,
        limit,
        tier,
        remaining: limit - used - 1,
      },
    })
  } catch (err) {
    return errorResponse(err)
  }
})
