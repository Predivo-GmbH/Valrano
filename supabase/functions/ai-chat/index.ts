import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse } from '../_shared/auth.ts'
import { logAnthropicUsage } from '../_shared/log-usage.ts'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { user, adminClient } = await authenticateRequest(req)
    const { message, page_context, session_id } = await req.json()

    if (!message) {
      return new Response(JSON.stringify({ error: 'Missing message' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // M2: Message length limit
    if (typeof message !== 'string' || message.length > 4000) {
      return new Response(JSON.stringify({ error: 'Message too long (max 4000 characters)' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // Original missing-message check removed — now handled above with length validation

    // ------------------------------------------------------------------
    // 1. Get or create session
    // ------------------------------------------------------------------
    let sessionId = session_id
    if (!sessionId) {
      const title = message.length > 60 ? message.slice(0, 57) + '...' : message
      const { data: newSession, error: sessError } = await adminClient
        .from('chat_sessions')
        .insert({ user_id: user.id, title, page_context: page_context ?? null })
        .select('id')
        .single()
      if (sessError) throw new Error(`Session create failed: ${sessError.message}`)
      sessionId = newSession.id
    } else {
      // Update last_message_at
      await adminClient
        .from('chat_sessions')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', sessionId)
    }

    // ------------------------------------------------------------------
    // 2. Save user message
    // ------------------------------------------------------------------
    await adminClient.from('chat_messages').insert({
      session_id: sessionId,
      role: 'user',
      content: message,
      citations: [],
    })

    // ------------------------------------------------------------------
    // 3. Load conversation history (last 10 turns)
    // ------------------------------------------------------------------
    const { data: history } = await adminClient
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(20)

    const conversationHistory = (history ?? []).map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    }))

    // ------------------------------------------------------------------
    // 4. Load context data based on page
    // ------------------------------------------------------------------
    let contextData = ''

    // Load accounting profile
    const { data: profile } = await adminClient
      .from('accounting_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profile) {
      contextData += `\nUser's Accounting Framework:\n`
      contextData += `- Standard: ${profile.accounting_standard}\n`
      contextData += `- Company: ${profile.company_name}\n`
      if (profile.policies) {
        contextData += `- Policies: ${JSON.stringify(profile.policies, null, 2)}\n`
      }
    }

    // Load ONLY the user's peer group companies (data isolation)
    const { data: visibleIds } = await adminClient
      .rpc('visible_company_ids_for_user', { p_user_id: user.id })

    if (visibleIds && visibleIds.length > 0) {
      const { data: companies } = await adminClient
        .from('companies')
        .select('id, name, ticker, sector')
        .in('id', visibleIds as string[])
        .eq('is_active', true)

      if (companies && companies.length > 0) {
        contextData += `\nPeer Companies (${companies.length}):\n`
        for (const c of companies) {
          contextData += `- ${c.name} (${c.ticker ?? 'N/A'}) — ${c.sector ?? 'N/A'}\n`
        }
      }

      // Load KPI data ONLY for user's peer group companies
      const { data: latestKpis } = await adminClient
        .from('kpi_values')
        .select('company_id, normalized_value, confidence, kpi_definitions(code, name, unit_type), companies(name)')
        .in('company_id', visibleIds as string[])
        .not('normalized_value', 'is', null)
        .order('fiscal_year', { ascending: false })
        .limit(200)

      if (latestKpis && latestKpis.length > 0) {
        contextData += `\nLatest KPI Data:\n`
        const byCompany = new Map<string, string[]>()
        for (const kpi of latestKpis as any[]) {
          const companyName = kpi.companies?.name ?? 'Unknown'
          const kpiCode = kpi.kpi_definitions?.code ?? 'Unknown'
          const line = `  ${kpiCode}: ${kpi.normalized_value} CHF (confidence: ${kpi.confidence ?? 'N/A'})`
          if (!byCompany.has(companyName)) byCompany.set(companyName, [])
          byCompany.get(companyName)!.push(line)
        }
        for (const [company, lines] of byCompany) {
          contextData += `${company}:\n${lines.join('\n')}\n`
        }
      }
    }

    // Page-specific context
    if (page_context === 'document' || page_context?.startsWith('document:')) {
      const docId = page_context.split(':')[1]
      if (docId) {
        const { data: doc } = await adminClient
          .from('benchmark_documents')
          .select('title, content_json, fiscal_year, customer_company_id, trigger_company:companies!benchmark_documents_trigger_company_id_fkey(name)')
          .eq('id', docId)
          .single()
        // M2: Verify user owns this document's company
        if (doc) {
          const { data: ownerCheck } = await adminClient
            .from('companies')
            .select('id')
            .eq('id', doc.customer_company_id)
            .eq('user_id', user.id)
            .single()
          if (!ownerCheck) {
            // User doesn't own this document — skip context loading
            return new Response(JSON.stringify({ error: 'Unauthorized document access' }), {
              status: 403,
              headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            })
          }
        }
        if (doc) {
          contextData += `\nCurrent Document: "${doc.title}" (FY ${doc.fiscal_year})\n`
          if (doc.content_json) {
            contextData += `Content: ${JSON.stringify(doc.content_json, null, 2)}\n`
          }
        }
      }
    }

    // ------------------------------------------------------------------
    // 5. Call Claude (streaming)
    // ------------------------------------------------------------------
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) throw new Error('ANTHROPIC_API_KEY is not set')

    const hasKpis = contextData.includes('Latest KPI Data')

    const systemPrompt = `You are a financial analyst assistant embedded in Valrano, a competitive benchmarking platform for the cement and building materials industry.

${profile ? `The user's company is "${profile.company_name}" using ${profile.accounting_standard} accounting standard.` : 'The user has not yet set up their accounting profile.'}

## Available Data
${contextData || 'No company or KPI data is available yet for this user.'}

## What You Can Help With
- Analyzing and comparing KPI data across peer companies (EBITDA, margins, ROIC, CapEx, CO2 intensity, etc.)
- Explaining accounting standards and adjustments (IFRS, US GAAP, local GAAP differences)
- Interpreting benchmark reports and financial trends
- Providing context on industry metrics and what good/bad values look like

## Scope
You are ONLY a financial analysis assistant. You help with KPI analysis, accounting standards, benchmarking, and interpreting financial data.
${!hasKpis ? `\nNote: No KPI data is available yet for this user. If they ask about their data, let them know you don't have any financial data to analyze yet.` : ''}

## Strict Rules — You MUST Follow These
- NEVER mention or reference a "Help Center", "Support Center", "knowledge base", or "documentation portal" — these do not exist
- NEVER tell users to "contact Valrano support" or "reach out to our team" — there is no support team
- NEVER invent, assume, or hallucinate features, pages, or resources that are not explicitly listed here
- If you don't know something about the app, say "I'm not sure about that specific feature" — do NOT guess
- You are ONLY a financial analysis assistant — if asked about account setup, app navigation, or non-financial topics, be straightforward: "I'm here to help with financial analysis and benchmarking. I can't help with that."
- Do NOT attempt to guide users through app setup, onboarding, or navigation — that is not your role
- Be concise and analytical — this is a professional financial tool
- Always cite specific numbers from the provided data when answering financial questions
- When comparing companies, highlight the most significant differences
- If asked about something outside the available data, clearly state what data is missing`

    // Retry with backoff for rate limits
    let claudeResponse: Response | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          stream: true,
          system: systemPrompt,
          messages: conversationHistory,
        }),
      })

      if (claudeResponse.status !== 429) break
      // Wait before retry: 2s, 5s
      const waitMs = attempt === 0 ? 2000 : 5000
      console.log(`Claude 429, retrying in ${waitMs}ms (attempt ${attempt + 1}/3)`)
      await new Promise((r) => setTimeout(r, waitMs))
    }

    if (!claudeResponse!.ok) {
      const errBody = await claudeResponse!.text()
      if (claudeResponse!.status === 429) {
        return new Response(
          JSON.stringify({ error: 'AI service is temporarily busy. Please try again in a moment.' }),
          { status: 429, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
        )
      }
      throw new Error(`Claude API error ${claudeResponse!.status}: ${errBody}`)
    }

    // ------------------------------------------------------------------
    // 6. Stream response back + collect full text for DB save
    // ------------------------------------------------------------------
    const responseHeaders = {
      ...getCorsHeaders(req),
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }

    let fullResponse = ''
    const encoder = new TextEncoder()
    const reader = claudeResponse!.body!.getReader()
    const decoder = new TextDecoder()

    const stream = new ReadableStream({
      async start(controller) {
        // Send session_id as first event
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'session', session_id: sessionId })}\n\n`))

        let buffer = ''
        let streamModel = 'claude-sonnet-4-6'
        let streamInputTokens = 0
        let streamOutputTokens = 0
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const data = line.slice(6)
              if (data === '[DONE]') continue

              try {
                const parsed = JSON.parse(data)
                if (parsed.type === 'message_start' && parsed.message) {
                  streamModel = parsed.message.model ?? streamModel
                  streamInputTokens = parsed.message.usage?.input_tokens ?? 0
                }
                if (parsed.type === 'message_delta' && parsed.usage) {
                  streamOutputTokens = parsed.usage.output_tokens ?? 0
                }
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  fullResponse += parsed.delta.text
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'text', text: parsed.delta.text })}\n\n`)
                  )
                }
              } catch {
                // Skip unparseable lines
              }
            }
          }

          // Save assistant message to DB (fire-and-forget after stream)
          await adminClient.from('chat_messages').insert({
            session_id: sessionId,
            role: 'assistant',
            content: fullResponse,
            citations: [],
          })

          await logAnthropicUsage('Valrano', 'ai-chat', {
            model: streamModel,
            usage: { input_tokens: streamInputTokens, output_tokens: streamOutputTokens },
          })

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
          controller.close()
        } catch (err) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: String(err) })}\n\n`)
          )
          controller.close()
        }
      },
    })

    return new Response(stream, { headers: responseHeaders })
  } catch (err) {
    console.error('ai-chat error:', err)
    return errorResponse(err)
  }
})
