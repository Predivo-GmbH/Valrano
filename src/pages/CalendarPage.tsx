import { useState, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { CalendarDays, Plus, RefreshCw, ExternalLink, Trash2, Eye, Sparkles, Loader2, Globe } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { usePublicationEvents, useCreatePublicationEvent, useDeletePublicationEvent, useCheckPublication } from '@/hooks/useCalendar'
import { useCompanies } from '@/hooks/useData'
import { useSuggestDates, useSuggestIrUrl } from '@/hooks/useAiSuggestions'
import { useSubscription } from '@/hooks/useSubscription'
import type { PublicationEventStatus, ReportType } from '@/types/database'
import { REPORT_TYPE_LABELS_SHORT as REPORT_TYPE_LABELS } from '@/lib/constants'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { CardSkeleton } from '@/components/ui/page-skeleton'

const STATUS_COLORS: Record<PublicationEventStatus, string> = {
  scheduled: 'bg-[var(--color-financial-blue)]/15 text-[var(--color-financial-blue)] border-[var(--color-financial-blue)]/30',
  due_today: 'bg-[var(--color-signal-amber)]/15 text-[var(--color-signal-amber)] border-[var(--color-signal-amber)]/30',
  overdue: 'bg-[var(--color-signal-red)]/15 text-[var(--color-signal-red)] border-[var(--color-signal-red)]/30',
  detected: 'bg-[var(--color-signal-green)]/15 text-[var(--color-signal-green)] border-[var(--color-signal-green)]/30',
  ingested: 'bg-[var(--color-signal-amber)]/15 text-[var(--color-signal-amber)] border-[var(--color-signal-amber)]/30',
  benchmark_ready: 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/30',
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


export function CalendarPage({ embedded = false }: { embedded?: boolean }) {
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
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null)

  // Group events by month
  const groupedByMonth = (events ?? []).reduce<Record<string, typeof events>>((acc, ev) => {
    const month = ev.expected_date.slice(0, 7) // YYYY-MM
    if (!acc[month]) acc[month] = []
    acc[month]!.push(ev)
    return acc
  }, {})

  const sortedMonths = Object.keys(groupedByMonth).sort()

  const content = (
    <>
      {!embedded && (
        <div className="mb-6">
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">Publication Calendar</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Track competitor report publications and monitor IR pages for new reports.
          </p>
        </div>
      )}

        {/* Automation Info Banner */}
        <div className="mb-6 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Automated Monitoring</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                The system automatically checks for new publications based on the expected date and time you set.
                Monitoring intensifies as the expected time approaches:
              </p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400/60" />
                  <span><strong className="text-foreground">3 days to 1 hour before</strong> — checked every 6 hours (safety net)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
                  <span><strong className="text-foreground">1 hour before to 30 min after</strong> — checked every 2 minutes (peak window)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400/60" />
                  <span><strong className="text-foreground">30 min to 4 hours after</strong> — checked every 5 minutes</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-400/60" />
                  <span><strong className="text-foreground">4+ hours overdue</strong> — gradually reduces to every 30 min, then hourly</span>
                </li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Once detected, the report is automatically downloaded, KPIs extracted, normalized to CHF, and a benchmark document is generated — no manual action needed.
              </p>
            </div>
          </div>
        </div>

        {/* Filters + Actions */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Select value={filterStatus} onValueChange={(v) => v && setFilterStatus(v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterCompany} onValueChange={(v) => v && setFilterCompany(v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All companies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All companies</SelectItem>
              {(companies ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="ml-auto">
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4" />
              Add Event
            </Button>
          </div>
        </div>

        {/* Timeline */}
        {isLoading ? (
          <CardSkeleton />
        ) : sortedMonths.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">No publication events</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Add competitor publication dates to start monitoring.
            </p>
            <Button variant="outline" onClick={() => setShowCreateDialog(true)} className="mt-4">
              <Plus className="h-4 w-4" />
              Add First Event
            </Button>
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
                                aria-label="Open IR page"
                                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                            {(ev.status === 'scheduled' || ev.status === 'due_today' || ev.status === 'overdue') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Check now"
                                onClick={() => {
                                  checkMutation.mutate(ev.id, {
                                    onSuccess: () => toast.success('Check completed'),
                                    onError: (err) => toast.error(`Check failed: ${err.message}`),
                                  })
                                }}
                                disabled={checkMutation.isPending}
                              >
                                <RefreshCw className={`h-3.5 w-3.5 ${checkMutation.isPending ? 'animate-spin' : ''}`} />
                              </Button>
                            )}
                            {ev.report_id && (
                              <Link
                                to={`/documents?reportId=${ev.report_id}`}
                                aria-label="View report"
                                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Link>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Delete event"
                              onClick={() => setDeleteEventId(ev.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
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
        <CreateEventDialog
          open={showCreateDialog}
          companies={companies ?? []}
          onClose={() => setShowCreateDialog(false)}
        />

        <ConfirmDeleteDialog
          open={deleteEventId !== null}
          onOpenChange={(o) => { if (!o) setDeleteEventId(null) }}
          title="Delete Publication Event"
          description="Are you sure you want to delete this publication event? This action cannot be undone."
          onConfirm={() => {
            if (deleteEventId) {
              deleteMutation.mutate(deleteEventId, {
                onSuccess: () => { toast.success('Event deleted'); setDeleteEventId(null) },
              })
            }
          }}
          isPending={deleteMutation.isPending}
        />
    </>
  )

  if (embedded) return content

  return (
    <>
      <Helmet><title>Publication Calendar - BenchmarkSignal</title></Helmet>
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        {content}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Create Event Dialog — Smart with AI Suggestions
// ---------------------------------------------------------------------------
function CreateEventDialog({
  open,
  companies,
  onClose,
}: {
  open: boolean
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
  const [aiReasoning, setAiReasoning] = useState<string | null>(null)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const companyInvalid = !companyId && (touched.company || submitAttempted)
  const dateInvalid = !expectedDate && (touched.date || submitAttempted)

  const createMutation = useCreatePublicationEvent()
  const suggestDatesMutation = useSuggestDates()
  const suggestIrUrlMutation = useSuggestIrUrl()
  const { tier } = useSubscription()

  const selectedCompanyName = companies.find(c => c.id === companyId)?.name ?? ''

  // Auto-fill IR URL when company is selected
  const handleCompanyChange = useCallback((newCompanyId: string) => {
    setCompanyId(newCompanyId)
    setAiReasoning(null)
    // Auto-suggest IR URL for the selected company
    if (newCompanyId) {
      const name = companies.find(c => c.id === newCompanyId)?.name ?? ''
      suggestIrUrlMutation.mutate(
        { company_id: newCompanyId, company_name: name },
        {
          onSuccess: (data) => {
            if (data.ir_page_url) {
              setIrPageUrl(data.ir_page_url)
            }
          },
        }
      )
    }
  }, [companies, suggestIrUrlMutation])

  // AI Suggest dates
  function handleSuggestDates() {
    if (!companyId || !selectedCompanyName) {
      toast.error('Select a company first')
      return
    }
    suggestDatesMutation.mutate(
      {
        company_id: companyId,
        company_name: selectedCompanyName,
        report_type: reportType,
        fiscal_year: fiscalYear,
      },
      {
        onSuccess: (data) => {
          if (data.suggestion) {
            setExpectedDate(data.suggestion.suggested_date)
            setExpectedTime(data.suggestion.suggested_time)
            setAiReasoning(data.suggestion.reasoning)
            toast.success('Date suggested by AI')
          }
        },
        onError: (err) => {
          if (err.message.includes('limit reached')) {
            toast.error('Monthly AI suggestion limit reached. Upgrade your plan for more.')
          } else {
            toast.error(`Suggestion failed: ${err.message}`)
          }
        },
      }
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitAttempted(true)
    if (!companyId || !expectedDate) return
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

  const TIER_LABELS: Record<string, string> = {
    starter: '5 AI suggestions/month',
    professional: '50 AI suggestions/month',
    enterprise: 'Unlimited AI suggestions',
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Publication Event</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {TIER_LABELS[tier] ?? TIER_LABELS.starter}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Company */}
          <div>
            <label htmlFor="event-company" className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Company</label>
            <Select value={companyId} onValueChange={(v) => { if (v) { handleCompanyChange(v); setTouched((t) => ({ ...t, company: true })) } }}>
              <SelectTrigger id="event-company" className={`w-full ${companyInvalid ? 'border-[var(--color-signal-red)]' : ''}`} aria-invalid={companyInvalid}>
                <SelectValue placeholder="Select company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {companyInvalid && <p className="mt-1 text-[12px] text-[var(--color-signal-red)]">Company is required.</p>}
          </div>

          {/* Report Type + Fiscal Year */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="event-report-type" className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Report Type</label>
              <Select value={reportType} onValueChange={(v) => v && setReportType(v as ReportType)}>
                <SelectTrigger id="event-report-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REPORT_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="event-fiscal-year" className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Fiscal Year</label>
              <input
                id="event-fiscal-year"
                type="number"
                value={fiscalYear}
                onChange={(e) => setFiscalYear(parseInt(e.target.value))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>

          {reportType === 'quarterly' && (
            <div>
              <label htmlFor="event-quarter" className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Quarter</label>
              <Select value={fiscalQuarter ? String(fiscalQuarter) : ''} onValueChange={(v) => setFiscalQuarter(v ? parseInt(v) : null)}>
                <SelectTrigger id="event-quarter" className="w-full">
                  <SelectValue placeholder="Select quarter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Q1</SelectItem>
                  <SelectItem value="2">Q2</SelectItem>
                  <SelectItem value="3">Q3</SelectItem>
                  <SelectItem value="4">Q4</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* AI Suggest Button */}
          <div className="rounded-lg border border-dashed border-blue-500/30 bg-blue-500/5 p-3">
            <Button
              type="button"
              variant="secondary"
              onClick={handleSuggestDates}
              disabled={suggestDatesMutation.isPending || !companyId}
              className="w-full"
            >
              {suggestDatesMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {suggestDatesMutation.isPending ? 'Predicting...' : 'Suggest Date & Time with AI'}
            </Button>
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
              Uses 1 AI credit · Based on historical patterns and industry data
            </p>
          </div>

          {/* AI Reasoning (if suggestion was made) */}
          {aiReasoning && (
            <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-green-400">
                <Sparkles className="h-3 w-3" />
                AI Suggestion Applied
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{aiReasoning}</p>
            </div>
          )}

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="event-expected-date" className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Expected Publication Date</label>
              <input
                id="event-expected-date"
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, date: true }))}
                aria-invalid={dateInvalid}
                className={`w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground ${dateInvalid ? 'border-[var(--color-signal-red)]' : 'border-border'}`}
              />
              {dateInvalid && <p className="mt-1 text-[12px] text-[var(--color-signal-red)]">Publication date is required.</p>}
            </div>
            <div>
              <label htmlFor="event-expected-time" className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Expected Time (CET)</label>
              <input
                id="event-expected-time"
                type="time"
                value={expectedTime}
                onChange={(e) => setExpectedTime(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">Peak monitoring ±30 min around this time</p>
            </div>
          </div>

          {/* IR Page URL with auto-discover */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="event-ir-url" className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">IR Page URL</label>
              {companyId && !irPageUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    suggestIrUrlMutation.mutate(
                      { company_id: companyId, company_name: selectedCompanyName },
                      {
                        onSuccess: (data) => {
                          if (data.ir_page_url) {
                            setIrPageUrl(data.ir_page_url)
                            toast.success(data.validated ? 'IR page found and validated' : 'IR page suggested (not validated)')
                          }
                        },
                        onError: () => toast.error('Could not find IR page'),
                      }
                    )
                  }}
                  disabled={suggestIrUrlMutation.isPending}
                >
                  {suggestIrUrlMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Globe className="h-3 w-3" />
                  )}
                  Auto-discover
                </Button>
              )}
            </div>
            <input
              id="event-ir-url"
              type="url"
              value={irPageUrl}
              onChange={(e) => setIrPageUrl(e.target.value)}
              placeholder="https://www.company.com/investors"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            {irPageUrl && suggestIrUrlMutation.data?.validated && (
              <p className="mt-1 text-[10px] text-green-400">Validated — page exists</p>
            )}
          </div>

          {/* Direct PDF URL */}
          <div>
            <label htmlFor="event-pdf-url" className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Direct PDF URL (optional)</label>
            <input
              id="event-pdf-url"
              type="url"
              value={directPdfUrl}
              onChange={(e) => setDirectPdfUrl(e.target.value)}
              placeholder="https://www.company.com/report.pdf"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="event-notes" className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Notes (optional)</label>
            <textarea
              id="event-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 500))}
              placeholder="e.g., CRH typically publishes in late February"
              rows={3}
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">{notes.length}/500</p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Event'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
