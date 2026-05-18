import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { ChatSession, ChatMessage } from '@/types/database'

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useChatSessions() {
  return useQuery({
    queryKey: ['chat-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('id, title, page_context, created_at, last_message_at')
        .order('last_message_at', { ascending: false })
      if (error) throw error
      return data as ChatSession[]
    },
  })
}

export function useChatMessages(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['chat-messages', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, session_id, role, content, created_at')
        .eq('session_id', sessionId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as ChatMessage[]
    },
    enabled: !!sessionId,
  })
}

// ---------------------------------------------------------------------------
// Streaming chat mutation
// ---------------------------------------------------------------------------

export function useSendMessage() {
  const queryClient = useQueryClient()
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const send = useCallback(async (params: {
    message: string
    session_id?: string
    page_context?: string
  }): Promise<{ session_id: string; response: string }> => {
    setIsStreaming(true)
    setStreamingText('')
    abortRef.current = new AbortController()

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params),
          signal: abortRef.current.signal,
        },
      )

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Chat failed' }))
        throw new Error(err.error || 'Chat failed')
      }

      if (!response.body) throw new Error('Response body is null')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      let sessionId = params.session_id ?? ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const parsed = JSON.parse(line.slice(6))
            if (parsed.type === 'session') {
              sessionId = parsed.session_id
            } else if (parsed.type === 'text') {
              fullText += parsed.text
              setStreamingText(fullText)
            }
          } catch {
            // skip
          }
        }
      }

      // Invalidate queries to pick up new messages
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['chat-messages', sessionId] })

      return { session_id: sessionId, response: fullText }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [queryClient])

  const abort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { send, abort, isStreaming, streamingText }
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useDeleteChatSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}
