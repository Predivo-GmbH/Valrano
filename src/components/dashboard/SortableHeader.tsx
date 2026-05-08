import React from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export type SortConfig = {
  columnId: string | null
  direction: 'asc' | 'desc'
}

export interface SortableHeaderProps {
  label: string
  columnId: string
  sortConfig: SortConfig
  onSort: (columnId: string) => void
  description?: string | null
}

export const SortableHeader = React.memo(function SortableHeader({
  label,
  columnId,
  sortConfig,
  onSort,
  description,
}: SortableHeaderProps) {
  const isActive = sortConfig.columnId === columnId
  const SortIcon = isActive
    ? sortConfig.direction === 'asc'
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown

  const btnClass = `inline-flex items-center gap-1 cursor-pointer bg-transparent border-none p-0 text-[10px] font-semibold uppercase tracking-[0.06em] transition-colors duration-150 min-h-[44px] md:min-h-0 text-right ${
    isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
  }`
  const iconClass = `h-2.5 w-2.5 flex-shrink-0 ${isActive ? 'opacity-100 text-foreground' : 'opacity-30 text-muted-foreground'}`

  if (description) {
    return (
      <th className="px-2 py-2 text-right">
        <Tooltip>
          <TooltipTrigger className={btnClass} onClick={() => onSort(columnId)} aria-label={`Sort by ${label}`}>
            {label}
            <SortIcon className={iconClass} />
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="max-w-[220px] rounded-lg border border-border bg-[var(--color-bg-elevated)] px-3 py-2 text-[11px] text-muted-foreground shadow-none"
          >
            {description}
          </TooltipContent>
        </Tooltip>
      </th>
    )
  }

  return (
    <th className="px-2 py-2 text-right">
      <button onClick={() => onSort(columnId)} className={btnClass} aria-label={`Sort by ${label}`}>
        {label}
        <SortIcon className={iconClass} />
      </button>
    </th>
  )
})
