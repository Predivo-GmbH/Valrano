import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { useBenchmarkDocument, useUpdateDocumentStatus, useUpdateDocumentContent } from '@/hooks/useBenchmark'
import type { DocumentStatus, EnhancedBenchmarkContentJson } from '@/types/database'
import {
  ArrowLeft,
  Printer,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Scale,
  BookOpen,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<DocumentStatus, { label: string; className: string; icon: typeof Clock }> = {
  draft: { label: 'Draft', className: 'text-muted-foreground', icon: Clock },
  in_review: { label: 'In Review', className: 'text-[var(--color-signal-amber)]', icon: Clock },
  approved: { label: 'Approved', className: 'text-[var(--color-signal-green)]', icon: CheckCircle2 },
  delivered: { label: 'Delivered', className: 'text-[var(--color-accent)]', icon: CheckCircle2 },
  rejected: { label: 'Rejected', className: 'text-[var(--color-signal-red)]', icon: XCircle },
}

const POSITION_CONFIG = {
  improved: { label: 'Improved', color: 'text-[var(--color-signal-green)]', icon: TrendingUp },
  stable: { label: 'Stable', color: 'text-[var(--color-accent)]', icon: Minus },
  declined: { label: 'Declined', color: 'text-[var(--color-signal-red)]', icon: TrendingDown },
}

// ---------------------------------------------------------------------------
// Signal badge
// ---------------------------------------------------------------------------

function SignalBadge({ signal }: { signal: string }) {
  const config = {
    risk: { label: 'Risk', className: 'bg-[var(--color-signal-red)]/10 text-[var(--color-signal-red)]' },
    advantage: { label: 'Advantage', className: 'bg-[var(--color-signal-green)]/10 text-[var(--color-signal-green)]' },
    neutral: { label: 'Neutral', className: 'bg-[var(--color-bg-tertiary)] text-muted-foreground' },
  }[signal] ?? { label: signal, className: 'bg-[var(--color-bg-tertiary)] text-muted-foreground' }

  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
      config.className,
    )}>
      {config.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Document content renderer
// ---------------------------------------------------------------------------

function EditableText({ value, onSave, multiline = false, className = '' }: {
  value: string
  onSave: (newValue: string) => void
  multiline?: boolean
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  if (!editing) {
    return (
      <span
        className={cn('cursor-pointer rounded px-1 -mx-1 hover:bg-[var(--color-accent)]/5 hover:ring-1 hover:ring-[var(--color-accent)]/20 transition-all', className)}
        onClick={() => { setDraft(value); setEditing(true) }}
        title="Click to edit"
      >
        {value}
      </span>
    )
  }

  const handleSave = () => {
    if (draft.trim() && draft !== value) onSave(draft.trim())
    setEditing(false)
  }

  if (multiline) {
    return (
      <div className="space-y-2">
        <textarea
          className="w-full rounded-lg border border-[var(--color-accent)]/30 bg-card p-3 text-[13px] text-foreground outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 resize-y min-h-[80px]"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false) }}
        />
        <div className="flex gap-2">
          <button onClick={handleSave} className="rounded-md bg-[var(--color-accent)] px-3 py-1 text-[11px] font-medium text-white hover:brightness-110">Save</button>
          <button onClick={() => setEditing(false)} className="rounded-md border border-border px-3 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <input
      className="w-full rounded-lg border border-[var(--color-accent)]/30 bg-card px-3 py-2 text-[13px] text-foreground outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      autoFocus
      onBlur={handleSave}
      onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
    />
  )
}

function DocumentContent({ content, triggerName, customerName, editable = false, onContentChange }: {
  content: EnhancedBenchmarkContentJson
  triggerName: string
  customerName: string
  editable?: boolean
  onContentChange?: (updated: EnhancedBenchmarkContentJson) => void
}) {
  const posConfig = POSITION_CONFIG[content.competitive_position] ?? POSITION_CONFIG.stable
  const PosIcon = posConfig.icon

  return (
    <div className="space-y-8">
      {/* Competitive Position */}
      <div className="flex items-center gap-2">
        <PosIcon className={cn('h-5 w-5', posConfig.color)} />
        <span className={cn('text-[15px] font-semibold', posConfig.color)}>
          Competitive Position: {posConfig.label}
        </span>
      </div>

      {/* Executive Summary */}
      <div className="rounded-lg border border-border bg-[var(--color-bg-tertiary)] p-5">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          Executive Summary
        </h2>
        {editable ? (
          <EditableText
            value={content.executive_summary}
            multiline
            className="text-[14px] leading-relaxed text-foreground block"
            onSave={(v) => onContentChange?.({ ...content, executive_summary: v })}
          />
        ) : (
          <p className="text-[14px] leading-relaxed text-foreground">
            {content.executive_summary}
          </p>
        )}
      </div>

      {/* Key Findings */}
      <div>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          Key Findings
        </h2>
        <ul className="space-y-2">
          {content.key_findings.map((finding, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-[10px] font-bold text-[var(--color-accent)]">
                {i + 1}
              </span>
              {editable ? (
                <EditableText
                  value={finding}
                  multiline
                  className="text-[13px] leading-relaxed text-foreground block flex-1"
                  onSave={(v) => {
                    const updated = [...content.key_findings]
                    updated[i] = v
                    onContentChange?.({ ...content, key_findings: updated })
                  }}
                />
              ) : (
                <span className="text-[13px] leading-relaxed text-foreground">{finding}</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Sections */}
      {content.sections.map((section, idx) => (
        <div key={idx}>
          <h2 className="mb-3 text-[17px] font-semibold text-foreground border-b border-border pb-2">
            {section.title}
          </h2>
          {editable ? (
            <div className="mb-4">
              <EditableText
                value={section.narrative}
                multiline
                className="text-[13px] leading-relaxed text-muted-foreground block"
                onSave={(v) => {
                  const updated = [...content.sections]
                  updated[idx] = { ...section, narrative: v }
                  onContentChange?.({ ...content, sections: updated })
                }}
              />
            </div>
          ) : (
            <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">
              {section.narrative}
            </p>
          )}

          {section.kpi_comparisons.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="table-premium w-full min-w-max border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-[var(--color-bg-tertiary)]">
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">KPI</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">{triggerName}</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">{customerName}</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Peer Median</th>
                    <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {section.kpi_comparisons.map((kpi, ki) => (
                    <tr key={ki} className="border-b border-border last:border-0 hover:bg-[var(--color-bg-tertiary)] transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">{kpi.kpi_name}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {formatVal(kpi.trigger_company_value)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {formatVal(kpi.customer_company_value)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {formatVal(kpi.peer_median)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <SignalBadge signal={kpi.signal} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {/* Risk Flags */}
      {content.risk_flags.length > 0 && (
        <div className="rounded-lg border border-[var(--color-signal-red)]/30 bg-[var(--color-signal-red)]/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-[var(--color-signal-red)]" />
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--color-signal-red)]">
              Risk Flags
            </h2>
          </div>
          <ul className="space-y-1.5">
            {content.risk_flags.map((flag, i) => (
              <li key={i} className="text-[13px] text-[var(--color-signal-red)]/80 flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--color-signal-red)] flex-shrink-0" />
                {flag}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Accounting Differences (Phase 4) */}
      {content.accounting_comparisons && content.accounting_comparisons.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Scale className="h-4 w-4 text-[var(--color-accent)]" />
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Accounting Differences
            </h2>
          </div>
          <p className="mb-3 text-[12px] text-muted-foreground">
            The following accounting policy differences affect comparability. Values have been adjusted to {customerName}'s framework where possible.
          </p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="table-premium w-full min-w-max border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border bg-[var(--color-bg-tertiary)]">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">KPI</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">{customerName} Policy</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">{triggerName} Policy</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Adjustment</th>
                </tr>
              </thead>
              <tbody>
                {content.accounting_comparisons.map((ac, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-[var(--color-bg-tertiary)] transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{ac.kpi_name}</td>
                    <td className="px-4 py-3 text-[12px] text-muted-foreground">{ac.your_policy}</td>
                    <td className="px-4 py-3 text-[12px] text-muted-foreground">{ac.competitor_policy}</td>
                    <td className={cn(
                      'px-4 py-3 text-right tabular-nums font-medium',
                      ac.adjustment_amount && ac.adjustment_amount < 0
                        ? 'text-[var(--color-signal-red)]'
                        : 'text-[var(--color-signal-green)]',
                    )}>
                      {ac.adjustment_amount
                        ? `${ac.adjustment_amount > 0 ? '+' : ''}${formatVal(ac.adjustment_amount)}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Source Citations & Confidence (Phase 4) */}
      {content.source_citations && content.source_citations.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Sources & Confidence
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {content.source_citations.map((sc, i) => {
              const confPct = Math.round(sc.extraction_confidence * 100)
              const isHigh = sc.extraction_confidence >= 0.85
              const isMedium = sc.extraction_confidence >= 0.6
              const confColor = isHigh
                ? 'text-[var(--color-signal-green)]'
                : isMedium
                  ? 'text-[var(--color-signal-amber)]'
                  : 'text-[var(--color-signal-red)]'
              const confLabel = isHigh ? 'High' : isMedium ? 'Medium' : 'Low'
              const ConfIcon = isHigh ? ShieldCheck : ShieldAlert

              return (
                <div key={i} className="rounded-lg border border-border bg-[var(--color-bg-tertiary)] p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-medium text-foreground">{sc.kpi_code}</span>
                    <span className="text-[12px] tabular-nums text-foreground">{formatVal(sc.value)}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {sc.report_title}{sc.page_number ? `, p.${sc.page_number}` : ''}
                  </p>
                  <div className={cn('flex items-center gap-1 mt-1.5', confColor)}>
                    <ConfIcon className="h-3 w-3" />
                    <span className="text-[10px] font-semibold">{confLabel} ({confPct}%)</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Data Quality */}
      <div className="border-t border-border pt-4 text-[11px] text-muted-foreground">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span>KPIs Compared: {content.data_quality.total_kpis_compared}</span>
          <span>High Confidence: {content.data_quality.high_confidence_pct}%</span>
          {content.data_quality.fx_rates_used.length > 0 && (
            <span>FX Rates: {content.data_quality.fx_rates_used.join(', ')}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function formatVal(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}B`
  return `${v.toFixed(0)}M`
}

// ---------------------------------------------------------------------------
// Main viewer page
// ---------------------------------------------------------------------------

export function DocumentViewerPage() {
  const { id } = useParams<{ id: string }>()
  const { data: doc, isLoading } = useBenchmarkDocument(id)
  const updateStatus = useUpdateDocumentStatus()
  const updateContent = useUpdateDocumentContent()
  const isEditable = doc?.status === 'draft' || doc?.status === 'in_review'

  const handleStatusChange = async (newStatus: string) => {
    if (!doc) return
    try {
      await updateStatus.mutateAsync({ id: doc.id, status: newStatus })
      toast.success(`Status updated to ${newStatus}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  const handlePrint = () => {
    if (!doc?.content_html) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    // Sanitize AI-generated HTML — strip scripts and event handlers to prevent XSS
    const parser = new DOMParser()
    const parsed = parser.parseFromString(doc.content_html, 'text/html')
    parsed.querySelectorAll('script,iframe,object,embed,link[rel="import"]').forEach(el => el.remove())
    parsed.querySelectorAll('*').forEach(el => {
      for (const attr of [...el.attributes]) {
        if (attr.name.startsWith('on')) el.removeAttribute(attr.name)
      }
    })
    printWindow.document.open()
    printWindow.document.write('<!DOCTYPE html>' + parsed.documentElement.outerHTML)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => printWindow.print(), 500)
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[960px] px-4 py-8 sm:px-6">
        <div className="space-y-4">
          <div className="h-8 w-48 skeleton-shimmer" />
          <div className="h-4 w-96 skeleton-shimmer" />
          <div className="h-[400px] skeleton-shimmer rounded-lg" />
        </div>
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="mx-auto max-w-[960px] px-4 py-8 sm:px-6">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-[17px] font-semibold text-foreground mb-2">Document not found</h2>
          <Link to="/documents" className="text-[13px] text-[var(--color-accent)] hover:underline">
            Back to documents
          </Link>
        </div>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.draft
  const StatusIcon = statusCfg.icon

  return (
    <div className="section-fade-in mx-auto max-w-[960px] px-4 py-8 sm:px-6">
      {/* Breadcrumbs */}
      <Breadcrumbs items={[
        { label: 'Reports', href: '/reports' },
        { label: doc.title || 'Document' },
      ]} />

      {/* Back link */}
      <Link
        to="/documents"
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to documents
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground mb-2">
              {doc.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <StatusIcon className={cn('h-4 w-4', statusCfg.className)} />
                <span className={statusCfg.className}>{statusCfg.label}</span>
              </div>
              <span>FY {doc.fiscal_year}</span>
              {doc.trigger_company && (
                <span>vs {doc.trigger_company.name}</span>
              )}
              <span>Rule: {doc.benchmark_rules?.name}</span>
              {doc.generated_at && (
                <span>
                  Generated {new Date(doc.generated_at).toLocaleDateString('en-CH', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={!doc.content_html}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-[13px] font-medium text-foreground transition-all duration-200 hover:bg-[var(--color-bg-tertiary)] disabled:opacity-40"
            >
              <Printer className="h-4 w-4" />
              Print / PDF
            </button>
          </div>
        </div>
      </div>

      {/* Approval actions (Sprint 7 will expand this) */}
      {(doc.status === 'draft' || doc.status === 'in_review') && (
        <div className="mb-8 flex flex-wrap gap-2 rounded-lg border border-border bg-card p-4">
          <span className="mr-auto self-center text-[13px] text-muted-foreground">
            Change status:
          </span>
          {doc.status === 'draft' && (
            <button
              onClick={() => handleStatusChange('in_review')}
              disabled={updateStatus.isPending}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-signal-amber)]/10 px-4 py-2 text-[13px] font-medium text-[var(--color-signal-amber)] transition-all duration-200 hover:bg-[var(--color-signal-amber)]/20 disabled:opacity-40"
            >
              {updateStatus.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Submit for Review
            </button>
          )}
          {doc.status === 'in_review' && (
            <>
              <button
                onClick={() => handleStatusChange('approved')}
                disabled={updateStatus.isPending}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-signal-green)]/10 px-4 py-2 text-[13px] font-medium text-[var(--color-signal-green)] transition-all duration-200 hover:bg-[var(--color-signal-green)]/20 disabled:opacity-40"
              >
                {updateStatus.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Approve
              </button>
              <button
                onClick={() => handleStatusChange('rejected')}
                disabled={updateStatus.isPending}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-signal-red)]/10 px-4 py-2 text-[13px] font-medium text-[var(--color-signal-red)] transition-all duration-200 hover:bg-[var(--color-signal-red)]/20 disabled:opacity-40"
              >
                Reject
              </button>
            </>
          )}
        </div>
      )}

      {/* Edit hint */}
      {isEditable && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 px-4 py-2.5 text-[12px] text-[var(--color-accent)]">
          <FileText className="h-4 w-4 flex-shrink-0" />
          <span>This document is editable. Click any text section to modify it. Changes are saved automatically.</span>
        </div>
      )}

      {/* Document content */}
      <div className="rounded-lg border border-border bg-card p-6 sm:p-8">
        {doc.content_json ? (
          <DocumentContent
            content={doc.content_json}
            triggerName={doc.trigger_company?.name ?? 'Competitor'}
            customerName={doc.customer_company?.name ?? 'Customer'}
            editable={isEditable}
            onContentChange={(updated) => {
              if (!doc.id) return
              updateContent.mutate({ id: doc.id, content_json: updated as Record<string, unknown> })
              toast.success('Document updated')
            }}
          />
        ) : (
          <div className="py-12 text-center text-[13px] text-muted-foreground">
            No content available for this document.
          </div>
        )}
      </div>
    </div>
  )
}
