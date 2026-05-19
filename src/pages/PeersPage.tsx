import { useState, useEffect, useRef, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useCompanies, useReports, useKpiDefinitions, useKpiValues } from '@/hooks/useData'
import { usePrimaryCompany } from '@/hooks/useMyCompany'
import { usePublicationEvents, useCheckPublication } from '@/hooks/useCalendar'
import type { Company, ReportType, PublicationEventStatus } from '@/types/database'
import { REPORT_TYPE_LABELS } from '@/lib/constants'
import { CompanyAutocomplete, type CompanyResult } from '@/components/company-autocomplete'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { CardSkeleton } from '@/components/ui/page-skeleton'
import { Badge } from '@/components/ui/badge'
import { CompanyLogo } from '@/components/ui/company-logo'
import {
  Plus,
  Upload,
  RefreshCw,
  Building2,
  Loader2,
  Search,
  CalendarDays,
  ClipboardCheck,
  LayoutGrid,
  Table2,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { UploadReportDialog } from '@/components/upload-report-dialog'
import { cn } from '@/lib/utils'
import { EmptyState as SharedEmptyState } from '@/components/ui/empty-state'
import { Link } from 'react-router-dom'
import { lazy, Suspense } from 'react'

const CalendarPage = lazy(() => import('./CalendarPage').then(m => ({ default: m.CalendarPage })))
const ReviewPage = lazy(() => import('./ReviewPage').then(m => ({ default: m.ReviewPage })))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// CompanyLogo imported from '@/components/ui/company-logo'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------


const STATUS_COLORS: Record<PublicationEventStatus, string> = {
  scheduled: 'bg-[var(--color-financial-blue)]',
  due_today: 'bg-[var(--color-signal-amber)]',
  overdue: 'bg-[var(--color-signal-red)]',
  detected: 'bg-[var(--color-signal-green)]',
  ingested: 'bg-[var(--color-signal-amber)]',
  benchmark_ready: 'bg-[var(--color-accent)]',
  cancelled: 'bg-zinc-400',
}

const MONITORING_ACTIVE_STATUSES: PublicationEventStatus[] = ['scheduled', 'due_today', 'overdue']

const TABLE_KPI_CODES = ['REVENUE', 'EBITDA_MARGIN', 'NET_DEBT_EBITDA', 'ROIC'] as const

/** KPIs where lower = better */
const LOWER_IS_BETTER = new Set(['NET_DEBT_EBITDA'])

const TABLE_KPI_LABELS: Record<string, string> = {
  REVENUE: 'Revenue',
  EBITDA_MARGIN: 'EBITDA Margin',
  NET_DEBT_EBITDA: 'Net Debt / EBITDA',
  ROIC: 'ROIC',
}

const TABLE_KPI_FORMATS: Record<string, (v: number) => string> = {
  REVENUE: (v) => {
    if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}B`
    if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`
    if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}K`
    return v.toFixed(0)
  },
  EBITDA_MARGIN: (v) => `${v.toFixed(1)}%`,
  NET_DEBT_EBITDA: (v) => `${v.toFixed(1)}x`,
  ROIC: (v) => `${v.toFixed(1)}%`,
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PeerCardData {
  company: Company
  isMonitoring: boolean
  monitoringStatus: PublicationEventStatus | null
  lastReport: { type: ReportType; date: string } | null
  nextExpectedDate: string | null
  kpiExtracted: number
  kpiPendingReview: number
  nextEventId: string | null
  scheduledCount: number
}

// ---------------------------------------------------------------------------
// Constants — Add Company Dialog
// ---------------------------------------------------------------------------

const EXCHANGE_OPTIONS = ['NYSE', 'NASDAQ', 'LSE', 'SIX', 'XETRA', 'Euronext', 'Other'] as const
const SECTOR_OPTIONS = [
  'Construction & Materials',
  'Industrials',
  'Technology',
  'Healthcare',
  'Financial Services',
  'Consumer Goods',
  'Energy',
  'Utilities',
  'Real Estate',
  'Telecommunications',
  'Other',
] as const

// ---------------------------------------------------------------------------
// Add Company Dialog
// ---------------------------------------------------------------------------

function AddCompanyDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [ticker, setTicker] = useState('')
  const [exchange, setExchange] = useState('')
  const [sector, setSector] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [isResolvingWebsite, setIsResolvingWebsite] = useState(false)
  const [isEnriching, setIsEnriching] = useState(false)
  const [irUrl, setIrUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [nameError, setNameError] = useState(false)

  const resolveWebsite = async (companyName: string) => {
    if (!companyName.trim() || companyName.trim().length < 2) return
    setIsResolvingWebsite(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-company-website`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ name: companyName.trim() }),
        },
      )
      if (!res.ok) return
      const data = await res.json() as {
        website_url: string | null
        needs_confirmation?: boolean
      }
      if (data.website_url) {
        setWebsiteUrl(data.website_url)
        if (data.needs_confirmation) {
          toast.info('Suggested website — please verify before adding peer')
        }
      }
    } catch {
      // Silently fail — user can still enter manually
    } finally {
      setIsResolvingWebsite(false)
    }
  }

  const enrichCompany = async (companyName: string, wikidataId?: string | null) => {
    setIsEnriching(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enrich-company`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ name: companyName, wikidata_id: wikidataId }),
        },
      )
      if (!res.ok) return
      const data = await res.json() as { ticker: string | null; exchange: string | null; sector: string | null; ir_url: string | null }
      if (data.ticker) setTicker(data.ticker)
      if (data.exchange) setExchange(data.exchange)
      if (data.sector) setSector(data.sector)
      if (data.ir_url) setIrUrl(data.ir_url)
    } catch {
      // Silently fail — user can enter manually
    } finally {
      setIsEnriching(false)
    }
  }

  const handleCompanyAutoSelect = (company: CompanyResult) => {
    setName(company.name)
    if (company.sector) {
      const sectorVal = company.sector
      // Map to closest matching SECTOR_OPTIONS value
      const match = SECTOR_OPTIONS.find((s) =>
        sectorVal.toLowerCase().includes(s.toLowerCase()) ||
        s.toLowerCase().includes(sectorVal.split(' ')[0].toLowerCase()),
      )
      if (match) setSector(match)
    }
    setNameError(false)
    // Auto-resolve website URL and enrich ticker/exchange/sector in parallel
    resolveWebsite(company.name)
    enrichCompany(company.name, company.uid)
  }

  const resetForm = () => {
    setName('')
    setTicker('')
    setExchange('')
    setSector('')
    setWebsiteUrl('')
    setIrUrl('')
    setNameError(false)
    setIsEnriching(false)
  }

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      onClose()
      resetForm()
    }
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      setNameError(true)
      return
    }
    setNameError(false)
    setIsSubmitting(true)

    try {
      // If no website URL yet, try to resolve before inserting
      let finalWebsiteUrl = websiteUrl.trim() || null
      if (!finalWebsiteUrl) {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            const res = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-company-website`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
                  'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({ name: name.trim() }),
              },
            )
            if (res.ok) {
              const data = await res.json() as {
                website_url: string | null
                needs_confirmation?: boolean
              }
              // Only use auto-resolved URL if high confidence
              if (data.website_url && !data.needs_confirmation) {
                finalWebsiteUrl = data.website_url
              }
            }
          }
        } catch {
          // Continue without website — not critical
        }
      }

      const { data: { user } } = await supabase.auth.getUser()
      const { data: newCompany, error } = await supabase
        .from('companies')
        .insert({
          name: name.trim(),
          ticker: ticker.trim().toUpperCase() || null,
          exchange: exchange || null,
          sector: sector || null,
          website_url: finalWebsiteUrl,
          ir_page_url: irUrl.trim() || null,
          created_by: user?.id,
        })
        .select()
        .single()

      if (error) throw error

      // Add company to user's default peer group (or create one)
      if (newCompany?.id) {
        const { data: existingGroups } = await supabase
          .from('peer_groups')
          .select('id')
          .order('created_at', { ascending: true })
          .limit(1)

        let pgId: string
        if (existingGroups?.length) {
          pgId = existingGroups[0].id
        } else {
          const { data: newPg, error: pgError } = await supabase
            .from('peer_groups')
            .insert({ name: 'Default', description: 'Auto-created peer group', owner_id: user?.id })
            .select()
            .single()
          if (pgError) throw pgError
          pgId = newPg.id
        }

        await supabase
          .from('peer_group_members')
          .upsert({ peer_group_id: pgId, company_id: newCompany.id }, { onConflict: 'peer_group_id,company_id' })
      }

      // Non-blocking: auto-resolve IR URL for the new company
      if (newCompany?.id && !irUrl.trim()) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session) return
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-ir-url`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ company_id: newCompany.id, company_name: newCompany.name }),
          }).catch(() => {})
        })
      }

      // Non-blocking: auto-fetch news for the new company
      if (newCompany?.id) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session) return
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-company-news`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ company_id: newCompany.id }),
          }).catch(() => {})
        })
      }

      await queryClient.invalidateQueries({ queryKey: ['companies'] })
      await queryClient.invalidateQueries({ queryKey: ['visible-company-ids'] })
      await queryClient.invalidateQueries({ queryKey: ['peer-groups'] })
      toast.success(`Added "${name.trim()}" to peer group`)
      onClose()
      resetForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add company')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Company</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Company Name */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Company Name <span className="text-[var(--color-destructive)]">*</span>
            </Label>
            <CompanyAutocomplete
              value={name}
              onChange={(v) => { setName(v); setNameError(false) }}
              onSelect={handleCompanyAutoSelect}
              placeholder="Start typing to search..."
              className={cn(
                'rounded-lg border-border bg-[var(--color-bg-tertiary)] text-[13px] text-foreground',
                nameError && 'border-[var(--color-destructive)]',
              )}
            />
            <p className="text-[10px] text-muted-foreground">
              Type 3+ letters to search — ticker, exchange, sector & website auto-filled
            </p>
            {nameError && (
              <p className="text-[11px] text-[var(--color-destructive)]">Company name is required</p>
            )}
          </div>

          {/* Ticker */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Ticker
            </Label>
            <div className="relative">
              <Input
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder={isEnriching ? 'Looking up...' : 'e.g. HOLN'}
                className="rounded-lg border-border bg-[var(--color-bg-tertiary)] text-[13px] text-foreground pr-10"
                disabled={isEnriching}
              />
              {isEnriching && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Exchange */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Exchange
            </Label>
            <Select value={exchange} onValueChange={(v) => v && setExchange(v)} disabled={isEnriching}>
              <SelectTrigger className="w-full rounded-lg border-border bg-[var(--color-bg-tertiary)] text-[13px] text-foreground">
                <SelectValue placeholder={isEnriching ? 'Looking up...' : 'Select exchange'} />
              </SelectTrigger>
              <SelectContent className="rounded-lg border-border bg-card text-[13px]">
                {EXCHANGE_OPTIONS.map((ex) => (
                  <SelectItem key={ex} value={ex} className="text-[13px]">{ex}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sector */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Sector
            </Label>
            <Select value={sector} onValueChange={(v) => v && setSector(v)} disabled={isEnriching}>
              <SelectTrigger className="w-full rounded-lg border-border bg-[var(--color-bg-tertiary)] text-[13px] text-foreground">
                <SelectValue placeholder={isEnriching ? 'Looking up...' : 'Select sector'} />
              </SelectTrigger>
              <SelectContent className="rounded-lg border-border bg-card text-[13px]">
                {SECTOR_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="text-[13px]">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Website URL (used for logo) — auto-resolved via edge function */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Website
            </Label>
            <div className="relative">
              <Input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder={isResolvingWebsite ? 'Resolving...' : 'https://www.holcim.com'}
                className="rounded-lg border-border bg-[var(--color-bg-tertiary)] text-[13px] text-foreground pr-10"
                disabled={isResolvingWebsite}
              />
              {isResolvingWebsite && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
              {!isResolvingWebsite && websiteUrl && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <CompanyLogo websiteUrl={websiteUrl} size="xs" />
                </div>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Auto-detected from company name — logo fetched automatically
            </p>
          </div>

          {/* IR Page URL */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              IR Page URL
            </Label>
            <Input
              type="url"
              value={irUrl}
              onChange={(e) => setIrUrl(e.target.value)}
              placeholder="https://www.example.com/investors"
              className="rounded-lg border-border bg-[var(--color-bg-tertiary)] text-[13px] text-foreground"
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Add Company
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Peer Card
// ---------------------------------------------------------------------------

function PeerCard({
  peer,
  onUpload,
  onCheckNow,
  onDelete,
  isChecking,
  isDeleting,
  totalKpiDefinitions,
  userSector,
}: {
  peer: PeerCardData
  onUpload: (companyId: string) => void
  onCheckNow: (eventId: string) => void
  onDelete: (companyId: string, companyName: string) => void
  isChecking: boolean
  isDeleting: boolean
  totalKpiDefinitions: number
  userSector: string | null
}) {
  const { company, isMonitoring, monitoringStatus, lastReport, nextExpectedDate, kpiExtracted, kpiPendingReview, nextEventId, scheduledCount } = peer

  const completenessPercent = totalKpiDefinitions > 0
    ? Math.round((kpiExtracted / totalKpiDefinitions) * 100)
    : 0

  const completenessColor =
    completenessPercent > 75
      ? 'bg-[var(--color-signal-green)]'
      : completenessPercent >= 25
      ? 'bg-[var(--color-signal-amber)]'
      : 'bg-[var(--color-signal-red)]'

  const sectorMatch = !!(userSector && company.sector && company.sector === userSector)

  return (
    <div className="card-premium rounded-xl border border-border bg-card p-3 sm:p-5 transition-colors hover:border-[var(--color-primary)]/30">
      {/* Header: Company name (clickable) + actions */}
      <div className="flex items-start justify-between gap-2">
        <Link to={`/companies/${company.id}`} className="flex items-center gap-2.5 min-w-0 group">
          <CompanyLogo logoUrl={company.logo_url} websiteUrl={company.website_url} name={company.name} size="md" className="rounded-md" />
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-foreground truncate group-hover:text-[var(--color-accent)] transition-colors">
              {company.name}
            </h2>
            {company.ticker && (
              <span className="text-[11px] text-muted-foreground">
                {company.ticker}{company.exchange ? ` · ${company.exchange}` : ''}
              </span>
            )}
          </div>
        </Link>
        <div className="flex items-center gap-1 shrink-0">
          <span
            className={cn(
              'h-2.5 w-2.5 rounded-full mr-1',
              isMonitoring
                ? STATUS_COLORS[monitoringStatus ?? 'scheduled']
                : 'bg-zinc-400',
              isMonitoring && (monitoringStatus === 'overdue' || monitoringStatus === 'due_today') && 'status-pulse',
            )}
            aria-label={`Monitoring: ${isMonitoring ? (monitoringStatus ?? 'scheduled').replace('_', ' ') : 'inactive'}`}
          />
          <TooltipProvider delay={200}>
            <Tooltip>
              <TooltipTrigger
                className={cn(
                  'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground',
                  'hover:bg-accent hover:text-foreground transition-colors',
                )}
                onClick={() => onUpload(company.id)}
              >
                <Upload className="h-3.5 w-3.5" />
              </TooltipTrigger>
              <TooltipContent side="bottom">Upload Report</TooltipContent>
            </Tooltip>
            {nextEventId && MONITORING_ACTIVE_STATUSES.includes(monitoringStatus!) && (
              <Tooltip>
                <TooltipTrigger
                  className={cn(
                    'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground',
                    'hover:bg-accent hover:text-foreground transition-colors',
                    isChecking && 'pointer-events-none opacity-50',
                  )}
                  onClick={() => onCheckNow(nextEventId)}
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', isChecking && 'animate-spin')} />
                </TooltipTrigger>
                <TooltipContent side="bottom">Check for new publication</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger
                className={cn(
                  'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground',
                  'hover:bg-destructive/10 hover:text-destructive transition-colors',
                  isDeleting && 'pointer-events-none opacity-50',
                )}
                onClick={() => onDelete(company.id, company.name)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </TooltipTrigger>
              <TooltipContent side="bottom">Remove peer</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Info rows */}
      <div className="mt-4 space-y-2">
        {/* Last report */}
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-muted-foreground">Last report</span>
          <span className="font-medium text-foreground">
            {lastReport
              ? `${REPORT_TYPE_LABELS[lastReport.type]} · ${new Date(lastReport.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
              : 'None'}
          </span>
        </div>

        {/* Next expected */}
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-muted-foreground">Next expected</span>
          <span className="font-medium text-foreground">
            {nextExpectedDate
              ? new Date(nextExpectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : 'Not set'}
          </span>
        </div>

        {/* Scheduled dates */}
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-muted-foreground">Scheduled dates</span>
          <span className="font-medium text-foreground">
            {scheduledCount > 0 ? (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3 w-3 text-muted-foreground" />
                {scheduledCount} event{scheduledCount !== 1 ? 's' : ''}
              </span>
            ) : (
              <span className="text-muted-foreground">None</span>
            )}
          </span>
        </div>

        {/* KPI extraction summary */}
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-muted-foreground">KPI extraction</span>
          <span className="font-medium text-foreground">
            {kpiExtracted > 0 ? (
              <>
                {kpiExtracted} extracted
                {kpiPendingReview > 0 && (
                  <span className="ml-1 text-[var(--color-signal-amber)]">
                    ({kpiPendingReview} pending review)
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">No data</span>
            )}
          </span>
        </div>
      </div>

      {/* Data completeness + Sector match */}
      <div className="mt-3 space-y-2">
        {/* Data completeness bar */}
        {totalKpiDefinitions > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Data completeness</span>
              <span className="font-medium tabular-nums text-foreground">
                {kpiExtracted}/{totalKpiDefinitions} KPIs
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[var(--color-bg-tertiary)]">
              <div
                className={cn('h-full rounded-full transition-all duration-500', completenessColor)}
                style={{ width: `${Math.min(completenessPercent, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Sector match badge */}
        {sectorMatch && (
          <Badge variant="secondary" className="bg-[var(--color-accent)]/10 text-[10px] text-[var(--color-accent)]">
            Same sector
          </Badge>
        )}
      </div>

      {/* View Details link */}
      <Link
        to={`/companies/${company.id}`}
        className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/5"
      >
        View Details
        <ArrowUpRight className="h-3 w-3" />
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Comparison Table View
// ---------------------------------------------------------------------------

function ComparisonTableView({
  peerCards,
  userCompanyName,
  userCompanySector,
  userCompanyId,
  allCompanyIds,
  onUpload,
  onCheckNow,
  onDelete,
  deletingCompanyId,
  checkingEventId,
}: {
  peerCards: PeerCardData[]
  userCompanyName: string | null
  userCompanySector: string | null
  userCompanyId: string | null
  allCompanyIds: string[]
  onUpload: (companyId: string) => void
  onCheckNow: (eventId: string) => void
  onDelete: (companyId: string, companyName: string) => void
  deletingCompanyId: string | null
  checkingEventId: string | null
}) {
  // Fetch KPI values for all companies (peers + user's company if linked)
  const { data: kpiValues, isLoading: kpiLoading } = useKpiValues({
    companyIds: allCompanyIds.length > 0 ? allCompanyIds : undefined,
    kpiCodes: [...TABLE_KPI_CODES],
  })

  // Build a lookup: companyId -> kpiCode -> latest value
  const kpiLookup = useMemo(() => {
    const lookup: Record<string, Record<string, { value: number; year: number }>> = {}
    for (const kv of kpiValues ?? []) {
      const code = kv.kpi_definitions?.code
      if (!code) continue
      const val = kv.normalized_value ?? kv.raw_value
      if (val == null) continue

      if (!lookup[kv.company_id]) lookup[kv.company_id] = {}
      const existing = lookup[kv.company_id][code]
      if (!existing || kv.fiscal_year > existing.year) {
        lookup[kv.company_id][code] = { value: val, year: kv.fiscal_year }
      }
    }
    return lookup
  }, [kpiValues])

  // Find fiscal year for last report per company
  const lastReportYear = useMemo(() => {
    const years: Record<string, number> = {}
    for (const kv of kpiValues ?? []) {
      if (!years[kv.company_id] || kv.fiscal_year > years[kv.company_id]) {
        years[kv.company_id] = kv.fiscal_year
      }
    }
    return years
  }, [kpiValues])

  // User's company KPI values for comparison coloring
  const userKpis = userCompanyId ? kpiLookup[userCompanyId] : null

  // Build rows: user company first (if exists), then peers
  const rows = useMemo(() => {
    const result: { companyId: string; name: string; sector: string | null; isUser: boolean }[] = []

    if (userCompanyId && userCompanyName) {
      result.push({
        companyId: userCompanyId,
        name: userCompanyName,
        sector: userCompanySector,
        isUser: true,
      })
    }

    for (const peer of peerCards) {
      // Skip if this is the user's company (already added as first row)
      if (userCompanyId && peer.company.id === userCompanyId) continue
      result.push({
        companyId: peer.company.id,
        name: peer.company.name,
        sector: peer.company.sector ?? null,
        isUser: false,
      })
    }

    return result
  }, [peerCards, userCompanyId, userCompanyName, userCompanySector])

  if (kpiLoading) {
    return <CardSkeleton />
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-12 text-center">
        <Table2 className="mb-3 h-6 w-6 text-muted-foreground" />
        <p className="text-[13px] text-muted-foreground">No data available for comparison table</p>
      </div>
    )
  }

  const renderCellValue = (companyId: string, kpiCode: string, isUserRow: boolean) => {
    const entry = kpiLookup[companyId]?.[kpiCode]
    if (!entry) return <span className="text-muted-foreground">--</span>

    const formatted = TABLE_KPI_FORMATS[kpiCode]?.(entry.value) ?? entry.value.toFixed(1)

    // Color coding for peer rows vs user
    if (!isUserRow && userKpis?.[kpiCode]) {
      const userVal = userKpis[kpiCode].value
      const peerVal = entry.value
      const lowerBetter = LOWER_IS_BETTER.has(kpiCode)
      const isBetter = lowerBetter ? peerVal < userVal : peerVal > userVal
      const isWorse = lowerBetter ? peerVal > userVal : peerVal < userVal

      if (isBetter) {
        return (
          <span className="inline-flex items-center gap-0.5 text-[var(--color-signal-green)]">
            {formatted}
            <ArrowUpRight className="h-3 w-3" />
          </span>
        )
      }
      if (isWorse) {
        return (
          <span className="inline-flex items-center gap-0.5 text-[var(--color-signal-red)]">
            {formatted}
            <ArrowDownRight className="h-3 w-3" />
          </span>
        )
      }
    }

    return <span>{formatted}</span>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[800px] text-[13px]" aria-label="Peer companies">
        <thead>
          <tr className="border-b border-border bg-[var(--color-bg-tertiary)]">
            <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Company
            </th>
            {TABLE_KPI_CODES.map((code) => (
              <th
                scope="col"
                key={code}
                className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground"
              >
                {TABLE_KPI_LABELS[code]}
              </th>
            ))}
            <th scope="col" className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Last Report
            </th>
            <th scope="col" className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const peer = peerCards.find((p) => p.company.id === row.companyId)
            return (
              <tr
                key={row.companyId}
                className={cn(
                  'border-b border-border last:border-b-0 transition-colors hover:bg-[var(--color-bg-tertiary)]/50',
                  row.isUser && 'border-l-2 border-l-[var(--color-accent)] bg-[var(--color-accent)]/5',
                )}
              >
                <td className="px-4 py-3">
                  <Link to={`/companies/${row.companyId}`} className="flex items-center gap-2.5 group">
                    <CompanyLogo logoUrl={peer?.company.logo_url} websiteUrl={peer?.company.website_url} name={row.name} size="sm" />
                    <span className="font-medium text-foreground group-hover:text-[var(--color-accent)] transition-colors">{row.name}</span>
                    {row.isUser && (
                      <span className="rounded-full bg-[var(--color-accent)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-accent)]">
                        You
                      </span>
                    )}
                  </Link>
                </td>
                {TABLE_KPI_CODES.map((code) => (
                  <td key={code} className="px-4 py-3 text-right font-medium tabular-nums text-foreground">
                    {renderCellValue(row.companyId, code, row.isUser)}
                  </td>
                ))}
                <td className="px-4 py-3 text-right tabular-nums text-foreground">
                  {lastReportYear[row.companyId] ?? <span className="text-muted-foreground">--</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  {!row.isUser && (() => {
                    const peer = peerCards.find((p) => p.company.id === row.companyId)
                    const nextEventId = peer?.nextEventId
                    const monitoringStatus = peer?.monitoringStatus
                    const showCheck = nextEventId && monitoringStatus && MONITORING_ACTIVE_STATUSES.includes(monitoringStatus)
                    return (
                      <div className="flex items-center justify-end gap-1">
                        <TooltipProvider delay={200}>
                          <Tooltip>
                            <TooltipTrigger
                              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                              onClick={() => onUpload(row.companyId)}
                            >
                              <Upload className="h-3.5 w-3.5" />
                            </TooltipTrigger>
                            <TooltipContent side="bottom">Upload Report</TooltipContent>
                          </Tooltip>
                          {showCheck && (
                            <Tooltip>
                              <TooltipTrigger
                                className={cn(
                                  'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors',
                                  checkingEventId === nextEventId && 'pointer-events-none opacity-50',
                                )}
                                onClick={() => onCheckNow(nextEventId)}
                              >
                                <RefreshCw className={cn('h-3.5 w-3.5', checkingEventId === nextEventId && 'animate-spin')} />
                              </TooltipTrigger>
                              <TooltipContent side="bottom">Check for new publication</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger
                              className={cn(
                                'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors',
                                deletingCompanyId === row.companyId && 'pointer-events-none opacity-50',
                              )}
                              onClick={() => onDelete(row.companyId, row.name)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </TooltipTrigger>
                            <TooltipContent side="bottom">Remove peer</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    )
                  })()}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty State — uses shared EmptyState component
// ---------------------------------------------------------------------------

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <SharedEmptyState
      icon={<Building2 className="h-6 w-6" />}
      title="No peers configured"
      description="Add competitor companies to your peer group to start monitoring their publications and extracting KPIs."
      actionLabel="Add Peer"
      onAction={onAdd}
      actionIcon={<Plus className="h-4 w-4" />}
    />
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const PEER_TABS = [
  { id: 'competitors', label: 'Competitors', icon: Building2 },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'review', label: 'Review Queue', icon: ClipboardCheck },
] as const

type PeerTabId = (typeof PEER_TABS)[number]['id']

const peerTabCls = (isActive: boolean) =>
  `flex flex-shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
    isActive
      ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
      : 'text-muted-foreground hover:bg-[var(--color-bg-tertiary)] hover:text-foreground'
  }`

export function PeersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab') || 'competitors'
  // tab=upload is handled by CompetitorsTab with auto-open dialog
  const activeTab = (rawTab === 'upload' ? 'competitors' : rawTab) as PeerTabId
  const autoUploadCompanyId = rawTab === 'upload' ? searchParams.get('company') ?? undefined : undefined

  return (
    <>
      <Helmet><title>Peers - Valrano</title><meta name="robots" content="noindex" /></Helmet>
      <div className="section-fade-in mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">
            Peers
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Manage competitors, publication schedules, and review extracted KPIs
          </p>
        </div>

        {/* Tab bar */}
        <div
          role="tablist"
          aria-label="Peers sections"
          className="mb-6 flex items-center gap-1 border-b border-border pb-3"
        >
          {PEER_TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              id={`peer-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`peer-tabpanel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setSearchParams({ tab: tab.id })}
              className={peerTabCls(activeTab === tab.id)}
            >
              <tab.icon className="h-4 w-4" aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab panels */}
        <div
          role="tabpanel"
          id={`peer-tabpanel-${activeTab}`}
          aria-labelledby={`peer-tab-${activeTab}`}
        >
          {activeTab === 'competitors' && <CompetitorsTab autoUploadCompanyId={autoUploadCompanyId} />}
          <Suspense fallback={<CardSkeleton />}>
            {activeTab === 'calendar' && <CalendarPage embedded />}
            {activeTab === 'review' && <ReviewPage embedded />}
          </Suspense>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// View Toggle
// ---------------------------------------------------------------------------

type ViewMode = 'cards' | 'table'

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-[var(--color-bg-tertiary)] p-0.5">
      <button
        onClick={() => onChange('cards')}
        aria-label="Card view"
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-all min-h-[32px]',
          view === 'cards'
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Cards
      </button>
      <button
        onClick={() => onChange('table')}
        aria-label="Table view"
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-all min-h-[32px]',
          view === 'table'
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Table2 className="h-3.5 w-3.5" />
        Table
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Competitors Tab (formerly PeersPage content)
// ---------------------------------------------------------------------------

function CompetitorsTab({ autoUploadCompanyId }: { autoUploadCompanyId?: string }) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(!!autoUploadCompanyId)
  const [uploadCompanyId, setUploadCompanyId] = useState<string | undefined>(autoUploadCompanyId)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')

  // Data fetching
  const { data: companies, isLoading: companiesLoading } = useCompanies()
  const { data: reports } = useReports()
  const { data: events } = usePublicationEvents()
  const { data: kpiDefs } = useKpiDefinitions()
  const { data: primaryCompany } = usePrimaryCompany()
  const checkMutation = useCheckPublication()

  const totalKpiDefinitions = kpiDefs?.length ?? 0
  const userSector = primaryCompany?.sector ?? null
  const userCompanyId = primaryCompany?.company_id ?? null
  const userCompanyName = primaryCompany?.name ?? null

  // Fetch KPI review counts per company (scoped to visible companies only)
  const companyIds = useMemo(() => (companies ?? []).map((c) => c.id), [companies])
  const { data: kpiCounts } = useQuery({
    queryKey: ['peer-kpi-counts', companyIds],
    queryFn: async () => {
      if (!companyIds.length) return {} as Record<string, { extracted: number; pendingReview: number }>
      const { data, error } = await supabase
        .from('kpi_values')
        .select('company_id, needs_review')
        .in('company_id', companyIds)
      if (error) throw error

      const counts: Record<string, { extracted: number; pendingReview: number }> = {}
      for (const row of data ?? []) {
        if (!counts[row.company_id]) {
          counts[row.company_id] = { extracted: 0, pendingReview: 0 }
        }
        counts[row.company_id].extracted++
        if (row.needs_review) {
          counts[row.company_id].pendingReview++
        }
      }
      return counts
    },
    enabled: companyIds.length > 0,
  })

  // Build card data — exclude user's own company (it's not a peer)
  const peerCards: PeerCardData[] = useMemo(() => (companies ?? [])
    .filter((c) => c.id !== userCompanyId)
    .map((company) => {
    // Find the latest report for this company
    const companyReports = (reports ?? [])
      .filter((r) => r.company_id === company.id)
      .sort((a, b) => b.fiscal_year - a.fiscal_year)
    const latestReport = companyReports[0] ?? null

    // Find the next scheduled event for this company
    const companyEvents = (events ?? [])
      .filter((e) => e.company_id === company.id)
      .sort((a, b) => a.expected_date.localeCompare(b.expected_date))
    const nextEvent = companyEvents.find((e) =>
      MONITORING_ACTIVE_STATUSES.includes(e.status),
    ) ?? companyEvents[0] ?? null

    const isMonitoring = companyEvents.some((e) =>
      MONITORING_ACTIVE_STATUSES.includes(e.status),
    )

    const kpi = kpiCounts?.[company.id]

    return {
      company,
      isMonitoring,
      monitoringStatus: nextEvent?.status ?? null,
      lastReport: latestReport
        ? { type: latestReport.report_type, date: latestReport.publication_date ?? latestReport.created_at }
        : null,
      nextExpectedDate: nextEvent?.expected_date ?? null,
      kpiExtracted: kpi?.extracted ?? 0,
      kpiPendingReview: kpi?.pendingReview ?? 0,
      nextEventId: nextEvent?.id ?? null,
      scheduledCount: companyEvents.length,
    }
  }), [companies, userCompanyId, reports, events, kpiCounts])

  // All company IDs for table view (peers + user's company)
  const allCompanyIds = useMemo(() => {
    const ids = peerCards.map((p) => p.company.id)
    if (userCompanyId && !ids.includes(userCompanyId)) {
      ids.unshift(userCompanyId)
    }
    return ids
  }, [peerCards, userCompanyId])

  // Auto-resolve website URLs for peers missing them (fires once)
  const resolvedPeersRef = useRef(false)
  const queryClient = useQueryClient()
  useEffect(() => {
    if (resolvedPeersRef.current || !companies?.length) return
    const missing = (companies ?? []).filter((c) => !c.website_url && c.name)
    if (!missing.length) return
    resolvedPeersRef.current = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      let resolved = 0
      const needsConfirmation: string[] = []
      await Promise.all(
        missing.map(async (c) => {
          try {
            const res = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-company-website`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
                  'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({ name: c.name, company_id: c.id }),
              },
            )
            if (res.ok) {
              const data = await res.json() as {
                website_url: string | null
                needs_confirmation?: boolean
              }
              if (data.website_url && !data.needs_confirmation) {
                resolved++
              } else if (data.needs_confirmation) {
                needsConfirmation.push(c.name)
              }
            }
          } catch { /* silent */ }
        }),
      )
      if (resolved > 0) {
        queryClient.invalidateQueries({ queryKey: ['companies'] })
        queryClient.invalidateQueries({ queryKey: ['companies-all'] })
      }
      if (needsConfirmation.length > 0) {
        toast.info(`Website needs manual verification for: ${needsConfirmation.join(', ')}. Open their profile to confirm.`)
      }
    })()
  }, [companies, queryClient])

  const handleUpload = (companyId: string) => {
    setUploadCompanyId(companyId)
    setUploadDialogOpen(true)
  }

  const [checkingEventId, setCheckingEventId] = useState<string | null>(null)

  const handleCheckNow = (eventId: string) => {
    setCheckingEventId(eventId)
    checkMutation.mutate(eventId, {
      onSuccess: () => { toast.success('Check completed'); setCheckingEventId(null) },
      onError: (err) => { toast.error(`Check failed: ${err.message}`); setCheckingEventId(null) },
    })
  }

  const [deletingCompanyId, setDeletingCompanyId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null)

  const handleDeletePeer = (companyId: string, companyName: string) => {
    setDeleteConfirm({ id: companyId, name: companyName })
  }

  const confirmDeletePeer = async () => {
    if (!deleteConfirm) return
    const { id: companyId, name: companyName } = deleteConfirm
    setDeleteConfirm(null)
    setDeletingCompanyId(companyId)
    try {
      // Remove from all user's peer groups
      const { data: userGroups } = await supabase
        .from('peer_groups')
        .select('id')
      if (userGroups?.length) {
        const groupIds = userGroups.map((g) => g.id)
        const { error } = await supabase
          .from('peer_group_members')
          .delete()
          .in('peer_group_id', groupIds)
          .eq('company_id', companyId)
        if (error) throw error
      }
      await queryClient.invalidateQueries({ queryKey: ['companies'] })
      await queryClient.invalidateQueries({ queryKey: ['visible-company-ids'] })
      await queryClient.invalidateQueries({ queryKey: ['peer-groups'] })
      toast.success(`Removed "${companyName}" from peers`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove peer')
    } finally {
      setDeletingCompanyId(null)
    }
  }

  const handleAddPeer = () => {
    setAddDialogOpen(true)
  }

  const isLoading = companiesLoading

  return (
    <>
      {/* Action bar */}
      <div className="mb-6 flex items-center justify-between gap-3">
        {!isLoading && peerCards.length > 0 ? (
          <ViewToggle view={viewMode} onChange={setViewMode} />
        ) : (
          <div />
        )}
        <Button onClick={handleAddPeer}>
          <Plus className="h-4 w-4" />
          Add Peer
        </Button>
      </div>

        {/* Search */}
        {!isLoading && peerCards.length > 0 && (
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by company name or ticker..."
                aria-label="Search peers by company name or ticker"
                className="pl-9 rounded-lg border-border bg-[var(--color-bg-tertiary)] text-[13px] text-foreground"
              />
            </div>
          </div>
        )}

        {/* Summary stats */}
        {!isLoading && peerCards.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-card px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Total Peers
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                {peerCards.length}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Actively Monitored
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                {peerCards.filter((p) => p.isMonitoring).length}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                KPIs Extracted
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                {peerCards.reduce((sum, p) => sum + p.kpiExtracted, 0)}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Pending Review
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-[var(--color-signal-amber)]">
                {peerCards.reduce((sum, p) => sum + p.kpiPendingReview, 0)}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <CardSkeleton />
        ) : peerCards.length === 0 ? (
          <EmptyState onAdd={handleAddPeer} />
        ) : (() => {
          const query = searchQuery.toLowerCase().trim()
          const filtered = query
            ? peerCards.filter((p) =>
                p.company.name.toLowerCase().includes(query) ||
                (p.company.ticker?.toLowerCase().includes(query) ?? false)
              )
            : peerCards

          if (filtered.length === 0) {
            return (
              <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-12 text-center">
                <Search className="mb-3 h-6 w-6 text-muted-foreground" />
                <p className="text-[13px] text-muted-foreground">
                  No peers matching &ldquo;{searchQuery}&rdquo;
                </p>
              </div>
            )
          }

          // Table view
          if (viewMode === 'table') {
            return (
              <ComparisonTableView
                peerCards={filtered}
                userCompanyName={userCompanyName}
                userCompanySector={userSector}
                userCompanyId={userCompanyId}
                allCompanyIds={allCompanyIds}
                onUpload={handleUpload}
                onCheckNow={handleCheckNow}
                onDelete={handleDeletePeer}
                deletingCompanyId={deletingCompanyId}
                checkingEventId={checkingEventId}
              />
            )
          }

          // Card view
          const monitored = filtered.filter((p) => p.isMonitoring)
          const other = filtered.filter((p) => !p.isMonitoring)
          const hasBothSections = monitored.length > 0 && other.length > 0

          return (
            <div className="space-y-6">
              {monitored.length > 0 && (
                <div>
                  {hasBothSections && (
                    <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                      Actively Monitored
                    </h2>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {monitored.map((peer) => (
                      <PeerCard
                        key={peer.company.id}
                        peer={peer}
                        onUpload={handleUpload}
                        onCheckNow={handleCheckNow}
                        onDelete={handleDeletePeer}
                        isChecking={checkingEventId === peer.nextEventId}
                        isDeleting={deletingCompanyId === peer.company.id}
                        totalKpiDefinitions={totalKpiDefinitions}
                        userSector={userSector}
                      />
                    ))}
                  </div>
                </div>
              )}

              {other.length > 0 && (
                <div>
                  {hasBothSections && (
                    <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                      Other Peers
                    </h2>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {other.map((peer) => (
                      <PeerCard
                        key={peer.company.id}
                        peer={peer}
                        onUpload={handleUpload}
                        onCheckNow={handleCheckNow}
                        onDelete={handleDeletePeer}
                        isChecking={checkingEventId === peer.nextEventId}
                        isDeleting={deletingCompanyId === peer.company.id}
                        totalKpiDefinitions={totalKpiDefinitions}
                        userSector={userSector}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })()}

      {/* Add Company Dialog */}
      <AddCompanyDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
      />

      {/* Upload Dialog */}
      <UploadReportDialog
        open={uploadDialogOpen}
        onClose={() => { setUploadDialogOpen(false); setUploadCompanyId(undefined) }}
        companies={companies ?? []}
        defaultCompanyId={uploadCompanyId}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Peer</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-muted-foreground">
            Are you sure you want to remove <span className="font-semibold text-foreground">{deleteConfirm?.name}</span> from your peer list? This will remove all associated data for this company.
          </p>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeletePeer}>
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
