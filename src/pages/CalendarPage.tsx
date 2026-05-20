import { useState, useMemo, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { CalendarDays, Plus, RefreshCw, ExternalLink, Trash2, Eye, Sparkles, Loader2, Globe, ChevronLeft, ChevronRight, List, Clock, Check, X } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { usePublicationEvents, useCreatePublicationEvent, useDeletePublicationEvent, useCheckPublication, useUpdatePublicationEvent } from '@/hooks/useCalendar'
import { useCompanies } from '@/hooks/useData'
import { useSuggestDates, useSuggestIrUrl } from '@/hooks/useAiSuggestions'
import { useSubscription } from '@/hooks/useSubscription'
import type { PublicationEventStatus, ReportType } from '@/types/database'
import { REPORT_TYPE_LABELS_SHORT as REPORT_TYPE_LABELS } from '@/lib/constants'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { CardSkeleton } from '@/components/ui/page-skeleton'
import { CompanyLogo } from '@/components/ui/company-logo'
import { Badge } from '@/components/ui/badge'

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

const STATUS_DOT_COLORS: Record<PublicationEventStatus, string> = {
  scheduled: 'bg-[var(--color-financial-blue)]',
  due_today: 'bg-[var(--color-signal-amber)]',
  overdue: 'bg-[var(--color-signal-red)]',
  detected: 'bg-[var(--color-signal-green)]',
  ingested: 'bg-[var(--color-signal-amber)]',
  benchmark_ready: 'bg-[var(--color-accent)]',
  cancelled: 'bg-zinc-400',
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  // Monday = 0, Sunday = 6
  let startOffset = firstDay.getDay() - 1
  if (startOffset < 0) startOffset = 6

  const days: Array<{ date: string; day: number; isCurrentMonth: boolean }> = []

  // Previous month padding
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i)
    days.push({ date: d.toISOString().slice(0, 10), day: d.getDate(), isCurrentMonth: false })
  }

  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({ date: dateStr, day: d, isCurrentMonth: true })
  }

  // Next month padding (fill to complete last week)
  const remainder = days.length % 7
  if (remainder > 0) {
    for (let d = 1; d <= 7 - remainder; d++) {
      const date = new Date(year, month + 1, d)
      days.push({ date: date.toISOString().slice(0, 10), day: d, isCurrentMonth: false })
    }
  }

  return days
}

export function CalendarPage({ embedded = false }: { embedded?: boolean }) {
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterCompany, setFilterCompany] = useState<string>('all')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [viewMode, setViewMode] = useState<'calendar' | 'upcoming'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? 'upcoming' : 'calendar'
  )

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const [currentMonth, setCurrentMonth] = useState({ year: today.getFullYear(), month: today.getMonth() })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const { data: events, isLoading } = usePublicationEvents({
    status: filterStatus === 'all' ? undefined : filterStatus,
    companyId: filterCompany === 'all' ? undefined : filterCompany,
  })
  const { data: companies } = useCompanies()
  const checkMutation = useCheckPublication()
  const deleteMutation = useDeletePublicationEvent()
  const updateMutation = useUpdatePublicationEvent()
  const suggestDatesMutation = useSuggestDates()
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null)
  const [checkingEventId, setCheckingEventId] = useState<string | null>(null)
  const [infoBannerOpen, setInfoBannerOpen] = useState(false)

  // Inline time editing
  const [editingTimeEventId, setEditingTimeEventId] = useState<string | null>(null)
  const [editTimeValue, setEditTimeValue] = useState('')

  // Inline date editing
  const [editingDateEventId, setEditingDateEventId] = useState<string | null>(null)
  const [editDateValue, setEditDateValue] = useState('')

  // Inline report type editing
  const [editingReportTypeEventId, setEditingReportTypeEventId] = useState<string | null>(null)
  const [editReportTypeValue, setEditReportTypeValue] = useState<string>('')

  // AI suggest state
  const [suggestingEventId, setSuggestingEventId] = useState<string | null>(null)
  const [bulkSuggesting, setBulkSuggesting] = useState(false)

  // Upcoming events (sorted from today forward)
  const upcomingEvents = useMemo(() => {
    if (!events) return []
    return events
      .filter((e) => e.expected_date >= todayStr && e.status !== 'cancelled')
      .sort((a, b) => {
        const dateDiff = a.expected_date.localeCompare(b.expected_date)
        if (dateDiff !== 0) return dateDiff
        return (a.expected_time ?? '').localeCompare(b.expected_time ?? '')
      })
  }, [events, todayStr])

  // Count events missing time
  const missingTimeCount = useMemo(() => {
    if (!events) return 0
    return events.filter((e) => !e.expected_time && e.status !== 'cancelled').length
  }, [events])

  // Inline time save
  function handleTimeSave(eventId: string) {
    if (!editTimeValue) return
    updateMutation.mutate(
      { id: eventId, expected_time: editTimeValue + ':00' },
      {
        onSuccess: () => { toast.success('Time updated'); setEditingTimeEventId(null) },
        onError: (err) => toast.error(`Failed to update time: ${err.message}`),
      },
    )
  }

  // Inline date save
  function handleDateSave(eventId: string) {
    if (!editDateValue) return
    updateMutation.mutate(
      { id: eventId, expected_date: editDateValue },
      {
        onSuccess: () => { toast.success('Date updated'); setEditingDateEventId(null) },
        onError: (err) => toast.error(`Failed to update date: ${err.message}`),
      },
    )
  }

  // Inline report type save
  function handleReportTypeSave(eventId: string) {
    if (!editReportTypeValue) return
    updateMutation.mutate(
      { id: eventId, report_type: editReportTypeValue },
      {
        onSuccess: () => { toast.success('Report type updated'); setEditingReportTypeEventId(null) },
        onError: (err) => toast.error(`Failed to update report type: ${err.message}`),
      },
    )
  }

  // AI suggest time for one event
  function handleSuggestTime(ev: { id: string; company_id: string; report_type: string; fiscal_year: number }) {
    const companyName = companies?.find((c) => c.id === ev.company_id)?.name ?? ''
    setSuggestingEventId(ev.id)
    suggestDatesMutation.mutate(
      { company_id: ev.company_id, company_name: companyName, report_type: ev.report_type, fiscal_year: ev.fiscal_year },
      {
        onSuccess: (data) => {
          const time = data.suggestion.suggested_time
          if (time) {
            updateMutation.mutate(
              { id: ev.id, expected_time: time },
              {
                onSuccess: () => { toast.success(`Time set to ${time.slice(0, 5)} (${data.suggestion.source})`); setSuggestingEventId(null) },
                onError: () => setSuggestingEventId(null),
              },
            )
          } else {
            toast.info('AI could not determine a time for this event')
            setSuggestingEventId(null)
          }
        },
        onError: (err) => { toast.error(`AI suggestion failed: ${err.message}`); setSuggestingEventId(null) },
      },
    )
  }

  // Bulk suggest times for all events without a time
  async function handleBulkSuggest() {
    const noTimeEvents = (events ?? []).filter((e) => !e.expected_time && e.status !== 'cancelled')
    if (noTimeEvents.length === 0) { toast.info('All events already have times set'); return }
    setBulkSuggesting(true)
    let successCount = 0
    for (const ev of noTimeEvents) {
      try {
        const companyName = companies?.find((c) => c.id === ev.company_id)?.name ?? ''
        const data = await suggestDatesMutation.mutateAsync({
          company_id: ev.company_id,
          company_name: companyName,
          report_type: ev.report_type,
          fiscal_year: ev.fiscal_year,
        })
        if (data.suggestion.suggested_time) {
          await updateMutation.mutateAsync({ id: ev.id, expected_time: data.suggestion.suggested_time })
          successCount++
        }
      } catch {
        // continue with next event
      }
    }
    setBulkSuggesting(false)
    toast.success(`Set times for ${successCount}/${noTimeEvents.length} events`)
  }

  // Map events by date for calendar dot rendering
  const eventsByDate = useMemo(() => {
    const map: Record<string, typeof events> = {}
    for (const ev of events ?? []) {
      if (!map[ev.expected_date]) map[ev.expected_date] = []
      map[ev.expected_date]!.push(ev)
    }
    return map
  }, [events])

  const monthDays = useMemo(() => getMonthDays(currentMonth.year, currentMonth.month), [currentMonth])

  const monthLabel = new Date(currentMonth.year, currentMonth.month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const selectedDayEvents = selectedDate ? (eventsByDate[selectedDate] ?? []) : []

  function goToPrevMonth() {
    setCurrentMonth((m) => m.month === 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: m.month - 1 })
  }
  function goToNextMonth() {
    setCurrentMonth((m) => m.month === 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: m.month + 1 })
  }
  function goToToday() {
    setCurrentMonth({ year: today.getFullYear(), month: today.getMonth() })
    setSelectedDate(todayStr)
  }

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

        {/* Automation Info Banner — collapsible */}
        <div className="mb-6 rounded-xl border border-blue-500/20 bg-blue-500/5">
          <button
            type="button"
            onClick={() => setInfoBannerOpen((o) => !o)}
            className="flex w-full items-center gap-3 p-4 text-left min-h-[44px]"
          >
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
            </div>
            <span className="flex-1 text-sm font-semibold text-foreground">Automated Monitoring</span>
            <svg className={`h-4 w-4 text-muted-foreground transition-transform ${infoBannerOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {infoBannerOpen && (
            <div className="px-4 pb-4 pl-12">
              <p className="text-xs leading-relaxed text-muted-foreground">
                The system automatically checks for new publications based on the expected date and time you set.
                Monitoring intensifies as the expected time approaches:
              </p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400/60" />
                  <span><strong className="text-foreground">3 days to 1 hour before</strong> — every 6 hours</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
                  <span><strong className="text-foreground">1 hour before to 30 min after</strong> — every 2 minutes (peak)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400/60" />
                  <span><strong className="text-foreground">30 min to 4 hours after</strong> — every 5 minutes</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-400/60" />
                  <span><strong className="text-foreground">4+ hours overdue</strong> — every 30 min, then hourly</span>
                </li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Once detected, the report is automatically downloaded, KPIs extracted, normalized to CHF, and a benchmark document is generated.
              </p>
            </div>
          )}
        </div>

        {/* Filters + Actions */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Select value={filterStatus} onValueChange={(v) => v && setFilterStatus(v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All statuses">{filterStatus === 'all' ? 'All statuses' : STATUS_LABELS[filterStatus as keyof typeof STATUS_LABELS] ?? filterStatus}</SelectValue>
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
              <SelectValue placeholder="All companies">{filterCompany === 'all' ? 'All companies' : (companies ?? []).find((c) => c.id === filterCompany)?.name ?? 'All companies'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All companies</SelectItem>
              {(companies ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* View toggle */}
          <div className="flex rounded-lg border border-border bg-[var(--color-bg-tertiary)] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'calendar' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Calendar
            </button>
            <button
              type="button"
              onClick={() => setViewMode('upcoming')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'upcoming' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              Upcoming
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {missingTimeCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkSuggest}
                disabled={bulkSuggesting}
              >
                {bulkSuggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Suggest All Times ({missingTimeCount})
              </Button>
            )}
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4" />
              Add Event
            </Button>
          </div>
        </div>

        {/* Calendar Grid or Upcoming List */}
        {isLoading ? (
          <CardSkeleton />
        ) : viewMode === 'upcoming' ? (
          /* ============ Upcoming View ============ */
          <div className="space-y-2">
            {upcomingEvents.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-12 text-center">
                <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold text-foreground">No upcoming events</h3>
                <p className="mt-2 text-sm text-muted-foreground">All events are in the past or there are none scheduled.</p>
              </div>
            ) : (
              upcomingEvents.map((ev) => {
                const company = ev.companies as { id: string; name: string; ticker: string | null; logo_url: string | null; website_url: string | null } | undefined
                const timeStr = ev.expected_time ? ev.expected_time.slice(0, 5) : null
                const isEditingTime = editingTimeEventId === ev.id
                const isSuggesting = suggestingEventId === ev.id

                return (
                  <div
                    key={ev.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-[var(--color-bg-tertiary)]"
                  >
                    {/* Date — inline editable */}
                    <div className="shrink-0">
                      {editingDateEventId === ev.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="date"
                            value={editDateValue}
                            onChange={(e) => setEditDateValue(e.target.value)}
                            className="h-7 rounded border border-border bg-background px-2 text-xs text-foreground"
                            autoFocus
                          />
                          <button type="button" onClick={() => handleDateSave(ev.id)} className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded text-[var(--color-signal-green)] hover:bg-[var(--color-signal-green)]/10">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => setEditingDateEventId(null)} className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setEditingDateEventId(ev.id); setEditDateValue(ev.expected_date) }}
                          className="sm:w-24 text-xs text-muted-foreground hover:text-[var(--color-accent)] transition-colors"
                        >
                          {new Date(ev.expected_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </button>
                      )}
                    </div>

                    {/* Time — inline editable */}
                    <div className="sm:w-28 shrink-0">
                      {isEditingTime ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="time"
                            value={editTimeValue}
                            onChange={(e) => setEditTimeValue(e.target.value)}
                            className="h-7 w-24 rounded border border-border bg-background px-2 text-xs text-foreground"
                            autoFocus
                          />
                          <button type="button" onClick={() => handleTimeSave(ev.id)} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-[var(--color-signal-green)] hover:bg-[var(--color-signal-green)]/10">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => setEditingTimeEventId(null)} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-muted-foreground hover:bg-accent">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : timeStr ? (
                        <button
                          type="button"
                          onClick={() => { setEditingTimeEventId(ev.id); setEditTimeValue(timeStr) }}
                          className="text-sm font-semibold text-foreground hover:text-[var(--color-accent)] transition-colors"
                        >
                          {timeStr} <span className="text-[11px] font-normal text-muted-foreground">CET</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => { setEditingTimeEventId(ev.id); setEditTimeValue('07:00') }}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-[var(--color-accent)] transition-colors"
                          >
                            <Clock className="h-3 w-3" />
                            Set time
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSuggestTime(ev)}
                            disabled={isSuggesting}
                            title="Suggest time with AI"
                            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 disabled:opacity-50"
                          >
                            {isSuggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Status dot + Logo + Company + Report Type */}
                    <div className="flex min-w-0 flex-1 items-start gap-2.5">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_COLORS[ev.status]}`} aria-label={`Status: ${STATUS_LABELS[ev.status]}`} />
                      <CompanyLogo logoUrl={company?.logo_url} websiteUrl={company?.website_url} name={company?.name} size="sm" className="mt-0.5" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {company?.id ? (
                            <Link to={`/companies/${company.id}`} className="font-medium text-foreground hover:text-[var(--color-accent)] transition-colors">
                              {company.name}
                            </Link>
                          ) : (
                            <span className="font-medium text-foreground">Unknown</span>
                          )}
                          {company?.ticker && <span className="text-xs text-muted-foreground">({company.ticker})</span>}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {editingReportTypeEventId === ev.id ? (
                            <div className="flex items-center gap-1">
                              <select
                                value={editReportTypeValue}
                                onChange={(e) => setEditReportTypeValue(e.target.value)}
                                className="h-6 rounded border border-border bg-background px-1 text-xs text-foreground"
                                autoFocus
                              >
                                {Object.entries(REPORT_TYPE_LABELS).map(([key, label]) => (
                                  <option key={key} value={key}>{label}</option>
                                ))}
                              </select>
                              <button type="button" onClick={() => handleReportTypeSave(ev.id)} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-[var(--color-signal-green)] hover:bg-[var(--color-signal-green)]/10">
                                <Check className="h-3 w-3" />
                              </button>
                              <button type="button" onClick={() => setEditingReportTypeEventId(null)} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-muted-foreground hover:bg-accent">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => { setEditingReportTypeEventId(ev.id); setEditReportTypeValue(ev.report_type) }}
                                className="hover:text-[var(--color-accent)] transition-colors"
                              >
                                {REPORT_TYPE_LABELS[ev.report_type]}
                              </button>
                              {' · FY '}{ev.fiscal_year}
                              {ev.fiscal_quarter ? ` Q${ev.fiscal_quarter}` : ''}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status badge */}
                    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[ev.status]}`}>
                      {STATUS_LABELS[ev.status]}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        ) : (
          <>
            {/* ============ Calendar View ============ */}
            {/* Month Navigation */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goToPrevMonth}
                  aria-label="Previous month"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <h2 className="min-w-[160px] text-center text-base font-semibold text-foreground">{monthLabel}</h2>
                <button
                  type="button"
                  onClick={goToNextMonth}
                  aria-label="Next month"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <Button variant="outline" size="sm" onClick={goToToday}>Today</Button>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 rounded-t-xl border border-b-0 border-border bg-card">
              {WEEKDAYS.map((day) => (
                <div key={day} className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>

            {/* Day Grid */}
            <div className="grid grid-cols-7 rounded-b-xl border border-border bg-card">
              {monthDays.map(({ date, day, isCurrentMonth }, idx) => {
                const dayEvents = eventsByDate[date] ?? []
                const isToday = date === todayStr
                const isSelected = date === selectedDate
                const hasEvents = dayEvents.length > 0

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedDate(isSelected ? null : date)}
                    className={`relative flex min-h-[72px] sm:min-h-[84px] flex-col items-start p-1.5 sm:p-2 text-left transition-colors border-t border-r border-border ${
                      idx % 7 === 0 ? '' : ''
                    } ${idx < 7 ? 'border-t-0' : ''} ${(idx + 1) % 7 === 0 ? 'border-r-0' : ''} ${
                      isSelected
                        ? 'bg-[var(--color-accent)]/10 ring-1 ring-inset ring-[var(--color-accent)]/40'
                        : hasEvents
                          ? 'hover:bg-[var(--color-bg-tertiary)]'
                          : 'hover:bg-[var(--color-bg-tertiary)]/50'
                    } ${!isCurrentMonth ? 'opacity-35' : ''}`}
                    aria-label={`${date}${hasEvents ? `, ${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}` : ''}`}
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                        isToday
                          ? 'bg-[var(--color-accent)] text-white'
                          : 'text-foreground'
                      }`}
                    >
                      {day}
                    </span>
                    {hasEvents && (
                      <div className="mt-auto flex flex-wrap gap-1 pt-1">
                        {dayEvents.slice(0, 4).map((ev) => (
                          <span
                            key={ev.id}
                            className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_COLORS[ev.status]}`}
                            title={`${(ev.companies as { name: string } | undefined)?.name ?? 'Unknown'} — ${STATUS_LABELS[ev.status]}`}
                          />
                        ))}
                        {dayEvents.length > 4 && (
                          <span className="text-[10px] leading-none text-muted-foreground">+{dayEvents.length - 4}</span>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Selected Day Events */}
            {selectedDate && (
              <div className="mt-4">
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  {' '}
                  <span className="font-normal text-muted-foreground">
                    ({selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? 's' : ''})
                  </span>
                </h3>
                {selectedDayEvents.length === 0 ? (
                  <div className="rounded-xl border border-border bg-card p-6 text-center">
                    <p className="text-sm text-muted-foreground">No events on this day.</p>
                    <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(true)} className="mt-3">
                      <Plus className="h-3.5 w-3.5" />
                      Add Event
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedDayEvents.map((ev) => {
                      const company = ev.companies as { id: string; name: string; ticker: string | null; logo_url: string | null; website_url: string | null } | undefined
                      const timeStr = ev.expected_time ? ev.expected_time.slice(0, 5) : null
                      const isEditingTime = editingTimeEventId === ev.id
                      const isSuggesting = suggestingEventId === ev.id

                      return (
                        <div
                          key={ev.id}
                          className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-[var(--color-bg-tertiary)]"
                        >
                          {/* Time — inline editable */}
                          <div className="sm:w-28 shrink-0">
                            {isEditingTime ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="time"
                                  value={editTimeValue}
                                  onChange={(e) => setEditTimeValue(e.target.value)}
                                  className="h-7 w-24 rounded border border-border bg-background px-2 text-xs text-foreground"
                                  autoFocus
                                />
                                <button type="button" onClick={() => handleTimeSave(ev.id)} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-[var(--color-signal-green)] hover:bg-[var(--color-signal-green)]/10">
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                                <button type="button" onClick={() => setEditingTimeEventId(null)} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-muted-foreground hover:bg-accent">
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : timeStr ? (
                              <button
                                type="button"
                                onClick={() => { setEditingTimeEventId(ev.id); setEditTimeValue(timeStr) }}
                                className="text-sm font-semibold text-foreground hover:text-[var(--color-accent)] transition-colors"
                              >
                                {timeStr} <span className="text-[11px] font-normal text-muted-foreground">CET</span>
                              </button>
                            ) : (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => { setEditingTimeEventId(ev.id); setEditTimeValue('07:00') }}
                                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-[var(--color-accent)] transition-colors"
                                >
                                  <Clock className="h-3 w-3" />
                                  Set time
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSuggestTime(ev)}
                                  disabled={isSuggesting}
                                  title="Suggest time with AI"
                                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 disabled:opacity-50"
                                >
                                  {isSuggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Status dot + Logo + Company + Report Type */}
                          <div className="flex min-w-0 flex-1 items-start gap-2.5">
                            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_COLORS[ev.status]}`} aria-label={`Status: ${STATUS_LABELS[ev.status]}`} />
                            <CompanyLogo logoUrl={company?.logo_url} websiteUrl={company?.website_url} name={company?.name} size="sm" className="mt-0.5" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                {company?.id ? (
                                  <Link to={`/companies/${company.id}`} className="font-medium text-foreground hover:text-[var(--color-accent)] transition-colors">
                                    {company.name}
                                  </Link>
                                ) : (
                                  <span className="font-medium text-foreground">Unknown</span>
                                )}
                                {company?.ticker && (
                                  <span className="text-xs text-muted-foreground">({company.ticker})</span>
                                )}
                              </div>
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                {editingReportTypeEventId === ev.id ? (
                                  <div className="flex items-center gap-1">
                                    <select
                                      value={editReportTypeValue}
                                      onChange={(e) => setEditReportTypeValue(e.target.value)}
                                      className="h-6 rounded border border-border bg-background px-1 text-xs text-foreground"
                                      autoFocus
                                    >
                                      {Object.entries(REPORT_TYPE_LABELS).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                      ))}
                                    </select>
                                    <button type="button" onClick={() => handleReportTypeSave(ev.id)} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-[var(--color-signal-green)] hover:bg-[var(--color-signal-green)]/10">
                                      <Check className="h-3 w-3" />
                                    </button>
                                    <button type="button" onClick={() => setEditingReportTypeEventId(null)} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-muted-foreground hover:bg-accent">
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => { setEditingReportTypeEventId(ev.id); setEditReportTypeValue(ev.report_type) }}
                                      className="hover:text-[var(--color-accent)] transition-colors"
                                    >
                                      {REPORT_TYPE_LABELS[ev.report_type]}
                                    </button>
                                    {' · FY '}{ev.fiscal_year}
                                    {ev.fiscal_quarter ? ` Q${ev.fiscal_quarter}` : ''}
                                    {ev.notes && ` · ${ev.notes}`}
                                  </>
                                )}
                              </div>
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
                                aria-label="Check IR page for new publication"
                                title="Check IR page now for new publications"
                                onClick={() => {
                                  setCheckingEventId(ev.id)
                                  checkMutation.mutate(ev.id, {
                                    onSuccess: () => { toast.success('Check completed'); setCheckingEventId(null) },
                                    onError: (err) => { toast.error(`Check failed: ${err.message}`); setCheckingEventId(null) },
                                  })
                                }}
                                disabled={checkingEventId === ev.id}
                              >
                                <RefreshCw className={`h-3.5 w-3.5 ${checkingEventId === ev.id ? 'animate-spin' : ''}`} />
                              </Button>
                            )}
                            {ev.report_id && (
                              <Link
                                to={`/uploaded-reports/${ev.report_id}`}
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
                )}
              </div>
            )}

            {/* No events at all — prompt */}
            {(events ?? []).length === 0 && !selectedDate && (
              <div className="mt-6 rounded-xl border border-border bg-card p-12 text-center">
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
            )}
          </>
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
      <Helmet><title>Publication Calendar - Valrano</title><meta name="robots" content="noindex" /></Helmet>
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
          <Badge variant="outline" className="text-[10px]">
            {TIER_LABELS[tier] ?? TIER_LABELS.starter}
          </Badge>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Company */}
          <div>
            <label htmlFor="event-company" className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Company</label>
            <Select value={companyId} onValueChange={(v) => { if (v) { handleCompanyChange(v); setTouched((t) => ({ ...t, company: true })) } }}>
              <SelectTrigger id="event-company" className={`w-full ${companyInvalid ? 'border-[var(--color-signal-red)]' : ''}`} aria-invalid={companyInvalid}>
                <span className="truncate">{selectedCompanyName || 'Select company'}</span>
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
                  <SelectValue>{REPORT_TYPE_LABELS[reportType]}</SelectValue>
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
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base md:text-sm text-foreground"
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
          <Button
            type="button"
            onClick={handleSuggestDates}
            disabled={suggestDatesMutation.isPending || !companyId}
            className="w-full bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent)]/90 font-semibold py-5 text-sm shadow-sm"
          >
            {suggestDatesMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {suggestDatesMutation.isPending ? 'Predicting...' : 'Suggest Date & Time with AI'}
          </Button>

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
                className={`w-full rounded-lg border bg-background px-3 py-2 text-base md:text-sm text-foreground ${dateInvalid ? 'border-[var(--color-signal-red)]' : 'border-border'}`}
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
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base md:text-sm text-foreground"
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
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base md:text-sm text-foreground"
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
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base md:text-sm text-foreground"
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
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-base md:text-sm text-foreground"
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
