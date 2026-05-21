import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { KpiValue, KpiDefinition, Company } from '@/types/database'
import { formatKpiValue, formatConfidence, confidenceColor } from '@/lib/format'
import { CheckCircle2, Loader2, ClipboardCheck, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CompanyLogo } from '@/components/ui/company-logo'

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

export function ReviewPage({ embedded = false }: { embedded?: boolean }) {
  const queryClient = useQueryClient()
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set())
  const [bulkApproving, setBulkApproving] = useState(false)
  const [confidenceFilter, setConfidenceFilter] = useState<string>('all')

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

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return
    setBulkApproving(true)
    const ids = Array.from(selectedIds)
    for (const id of ids) {
      try {
        await approveMutation.mutateAsync(id)
      } catch {
        // continue with remaining
      }
    }
    setSelectedIds(new Set())
    setBulkApproving(false)
  }

  const handleFlag = (id: string) => {
    setFlaggedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        toast('Flag removed')
      } else {
        next.add(id)
        toast('Value flagged for re-extraction')
      }
      return next
    })
  }

  // Filter by confidence range
  const filteredItems = (reviewItems ?? []).filter((row) => {
    if (confidenceFilter === 'all') return true
    const c = row.confidence ?? 0
    if (confidenceFilter === 'low') return c < 0.65
    if (confidenceFilter === 'medium') return c >= 0.65 && c < 0.85
    if (confidenceFilter === 'high') return c >= 0.85
    return true
  })

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredItems.map((r) => r.id)))
    }
  }

  const pendingCount = reviewItems?.length ?? 0

  const content = (
    <>
      {!embedded && (
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
              className="rounded-full bg-[var(--color-signal-amber)]/10 px-3 py-1 text-[12px] font-semibold text-[var(--color-signal-amber)]"
            >
              {pendingCount} pending
            </span>
          )}
        </div>
      )}

      {embedded && !isLoading && pendingCount > 0 && (
        <div className="mb-4 flex justify-end">
          <span className="rounded-full bg-[var(--color-signal-amber)]/10 px-3 py-1 text-[12px] font-semibold text-[var(--color-signal-amber)]">
            {pendingCount} pending
          </span>
        </div>
      )}

      {/* Toolbar: Confidence filter + Bulk approve */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={confidenceFilter} onValueChange={(v) => v && setConfidenceFilter(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue>
              {confidenceFilter === 'all' ? 'All confidence' : confidenceFilter === 'low' ? 'Low (<65%)' : confidenceFilter === 'medium' ? 'Medium (65-85%)' : 'High (≥85%)'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All confidence</SelectItem>
            <SelectItem value="low">Low (&lt;65%)</SelectItem>
            <SelectItem value="medium">Medium (65-85%)</SelectItem>
            <SelectItem value="high">High (&ge;85%)</SelectItem>
          </SelectContent>
        </Select>

        {selectedIds.size > 0 && (
          <Button
            size="sm"
            onClick={handleBulkApprove}
            disabled={bulkApproving}
          >
            {bulkApproving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
            Approve selected ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* Table card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">

        {isLoading ? (
          <div className="p-8 space-y-px">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-[69px] skeleton-shimmer" />
            ))}
          </div>
        ) : !reviewItems || reviewItems.length === 0 ? (
          <EmptyReviewState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse" aria-label="KPI review">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="w-10 px-3 py-4">
                    <input
                      type="checkbox"
                      checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-border"
                      aria-label="Select all"
                    />
                  </th>
                  {['Company', 'KPI', 'Category', 'Raw Value', 'Normalized (CHF)', 'Confidence', 'Source', ''].map((h) => (
                    <th
                      scope="col"
                      key={h}
                      className={`px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground ${
                        h === '' ? 'w-36 text-right' : 'text-left'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredItems.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-b border-border transition-colors duration-200 last:border-0 hover:bg-[var(--color-bg-tertiary)] ${flaggedIds.has(row.id) ? 'bg-[var(--color-signal-amber)]/5' : ''}`}
                  >
                    {/* Select */}
                    <td className="w-10 px-3 py-5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleSelect(row.id)}
                        className="h-4 w-4 rounded border-border"
                        aria-label={`Select ${row.companies?.name ?? 'row'}`}
                      />
                    </td>

                    {/* Company */}
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <CompanyLogo logoUrl={row.companies?.logo_url} websiteUrl={row.companies?.website_url} name={row.companies?.name} size="xs" />
                        <div>
                          <div className="text-[13px] font-medium text-foreground">
                            {row.companies?.name ?? '—'}
                          </div>
                          {row.companies?.ticker && (
                            <div className="text-[11px] text-muted-foreground">{row.companies.ticker}</div>
                          )}
                        </div>
                      </div>
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

                    {/* Actions */}
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {flaggedIds.has(row.id) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-signal-amber)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--color-signal-amber)]">
                            <AlertTriangle className="h-3 w-3" />
                            Flagged
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleFlag(row.id)}
                          title={flaggedIds.has(row.id) ? 'Remove flag' : 'Flag for re-extraction'}
                        >
                          <AlertTriangle className={`h-3 w-3 ${flaggedIds.has(row.id) ? 'text-[var(--color-signal-amber)]' : ''}`} />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApprove(row.id)}
                          disabled={approvingId === row.id}
                        >
                          {approvingId === row.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          Approve
                        </Button>
                      </div>
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
    </>
  )

  if (embedded) return content

  return (
  <>
    <Helmet><title>Review Queue - Valrano</title><meta name="robots" content="noindex" /></Helmet>
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      {content}
    </div>
  </>
  )
}
