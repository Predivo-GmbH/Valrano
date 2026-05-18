/**
 * Shared report status badge for uploaded report statuses
 * (extracted, reviewed, processing, pending, error).
 *
 * Replaces local StatusBadge / ReportStatusBadge in:
 * - CompanyProfilePage.tsx
 * - MyCompanyPage.tsx
 * - UploadedReportPage.tsx
 */

import { CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const REPORT_STATUS: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
  extracted: {
    icon: <CheckCircle2 className="h-3 w-3" />,
    label: 'Extracted',
    className: 'bg-[var(--color-signal-green)]/10 text-[var(--color-signal-green)]',
  },
  reviewed: {
    icon: <CheckCircle2 className="h-3 w-3" />,
    label: 'Reviewed',
    className: 'bg-[var(--color-signal-green)]/10 text-[var(--color-signal-green)]',
  },
  processing: {
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    label: 'Processing',
    className: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
  },
  pending: {
    icon: <Clock className="h-3 w-3" />,
    label: 'Pending',
    className: 'bg-muted text-muted-foreground',
  },
  error: {
    icon: <AlertCircle className="h-3 w-3" />,
    label: 'Error',
    className: 'bg-destructive/10 text-destructive',
  },
}

interface ReportStatusBadgeProps {
  status: string
  className?: string
}

export function ReportStatusBadge({ status, className }: ReportStatusBadgeProps) {
  const config = REPORT_STATUS[status] ?? REPORT_STATUS.pending
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
        config.className,
        className,
      )}
    >
      {config.icon} {config.label}
    </span>
  )
}
