export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4" role="status" aria-label="Loading data">
      <div className="h-8 w-48 rounded-lg bg-[var(--color-bg-tertiary)]" />
      <div className="h-4 w-64 rounded bg-[var(--color-bg-tertiary)]" />
      <div className="mt-6 space-y-px">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-[52px] rounded bg-[var(--color-bg-tertiary)]" />
        ))}
      </div>
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse space-y-4" role="status" aria-label="Loading data">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-32 rounded-xl border border-border bg-card p-5">
          <div className="h-4 w-32 rounded bg-[var(--color-bg-tertiary)]" />
          <div className="mt-3 h-3 w-48 rounded bg-[var(--color-bg-tertiary)]" />
        </div>
      ))}
    </div>
  )
}
