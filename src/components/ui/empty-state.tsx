import type { ReactNode } from 'react'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  actionIcon?: ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-bg-tertiary)] text-muted-foreground">
        {icon ?? <FileText className="h-6 w-6" />}
      </div>
      <h3 className="text-[15px] font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-[13px] text-muted-foreground max-w-sm mb-5">{description}</p>
      {actionLabel && onAction && (
        <Button size="sm" onClick={onAction} className="gap-1.5">
          {actionIcon}
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
