import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { CalendarDays, Plus, RefreshCw, ExternalLink, Trash2, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { usePublicationEvents, useCreatePublicationEvent, useDeletePublicationEvent, useCheckPublication, useCompanies } from '@/hooks/useCalendar'
import type { PublicationEventStatus, ReportType } from '@/types/database'

const STATUS_COLORS: Record<PublicationEventStatus, string> = {
  scheduled: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  due_today: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  overdue: 'bg-red-500/15 text-red-400 border-red-500/30',
  detected: 'bg-green-500/15 text-green-400 border-green-500/30',
  ingested: 'bg-green-500/15 text-green-300 border-green-500/30',
  benchmark_ready: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
}

const STATUS_LABELS: Record<PublicationEventStatus, string> = {
  scheduled: 'Scheduled',
  due_today: 'Due Today',
  overdue: 'Overdue',
  detected: 'Detected',
  ingested: 'Ingested',
  benchmark_ready: 'Benchmark Ready',
  cancelled: 'Cancelled',
}

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  annual: 'Annual',
  quarterly: 'Quarterly',
  half_year: 'Half-Year',
  sustainability: 'Sustainability',
}

export function CalendarPage() {
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterCompany, setFilterCompany] = useState<string>('all')
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const { data: events, isLoading } = usePublicationEvents({
    status: filterStatus === 'all' ? undefined : filterStatus,
    companyId: filterCompany === 'all' ? undefined : filterCompany,
  })
  const { data: companies } = useCompanies()
  const checkMutation = useCheckPublication()
  const deleteMutation = useDeletePublicationEvent()

  // Group events by month
  const groupedByMonth = (events ?? []).reduce<Record<string, typeof events>>((acc, ev) => {
    const month = ev.expected_date.slice(0, 7) // YYYY-MM
    if (!acc[month]) acc[month] = []
    acc[month]!.push(ev)
    return acc
  }, {})

  const sortedMonths = Object.keys(groupedByMonth).sort()

  return (
    <>
      <Helmet><title>Publication Calendar - BenchmarkSignal</title></Helmet>
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Publication Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track competitor report publications and monitor IR pages for new reports.
          </p>
        </div>

        {/* Filters + Actions */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          >
            <option value="all">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          >
            <option value="all">All companies</option>
            {(companies ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <div className="ml-auto">
            <button
              onClick={() => setShowCreateDialog(true)}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Add Event
            </button>
          </div>
        </div>

        {/* Timeline */}
        {isLoading ? (
          <div className="py-20 text-center text-sm text-muted-foreground">Loading events...</div>
        ) : sortedMonths.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">No publication events</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Add competitor publication dates to start monitoring.
            </p>
            <button
              onClick={() => setShowCreateDialog(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[var(--color-bg-tertiary)]"
            >
              <Plus className="h-4 w-4" />
              Add First Event
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {sortedMonths.map((month) => {
              const monthDate = new Date(month + '-01')
              const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              return (
                <div key={month}>
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    {monthLabel}
                  </h2>
                  <div className="space-y-3">
                    {groupedByMonth[month]!.map((ev) => {
                      const company = ev.companies as { id: string; name: string; ticker: string | null } | undefined
                      const dateStr = new Date(ev.expected_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                      const timeStr = ev.expected_time ? ev.expected_time.slice(0, 5) : null

                      return (
                        <div
                          key={ev.id}
                          className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-[var(--color-bg-tertiary)]"
                        >
                          {/* Date + Time */}
                          <div className="w-28 shrink-0">
                            <div className="text-sm font-medium text-foreground">{dateStr}</div>
                            {timeStr && <div className="text-[11px] text-muted-foreground">{timeStr} CET</div>}
                          </div>

                          {/* Company + Report Type */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">
                                {company?.name ?? 'Unknown'}
                              </span>
                              {company?.ticker && (
                                <span className="text-xs text-muted-foreground">({company.ticker})</span>
                              )}
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {REPORT_TYPE_LABELS[ev.report_type]} · FY {ev.fiscal_year}
                              {ev.fiscal_quarter ? ` Q${ev.fiscal_quarter}` : ''}
                              {ev.notes && ` · ${ev.notes}`}
                            </div>
                          </div>

                          {/* Status badge */}
                          <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[ev.status]}`}>
                            {STATUS_LABELS[ev.status]}
                          </span>

                          {/* Actions */}
                          <div className="flex shrink-0 items-center gap-1">
                            {ev.ir_page_url && (
                              <a
                                href={ev.ir_page_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-[var(--color-bg-tertiary)] hover:text-foreground"
                                title="Open IR page"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                            {(ev.status === 'scheduled' || ev.status === 'due_today' || ev.status === 'overdue') && (
                              <button
                                onClick={() => {
                                  checkMutation.mutate(ev.id, {
                                    onSuccess: () => toast.success('Check completed'),
                                    onError: (err) => toast.error(`Check failed: ${err.message}`),
                                  })
                                }}
                                disabled={checkMutation.isPending}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-[var(--color-bg-tertiary)] hover:text-foreground disabled:opacity-50"
                                title="Check now"
                              >
                                <RefreshCw className={`h-3.5 w-3.5 ${checkMutation.isPending ? 'animate-spin' : ''}`} />
                              </button>
                            )}
                            {ev.report_id && (
                              <Link
                                to={`/documents?reportId=${ev.report_id}`}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-[var(--color-bg-tertiary)] hover:text-foreground"
                                title="View report"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Link>
                            )}
                            <button
                              onClick={() => {
                                if (confirm('Delete this publication event?')) {
                                  deleteMutation.mutate(ev.id, {
                                    onSuccess: () => toast.success('Event deleted'),
                                  })
                                }
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-[var(--color-bg-tertiary)] hover:text-red-400"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Create Dialog */}
        {showCreateDialog && (
          <CreateEventDialog
            companies={companies ?? []}
            onClose={() => setShowCreateDialog(false)}
          />
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Create Event Dialog
// ---------------------------------------------------------------------------
function CreateEventDialog({
  companies,
  onClose,
}: {
  companies: { id: string; name: string }[]
  onClose: () => void
}) {
  const [companyId, setCompanyId] = useState('')
  const [reportType, setReportType] = useState<ReportType>('annual')
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear())
  const [fiscalQuarter, setFiscalQuarter] = useState<number | null>(null)
  const [expectedDate, setExpectedDate] = useState('')
  const [expectedTime, setExpectedTime] = useState('07:00')
  const [irPageUrl, setIrPageUrl] = useState('')
  const [directPdfUrl, setDirectPdfUrl] = useState('')
  const [notes, setNotes] = useState('')

  const createMutation = useCreatePublicationEvent()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    createMutation.mutate(
      {
        company_id: companyId,
        report_type: reportType,
        fiscal_year: fiscalYear,
        fiscal_quarter: reportType === 'quarterly' ? fiscalQuarter : null,
        expected_date: expectedDate,
        expected_time: expectedTime ? `${expectedTime}:00` : null,
        ir_page_url: irPageUrl || null,
        direct_pdf_url: directPdfUrl || null,
        notes: notes || null,
      },
      {
        onSuccess: () => {
          toast.success('Publication event created')
          onClose()
        },
        onError: (err) => toast.error(`Failed: ${err.message}`),
      }
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-foreground">Add Publication Event</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Company</label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">Select company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Report Type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                {Object.entries(REPORT_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Fiscal Year</label>
              <input
                type="number"
                value={fiscalYear}
                onChange={(e) => setFiscalYear(parseInt(e.target.value))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>

          {reportType === 'quarterly' && (
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Quarter</label>
              <select
                value={fiscalQuarter ?? ''}
                onChange={(e) => setFiscalQuarter(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">Select quarter</option>
                <option value="1">Q1</option>
                <option value="2">Q2</option>
                <option value="3">Q3</option>
                <option value="4">Q4</option>
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Expected Publication Date</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Expected Time (CET)</label>
              <input
                type="time"
                value={expectedTime}
                onChange={(e) => setExpectedTime(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">Monitoring peaks around this time</p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">IR Page URL (optional)</label>
            <input
              type="url"
              value={irPageUrl}
              onChange={(e) => setIrPageUrl(e.target.value)}
              placeholder="https://www.company.com/investors"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Direct PDF URL (optional)</label>
            <input
              type="url"
              value={directPdfUrl}
              onChange={(e) => setDirectPdfUrl(e.target.value)}
              placeholder="https://www.company.com/report.pdf"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., CRH typically publishes in late February"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
