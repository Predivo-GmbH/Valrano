import { useState, useRef, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import {
  MessageSquare,
  X,
  Send,
  Loader2,
  Trash2,
  Plus,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatSessions, useChatMessages, useSendMessage, useDeleteChatSession } from '@/hooks/useChat'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Suggested questions by page context
// ---------------------------------------------------------------------------
const SUGGESTIONS: Record<string, string[]> = {
  dashboard: [
    'What are the key takeaways from the latest peer data?',
    'Which competitor has improved the most this year?',
    'Are there any risk flags I should be aware of?',
  ],
  peers: [
    'Compare EBITDA margins across all peers',
    'Which peer has the strongest balance sheet?',
    'How does our peer group compare to the industry?',
  ],
  analytics: [
    'What trends do you see in our peer group?',
    'Which KPIs show the biggest YoY changes?',
  ],
  document: [
    'Summarize the key findings in this document',
    'What are the main risk flags?',
    'How does this compare to the previous period?',
  ],
}

function getPageContext(pathname: string): string {
  if (pathname.startsWith('/documents/')) return `document:${pathname.split('/')[2]}`
  if (pathname.startsWith('/dashboard')) return 'dashboard'
  if (pathname.startsWith('/peers')) return 'peers'
  if (pathname.startsWith('/analytics')) return 'analytics'
  return pathname.slice(1) || 'dashboard'
}

function getSuggestions(pathname: string): string[] {
  if (pathname.startsWith('/documents/')) return SUGGESTIONS.document
  for (const key of Object.keys(SUGGESTIONS)) {
    if (pathname.includes(key)) return SUGGESTIONS[key]
  }
  return SUGGESTIONS.dashboard
}

// ---------------------------------------------------------------------------
// Chat panel component
// ---------------------------------------------------------------------------
export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>()
  const [input, setInput] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const location = useLocation()

  const pageContext = getPageContext(location.pathname)
  const suggestions = getSuggestions(location.pathname)

  const { data: sessions } = useChatSessions()
  const { data: messages } = useChatMessages(activeSessionId)
  const { send, isStreaming, streamingText } = useSendMessage()
  const deleteSession = useDeleteChatSession()

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streamingText])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [isOpen])

  const handleSend = useCallback(async (text?: string) => {
    const messageText = text ?? input.trim()
    if (!messageText || isStreaming) return
    setInput('')

    try {
      const result = await send({
        message: messageText,
        session_id: activeSessionId,
        page_context: pageContext,
      })
      setActiveSessionId(result.session_id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send message')
    }
  }, [input, isStreaming, activeSessionId, pageContext, send])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNewChat = () => {
    setActiveSessionId(undefined)
    setShowHistory(false)
    setInput('')
  }

  const handleDeleteSession = async (id: string) => {
    try {
      await deleteSession.mutateAsync(id)
      if (activeSessionId === id) setActiveSessionId(undefined)
      toast.success('Chat deleted')
    } catch {
      toast.error('Failed to delete chat')
    }
  }

  return (
    <>
      {/* Toggle button — fixed bottom-right */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close AI assistant' : 'Open AI assistant'}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all duration-300',
          'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:scale-105',
          isOpen && 'rotate-90 opacity-0 pointer-events-none',
        )}
      >
        <MessageSquare className="h-5 w-5" />
      </button>

      {/* Panel */}
      <div
        className={cn(
          'fixed bottom-0 right-0 top-16 z-40 flex w-[400px] max-w-[100vw] flex-col border-l border-border bg-[var(--color-background)] shadow-2xl transition-transform duration-300',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
        role="complementary"
        aria-label="AI Assistant"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[var(--color-primary)]" />
            <span className="text-[14px] font-semibold text-foreground">AI Assistant</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleNewChat}
              aria-label="New chat"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--color-bg-tertiary)] hover:text-foreground transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              aria-label="Chat history"
              className={cn(
                'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition-colors',
                showHistory
                  ? 'bg-[var(--color-bg-tertiary)] text-foreground'
                  : 'text-muted-foreground hover:bg-[var(--color-bg-tertiary)] hover:text-foreground',
              )}
            >
              <ChevronDown className={cn('h-4 w-4 transition-transform', showHistory && 'rotate-180')} />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close AI assistant"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--color-bg-tertiary)] hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Session history dropdown */}
        {showHistory && (
          <div className="max-h-48 overflow-y-auto border-b border-border bg-[var(--color-bg-tertiary)]">
            {(!sessions || sessions.length === 0) ? (
              <p className="px-4 py-3 text-[12px] text-muted-foreground">No previous chats</p>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    'group flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors',
                    activeSessionId === s.id
                      ? 'bg-[var(--color-primary)]/10'
                      : 'hover:bg-[var(--color-background)]',
                  )}
                >
                  <button
                    onClick={() => { setActiveSessionId(s.id); setShowHistory(false) }}
                    className="flex-1 text-left"
                  >
                    <p className="truncate text-[13px] text-foreground">{s.title || 'New chat'}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(s.last_message_at).toLocaleDateString('en-CH', { day: '2-digit', month: 'short' })}
                    </p>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id) }}
                    className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-[var(--color-signal-red)]"
                    aria-label="Delete chat"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {(!messages || messages.length === 0) && !isStreaming ? (
            /* Empty state with suggestions */
            <div className="flex h-full flex-col items-center justify-center text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-4" />
              <p className="text-[14px] font-medium text-foreground mb-1">Ask me anything</p>
              <p className="text-[12px] text-muted-foreground mb-6">
                I have context about your peer companies, KPIs, and documents.
              </p>
              <div className="w-full space-y-2">
                {suggestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(q)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-left text-[12px] text-muted-foreground transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-foreground"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages?.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'max-w-[85%] rounded-lg px-3 py-2.5 text-[13px] leading-relaxed',
                    msg.role === 'user'
                      ? 'ml-auto bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                      : 'bg-[var(--color-bg-tertiary)] text-foreground',
                  )}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              ))}

              {/* Streaming response */}
              {isStreaming && streamingText && (
                <div className="max-w-[85%] rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-2.5 text-[13px] leading-relaxed text-foreground">
                  <div className="whitespace-pre-wrap">{streamingText}</div>
                  <span className="inline-block h-4 w-1 animate-pulse bg-foreground/50 ml-0.5" />
                </div>
              )}

              {isStreaming && !streamingText && (
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Thinking...
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2 rounded-lg border border-border bg-card px-3 py-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your benchmarking data..."
              aria-label="Message to AI assistant"
              rows={1}
              className="flex-1 resize-none bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none max-h-32"
              style={{ minHeight: '24px' }}
              disabled={isStreaming}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isStreaming}
              aria-label="Send message"
              className={cn(
                'flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-md transition-colors',
                input.trim() && !isStreaming
                  ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'text-muted-foreground',
              )}
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
            AI-powered analysis · Context: {pageContext.split(':')[0]}
          </p>
        </div>
      </div>

      {/* Backdrop on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 top-16 z-30 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  )
}
