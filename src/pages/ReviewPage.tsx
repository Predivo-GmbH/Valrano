import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { KpiValue, KpiDefinition, Company } from '@/types/database'
import { formatKpiValue, formatConfidence, confidenceColor } from '@/lib/format'
import { CheckCircle2, Loader2, ClipboardCheck } from 'lucide-react'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReviewRow = KpiValue & {
  kpi_definitions: KpiDefinition
  companies: Company
}

// ---------------------------------------------------------------------------
// Confidence badge
// ---------------------------------------------------------------------------

function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  const colorClass = confidenceColor(confidence)
  const label = formatConfidence(confidence)

  let bgClass = 'bg-muted/30'
  if (confidence !== null) {
    if (confidence >= 0.85) bgClass = 'bg-[var(--color-signal-green)]/10'
    else if (confidence >= 0.65) bgClass = 'bg-[var(--color-signal-amber)]/10'
    else bgClass = 'bg-[var(--color-signal-red)]/10'
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums ${bgClass} ${colorClass}`}
    >
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyReviewState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="mb-4 rounded-full bg-[var(--color-bg-tertiary)] p-4">
        <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-[15px] font-semibold text-foreground">Review queue is empty</h3>
      <p className="text-[13px] text-muted-foreground max-w-sm">
        All extracted KPI values have been reviewed. New values appear here when confidence is below threshold.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main review page
// ---------------------------------------------------------------------------

export function ReviewPage() {
  const queryClient = useQueryClient()
  const [approvingId, setApprovingId] = useState<string | null>(null)

  // Fetch all KPI values that need review
  const { data: reviewItems, isLoading } = useQuery({
    queryKey: ['review-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpi_values')
        .select('*, kpi_definitions(*), companies(*)')
        .eq('needs_review', true)
        .order('confidence', { ascending: true })
      if (error) throw error
      return data as ReviewRow[]
    },
  })

  // Approve mutation — sets needs_review = false
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('kpi_values')
        .update({ needs_review: false, reviewed_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, id) => {
      queryClient.setQueryData<ReviewRow[]>(['review-queue'], (prev) =>
        prev?.filter((r) => r.id !== id) ?? [],
      )
      toast.success('Value approved')
      setApprovingId(null)
    },
    onError: () => {
      toast.error('Failed to approve — try again')
      setApprovingId(null)
    },
  })

  const handleApprove = async (id: string) => {
    setApprovingId(id)
    await approveMutation.mutateAsync(id)
  }

  const pendingCount = reviewItems?.length ?? 0

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-8">

      {/* Header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">
            Review Queue
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            KPI values with low extraction confidence require manual verification.
          </p>
        </div>

        {!isLoading && pendingCount > 0 && (
          <span
            className="rounded-full px-3 py-1 text-[12px] font-semibold"
            style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}
          >
            {pendingCount} pending
          </span>
        )}
      </div>

      {/* Table card */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">

        {isLoading ? (
          <div className="p-8 space-y-px animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-[69px] rounded bg-[var(--color-bg-tertiary)]" />
            ))}
          </div>
        ) : !reviewItems || reviewItems.length === 0 ? (
          <EmptyReviewState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse">
              <thead>
                <tr className="border-b border-border">
                  {['Company', 'KPI', 'Category', 'Raw Value', 'Normalized (CHF)', 'Confidence', 'Source', ''].map((h) => (
                    <th
                      key={h}
                      className={`px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground ${
                        h === '' ? 'w-28 text-right' : 'text-left'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {reviewItems.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border transition-colors duration-200 last:border-0 hover:bg-[var(--color-bg-tertiary)]"
                  >
                    {/* Company */}
                    <td className="px-6 py-5">
                      <div className="text-[13px] font-medium text-foreground">
                        {row.companies?.name ?? '—'}
                      </div>
                      {row.companies?.ticker && (
                        <div className="text-[11px] text-muted-foreground">{row.companies.ticker}</div>
                      )}
                    </td>

                    {/* KPI name */}
                    <td className="px-6 py-5">
                      <div className="text-[13px] text-foreground">
                        {row.kpi_definitions?.name ?? '—'}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {row.kpi_definitions?.code ?? ''}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-6 py-5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                        {row.kpi_definitions?.category ?? '—'}
                      </span>
                    </td>

                    {/* Raw value */}
                    <td className="px-6 py-5">
                      <div className="text-[13px] tabular-nums text-foreground">
                        {row.raw_value !== null
                          ? formatKpiValue(row.raw_value, row.kpi_definitions?.unit_type ?? 'number')
                          : '—'}
                      </div>
                      {row.raw_currency && (
                        <div className="text-[11px] text-muted-foreground">{row.raw_currency}</div>
                      )}
                    </td>

                    {/* Normalized value */}
                    <td className="px-6 py-5">
                      <div className="text-[13px] tabular-nums text-foreground">
                        {row.normalized_value !== null
                          ? formatKpiValue(row.normalized_value, row.kpi_definitions?.unit_type ?? 'number')
                          : '—'}
                      </div>
                      <div className="text-[11px] text-muted-foreground">CHF</div>
                    </td>

                    {/* Confidence */}
                    <td className="px-6 py-5">
                      <ConfidenceBadge confidence={row.confidence} />
                    </td>

                    {/* Source text snippet */}
                    <td className="px-6 py-5 max-w-[260px]">
                      {row.source_text ? (
                        <div>
                          <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2">
                            "{row.source_text}"
                          </p>
                          {row.source_page && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground/60">
                              p.{row.source_page}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-[12px] text-muted-foreground/40">No source</span>
                      )}
                    </td>

                    {/* Approve action */}
                    <td className="px-6 py-5 text-right">
                      <button
                        onClick={() => handleApprove(row.id)}
                        disabled={approvingId === row.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-signal-green)]/40 bg-[var(--color-signal-green)]/10 px-3 py-1.5 text-[11px] font-semibold text-[var(--color-signal-green)] transition-all duration-200 hover:bg-[var(--color-signal-green)]/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {approvingId === row.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        Approve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer note */}
      {!isLoading && pendingCount > 0 && (
        <p className="mt-4 text-[11px] text-muted-foreground">
          Approved values are immediately reflected in the Dashboard peer comparison table.
        </p>
      )}
    </div>
  )
}
