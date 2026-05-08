import React from 'react'

export interface MetricCardProps {
  icon: React.ReactNode
  label: string
  value: string
  subtitle: string
  accentColor: string
}

export const MetricCard = React.memo(function MetricCard({ icon, label, value, subtitle, accentColor }: MetricCardProps) {
  return (
    <div className="card-premium rounded-xl border border-border bg-card p-5 flex flex-col gap-1">
      <div className="flex items-center gap-2 mb-1">
        <div className={`flex items-center justify-center h-7 w-7 rounded-lg ${accentColor}`}>
          {icon}
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="text-[24px] font-bold leading-tight text-foreground tabular-nums">
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground">
        {subtitle}
      </div>
    </div>
  )
})
