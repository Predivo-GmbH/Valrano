import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useBenchmarkDocuments } from '@/hooks/useBenchmark'
import { useCompanies } from '@/hooks/useData'
import type { DocumentStatus } from '@/types/database'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileText, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Status badge styling
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<DocumentStatus, { label: string; className: string }> = {
  draft: {
    label: 'Draft',
    className: 'bg-[var(--color-bg-tertiary)] text-muted-foreground',
  },
  in_review: {
    label: 'In Review',
    className: 'bg-[var(--color-signal-amber)]/10 text-[var(--color-signal-amber)]',
  },
  approved: {
    label: 'Approved',
    className: 'bg-[var(--color-signal-green)]/10 text-[var(--color-signal-green)]',
  },
  delivered: {
    label: 'Delivered',
    className: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-[var(--color-signal-red)]/10 text-[var(--color-signal-red)]',
  },
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider',
      config.className,
    )}>
      {config.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="mb-4 rounded-full bg-[var(--color-bg-tertiary)] p-4">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-[15px] font-semibold text-foreground">No benchmark documents</h3>
      <p className="mb-6 text-[13px] text-muted-foreground max-w-sm">
        Upload a competitor report and extract KPIs to generate your first benchmark document.
      </p>
      <Link
        to="/upload"
        className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-[13px] font-medium text-background transition-all duration-200 hover:opacity-90"
      >
        Upload a Report
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-px">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-[72px] bg-[var(--color-bg-tertiary)] rounded" />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main documents page
// ---------------------------------------------------------------------------

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)

export function DocumentsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [yearFilter, setYearFilter] = useState<string>('all')
  const [companyFilter, setCompanyFilter] = useState<string>('all')

  const { data: companies } = useCompanies()
  const { data: documents, isLoading } = useBenchmarkDocuments({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    fiscalYear: yearFilter !== 'all' ? Number(yearFilter) : undefined,
    companyId: companyFilter !== 'all' ? companyFilter : undefined,
  })

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-CH', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">
          Benchmark Documents
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          AI-generated competitive analysis documents based on extracted KPI data.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={(v) => { if (v !== null) setStatusFilter(v) }}>
          <SelectTrigger className="w-[140px] rounded-lg border-border bg-card text-[13px] text-foreground">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="rounded-lg border-border bg-card text-[13px]">
            <SelectItem value="all" className="text-[13px]">All Status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key} className="text-[13px]">{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={yearFilter} onValueChange={(v) => { if (v !== null) setYearFilter(v) }}>
          <SelectTrigger className="w-[120px] rounded-lg border-border bg-card text-[13px] text-foreground">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent className="rounded-lg border-border bg-card text-[13px]">
            <SelectItem value="all" className="text-[13px]">All Years</SelectItem>
            {YEAR_OPTIONS.map((y) => (
              <SelectItem key={y} value={String(y)} className="text-[13px]">FY {y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={companyFilter} onValueChange={(v) => { if (v !== null) setCompanyFilter(v) }}>
          <SelectTrigger className="w-[180px] rounded-lg border-border bg-card text-[13px] text-foreground">
            <SelectValue placeholder="Company" />
          </SelectTrigger>
          <SelectContent className="rounded-lg border-border bg-card text-[13px]">
            <SelectItem value="all" className="text-[13px]">All Companies</SelectItem>
            {(companies ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id} className="text-[13px]">
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton />
          </div>
        ) : !documents || documents.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-4 text-left">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Document
                    </span>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Competitor
                    </span>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Year
                    </span>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Status
                    </span>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Generated
                    </span>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Action
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-b border-border transition-colors duration-200 last:border-0 hover:bg-[var(--color-bg-tertiary)]"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-accent)]/10">
                          <FileText className="h-4 w-4 text-[var(--color-accent)]" />
                        </div>
                        <div className="min-w-0">
                          <Link
                            to={`/documents/${doc.id}`}
                            className="text-[13px] font-medium text-foreground hover:text-[var(--color-accent)] transition-colors truncate block max-w-[280px]"
                          >
                            {doc.title}
                          </Link>
                          <p className="text-[11px] text-muted-foreground">
                            {doc.benchmark_rules?.name ?? '—'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[13px] text-foreground">
                        {doc.trigger_company?.name ?? '—'}
                      </span>
                      {doc.trigger_company?.ticker && (
                        <span className="ml-1 text-[11px] text-muted-foreground">
                          ({doc.trigger_company.ticker})
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[13px] text-foreground tabular-nums">
                        FY {doc.fiscal_year}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={doc.status} />
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[13px] text-muted-foreground tabular-nums">
                        {formatDate(doc.generated_at)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/documents/${doc.id}`}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-[var(--color-accent)] transition-all duration-200 hover:bg-[var(--color-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                      >
                        View
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Count */}
      {documents && documents.length > 0 && (
        <p className="mt-4 text-[11px] text-muted-foreground">
          {documents.length} document{documents.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
