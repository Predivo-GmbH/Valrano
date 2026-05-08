import React from 'react'
import { formatKpiValue } from '@/lib/format'

export interface KpiSnapshotCardProps {
  name: string
  value: number
  unitType: string
  percentile: number
}

export const KpiSnapshotCard = React.memo(function KpiSnapshotCard({ name, value, unitType, percentile }: KpiSnapshotCardProps) {
  const barColor =
    percentile >= 66
      ? 'bg-[var(--color-signal-green)]'
      : percentile >= 33
      ? 'bg-[var(--color-signal-amber)]'
      : 'bg-[var(--color-signal-red)]'

  return (
    <div className="card-premium rounded-xl border border-border bg-card p-4 min-w-[180px] flex-1">
      <div className="text-[11px] text-muted-foreground font-medium mb-1 truncate">{name}</div>
      <div className="text-[15px] font-semibold text-foreground tabular-nums mb-2">
        {formatKpiValue(value, unitType)}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${percentile}%` }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">P{percentile}</span>
      </div>
    </div>
  )
})
