import { useState, useRef, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useNotifications, useUnreadCount, useMarkAsRead, useMarkAllAsRead } from '@/hooks/useNotifications'
import type { NotificationType } from '@/types/database'

const TYPE_LABELS: Record<NotificationType, string> = {
  report_detected: 'Report Detected',
  document_generated: 'Document Generated',
  approval_assigned: 'Approval Assigned',
  approval_action: 'Approval Action',
  document_delivered: 'Document Delivered',
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { data: notifications } = useNotifications()
  const { data: unreadCount } = useUnreadCount()
  const markAsRead = useMarkAsRead()
  const markAllAsRead = useMarkAllAsRead()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const count = unreadCount ?? 0

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ''}`}
        aria-expanded={open}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-[var(--color-bg-tertiary)] hover:text-foreground"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {count > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-destructive)] px-1 text-[10px] font-bold text-[var(--color-destructive-foreground)]">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Notifications"
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); return }
            if (e.key === 'Tab') {
              const focusable = e.currentTarget.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
              )
              if (focusable.length === 0) return
              const first = focusable[0]
              const last = focusable[focusable.length - 1]
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault()
                last.focus()
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault()
                first.focus()
              }
            }
          }}
          className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-card shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {count > 0 && (
              <button
                onClick={() => markAllAsRead.mutate()}
                className="text-xs font-medium text-[var(--color-accent)] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {(notifications ?? []).length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications yet
              </div>
            ) : (
              (notifications ?? []).slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  className={`border-b border-border px-4 py-3 transition-colors last:border-b-0 ${
                    n.is_read ? '' : 'bg-[var(--color-accent)]/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[var(--color-accent)]">
                          {TYPE_LABELS[n.type]}
                        </span>
                        {!n.is_read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
                        )}
                      </div>
                      <p className="mt-0.5 text-sm font-medium text-foreground">{n.title}</p>
                      {n.body && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                      )}
                      <span className="mt-1 block text-[10px] text-muted-foreground">
                        {new Date(n.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {!n.is_read && (
                      <button
                        onClick={() => markAsRead.mutate(n.id)}
                        aria-label={`Mark "${n.title}" as read`}
                        className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        Read
                      </button>
                    )}
                  </div>
                  {n.link && (
                    <Link
                      to={n.link}
                      onClick={() => {
                        if (!n.is_read) markAsRead.mutate(n.id)
                        setOpen(false)
                      }}
                      className="mt-1 inline-block text-xs font-medium text-[var(--color-accent)] hover:underline"
                    >
                      View →
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer: show count hint when there are 20 notifications */}
          {(notifications ?? []).length >= 20 && (
            <div className="border-t border-border px-4 py-2 text-center">
              <span className="text-[10px] text-muted-foreground">Showing latest 20 notifications</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
