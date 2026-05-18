/**
 * Dashboard utility functions — extracted from DashboardPage.tsx for reuse and testability.
 */

export { getDocStatusBadge } from '@/lib/status-config'

export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function getRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  const diffWeeks = Math.floor(diffDays / 7)
  if (diffWeeks < 5) return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`
  return `${Math.floor(diffMonths / 12)}y ago`
}

export function getCountdown(dateStr: string): string {
  const now = new Date()
  const target = new Date(dateStr)
  const diffMs = target.getTime() - now.getTime()
  if (diffMs < 0) {
    const daysAgo = Math.floor(Math.abs(diffMs) / 86400000)
    if (daysAgo === 0) return 'Today'
    return `${daysAgo}d overdue`
  }
  const days = Math.floor(diffMs / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 7) return `${days} days`
  if (days < 30) return `${Math.floor(days / 7)}w ${days % 7}d`
  return `${Math.floor(days / 30)}mo`
}

export function getEventStatusColor(status: string): string {
  switch (status) {
    case 'overdue': return 'text-[var(--color-signal-red)]'
    case 'due_today': return 'text-[var(--color-signal-amber)]'
    case 'detected': return 'text-[var(--color-signal-green)]'
    case 'ingested': return 'text-[var(--color-accent)]'
    case 'benchmark_ready': return 'text-[var(--color-primary)]'
    default: return 'text-muted-foreground'
  }
}

export function getEventStatusDot(status: string): string {
  switch (status) {
    case 'overdue': return 'bg-[var(--color-signal-red)]'
    case 'due_today': return 'bg-[var(--color-signal-amber)]'
    case 'detected': return 'bg-[var(--color-signal-green)]'
    case 'ingested': return 'bg-[var(--color-accent)]'
    case 'benchmark_ready': return 'bg-[var(--color-primary)]'
    default: return 'bg-muted-foreground'
  }
}

// getDocStatusBadge is re-exported from @/lib/status-config above
