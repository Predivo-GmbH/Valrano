import React from 'react'
import { formatKpiValue } from '@/lib/format'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Company, KpiDefinition, KpiValue } from '@/types/database'

export type KpiValueWithJoins = KpiValue & {
  kpi_definitions: KpiDefinition
  companies: Company
}

export interface KpiCellProps {
  value: KpiValueWithJoins | undefined
  signalClass: string
  unitType: string
}

export const KpiCell = React.memo(function KpiCell({ value, signalClass, unitType }: KpiCellProps) {
  if (!value) {
    return (
      <td className="px-2 py-2 text-[12px] text-muted-foreground/25 tabular-nums text-right select-none">
        ·
      </td>
    )
  }

  const formatted = formatKpiValue(value.normalized_value, unitType)
  const rawLabel = value.raw_currency && value.raw_value !== null
    ? `${value.raw_currency} ${formatKpiValue(value.raw_value, unitType)}`
    : null
  const sourcePage = value.source_page ? `p.${value.source_page}` : null

  return (
    <td className="px-2 py-2 text-right">
      <Tooltip>
        <TooltipTrigger
          className={`cursor-default bg-transparent border-none p-0 text-[12px] tabular-nums transition-colors duration-200 ${signalClass}`}
        >
          {formatted}
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs rounded-lg border border-border bg-[var(--color-bg-elevated)] px-3 py-2 text-[11px] text-foreground shadow-none"
        >
          <div className="space-y-1">
            {rawLabel && (
              <div className="text-muted-foreground">
                Original: <span className="text-foreground font-medium">{rawLabel}</span>
              </div>
            )}
            {sourcePage && (
              <div className="text-muted-foreground">
                Source: <span className="text-foreground font-medium">{sourcePage}</span>
              </div>
            )}
            {value.source_text && (
              <div className="text-muted-foreground border-t border-border pt-1 mt-1 leading-relaxed">
                "{value.source_text.slice(0, 120)}{value.source_text.length > 120 ? '...' : ''}"
              </div>
            )}
            {value.needs_review && (
              <div className="text-[var(--color-signal-amber)] font-medium">Needs review</div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </td>
  )
})
