/**
 * Shared document status configuration — single source of truth.
 *
 * Used by DocumentViewerPage, ReportBuilderPage, DashboardPage, and anywhere
 * that needs to display a document status badge or label.
 */

import {
  Clock,
  CheckCircle2,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import type { DocumentStatus } from '@/types/database'

// ---------------------------------------------------------------------------
// Document status (draft / in_review / approved / delivered / rejected)
// ---------------------------------------------------------------------------

export interface DocStatusEntry {
  label: string
  /** Text-color class (DocumentViewerPage style) */
  textClassName: string
  /** Badge class with bg tint (ReportBuilderPage / DashboardPage style) */
  badgeClassName: string
  icon: LucideIcon
}

export const DOC_STATUS_CONFIG: Record<DocumentStatus, DocStatusEntry> = {
  draft: {
    label: 'Draft',
    textClassName: 'text-muted-foreground',
    badgeClassName: 'bg-muted text-muted-foreground',
    icon: Clock,
  },
  in_review: {
    label: 'In Review',
    textClassName: 'text-[var(--color-signal-amber)]',
    badgeClassName: 'bg-[var(--color-signal-amber)]/10 text-[var(--color-signal-amber)]',
    icon: Clock,
  },
  approved: {
    label: 'Approved',
    textClassName: 'text-[var(--color-signal-green)]',
    badgeClassName: 'bg-[var(--color-signal-green)]/10 text-[var(--color-signal-green)]',
    icon: CheckCircle2,
  },
  delivered: {
    label: 'Delivered',
    textClassName: 'text-[var(--color-accent)]',
    badgeClassName: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejected',
    textClassName: 'text-[var(--color-signal-red)]',
    badgeClassName: 'bg-[var(--color-signal-red)]/10 text-[var(--color-signal-red)]',
    icon: XCircle,
  },
}

/**
 * Convenience function matching the old getDocStatusBadge() signature.
 */
export function getDocStatusBadge(status: string): { label: string; className: string } {
  const entry = DOC_STATUS_CONFIG[status as DocumentStatus]
  if (entry) return { label: entry.label, className: entry.badgeClassName }
  return { label: status, className: 'bg-muted text-muted-foreground' }
}
