import { useState, useRef, useCallback, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useCompanies, useReports, useKpiDefinitions, useKpiValues } from '@/hooks/useData'
import { usePrimaryCompany } from '@/hooks/useMyCompany'
import { usePublicationEvents, useCheckPublication } from '@/hooks/useCalendar'
import { useUploadReport, useExtractKpis } from '@/hooks/useExtraction'
import type { Company, ReportType, PublicationEventStatus } from '@/types/database'
import { REPORT_TYPE_LABELS } from '@/lib/constants'
import { CompanyAutocomplete, type CompanyResult } from '@/components/company-autocomplete'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { CardSkeleton } from '@/components/ui/page-skeleton'
import {
  Plus,
  Upload,
  RefreshCw,
  Eye,
  Building2,
  FileText,
  Loader2,
  Search,
  CalendarDays,
  ClipboardCheck,
  LayoutGrid,
  Table2,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Link } from 'react-router-dom'
import { CalendarPage } from './CalendarPage'
import { ReviewPage } from './ReviewPage'

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
  const [irUrl, setIrUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [nameError, setNameError] = useState(false)

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
  }

  const resetForm = () => {
    setName('')
    setTicker('')
    setExchange('')
    setSector('')
    setIrUrl('')
    setNameError(false)
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
      const { error } = await supabase
        .from('companies')
        .insert({
          name: name.trim(),
          ticker: ticker.trim().toUpperCase() || null,
          exchange: exchange || null,
          sector: sector || null,
          ir_page_url: irUrl.trim() || null,
        })
        .select()
        .single()

      if (error) throw error

      await queryClient.invalidateQueries({ queryKey: ['companies'] })
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
              Type 3+ letters to search company registers
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
            <Input
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="e.g. HOLN"
              className="rounded-lg border-border bg-[var(--color-bg-tertiary)] text-[13px] text-foreground"
            />
          </div>

          {/* Exchange */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Exchange
            </Label>
            <Select value={exchange} onValueChange={(v) => v && setExchange(v)}>
              <SelectTrigger className="w-full rounded-lg border-border bg-[var(--color-bg-tertiary)] text-[13px] text-foreground">
                <SelectValue placeholder="Select exchange" />
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
            <Select value={sector} onValueChange={(v) => v && setSector(v)}>
              <SelectTrigger className="w-full rounded-lg border-border bg-[var(--color-bg-tertiary)] text-[13px] text-foreground">
                <SelectValue placeholder="Select sector" />
              </SelectTrigger>
              <SelectContent className="rounded-lg border-border bg-card text-[13px]">
                {SECTOR_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="text-[13px]">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
// Upload Dialog
// ---------------------------------------------------------------------------

function UploadReportDialog({
  open,
  onClose,
  companies,
  preselectedCompanyId,
}: {
  open: boolean
  onClose: () => void
  companies: Company[]
  preselectedCompanyId?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [companyId, setCompanyId] = useState(preselectedCompanyId ?? '')
  const [reportType, setReportType] = useState<ReportType>('annual')
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear() - 1)
  const [fiscalQuarter, setFiscalQuarter] = useState(1)
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const uploadMutation = useUploadReport()
  const extractMutation = useExtractKpis()

  // Reset state when dialog opens with a new company
  const handleOpenChange = useCallback(
    (o: boolean) => {
      if (!o) {
        onClose()
        setFile(null)
      }
    },
    [onClose],
  )

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped?.type === 'application/pdf') setFile(dropped)
    else toast.error('Only PDF files are supported')
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) setFile(selected)
  }

  const handleUpload = async () => {
    if (!companyId) { toast.error('Select a company'); return }
    if (!file) { toast.error('Select a PDF file'); return }

    try {
      const result = await uploadMutation.mutateAsync({
        file,
        companyId,
        reportType,
        fiscalYear,
        fiscalQuarter: reportType === 'quarterly' ? fiscalQuarter : undefined,
      })
      toast.success('Report uploaded — extracting KPIs...')

      // Auto-trigger extraction
      try {
        const extraction = await extractMutation.mutateAsync(result.report_id)
        toast.success(`Extracted ${extraction.total_kpis_extracted} KPIs`, {
          action: {
            label: 'View in Peers',
            onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
          },
        })
      } catch {
        toast.error('Upload succeeded but extraction failed — run manually from Review page')
      }

      onClose()
      setFile(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  const isUploading = uploadMutation.isPending || extractMutation.isPending

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Report</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Company */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Company
            </Label>
            <Select value={companyId} onValueChange={(v) => v && setCompanyId(v)}>
              <SelectTrigger className="w-full rounded-lg border-border bg-[var(--color-bg-tertiary)] text-[13px] text-foreground">
                <SelectValue placeholder="Select company" />
              </SelectTrigger>
              <SelectContent className="rounded-lg border-border bg-card text-[13px]">
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-[13px]">
                    {c.name}{c.ticker ? ` (${c.ticker})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Report Type */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Report Type
            </Label>
            <Select value={reportType} onValueChange={(v) => v && setReportType(v as ReportType)}>
              <SelectTrigger className="w-full rounded-lg border-border bg-[var(--color-bg-tertiary)] text-[13px] text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-lg border-border bg-card text-[13px]">
                {(Object.entries(REPORT_TYPE_LABELS) as [ReportType, string][]).map(([k, label]) => (
                  <SelectItem key={k} value={k} className="text-[13px]">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fiscal Year + Quarter */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Fiscal Year
              </Label>
              <Input
                type="number"
                min={2000}
                max={new Date().getFullYear()}
                value={fiscalYear}
                onChange={(e) => setFiscalYear(Number(e.target.value))}
                className="rounded-lg border-border bg-[var(--color-bg-tertiary)] text-[13px] text-foreground"
              />
            </div>
            {reportType === 'quarterly' && (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                  Quarter
                </Label>
                <Select value={String(fiscalQuarter)} onValueChange={(v) => setFiscalQuarter(Number(v))}>
                  <SelectTrigger className="w-full rounded-lg border-border bg-[var(--color-bg-tertiary)] text-[13px] text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg border-border bg-card text-[13px]">
                    {[1, 2, 3, 4].map((q) => (
                      <SelectItem key={q} value={String(q)} className="text-[13px]">Q{q}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Drop Zone */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              PDF File
            </Label>
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload PDF file"
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                'group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-all duration-200',
                isDragging
                  ? 'border-accent bg-accent/5'
                  : file
                  ? 'border-[var(--color-signal-green)]/50 bg-[var(--color-signal-green)]/5'
                  : 'border-border hover:border-accent/50 hover:bg-[var(--color-bg-tertiary)]',
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              {file ? (
                <>
                  <FileText className="h-5 w-5 text-[var(--color-signal-green)]" />
                  <p className="text-[13px] font-medium text-foreground">{file.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <p className="text-[13px] font-medium text-foreground">Drop PDF here or click to browse</p>
                </>
              )}
            </div>
          </div>

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={isUploading || !companyId || !file}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {extractMutation.isPending ? 'Extracting KPIs...' : 'Uploading...'}
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload & Extract
              </>
            )}
          </Button>
        </div>
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
  isChecking,
  totalKpiDefinitions,
  userSector,
}: {
  peer: PeerCardData
  onUpload: (companyId: string) => void
  onCheckNow: (eventId: string) => void
  isChecking: boolean
  totalKpiDefinitions: number
  userSector: string | null
}) {
  const { company, isMonitoring, monitoringStatus, lastReport, nextExpectedDate, kpiExtracted, kpiPendingReview, nextEventId } = peer

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
      {/* Header: Company name + monitoring indicator */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-foreground truncate">
            {company.name}
          </h3>
          {company.ticker && (
            <span className="text-[11px] text-muted-foreground">
              {company.ticker}{company.exchange ? ` · ${company.exchange}` : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              'h-2.5 w-2.5 rounded-full',
              isMonitoring
                ? STATUS_COLORS[monitoringStatus ?? 'scheduled']
                : 'bg-zinc-400',
              isMonitoring && (monitoringStatus === 'overdue' || monitoringStatus === 'due_today') && 'status-pulse',
            )}
          />
          <span className="text-[11px] text-muted-foreground">
            {isMonitoring ? 'Active' : 'Inactive'}
          </span>
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
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--color-accent)]">
            Same sector
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex items-center gap-2">
        <Link
          to={`/companies/${company.id}`}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'flex-1')}
        >
          <Eye className="h-3.5 w-3.5" />
          View Profile
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onUpload(company.id)}
          className="flex-1"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload Report
        </Button>
        {nextEventId && MONITORING_ACTIVE_STATUSES.includes(monitoringStatus!) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCheckNow(nextEventId)}
            disabled={isChecking}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isChecking && 'animate-spin')} />
            Check Now
          </Button>
        )}
      </div>
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
}: {
  peerCards: PeerCardData[]
  userCompanyName: string | null
  userCompanySector: string | null
  userCompanyId: string | null
  allCompanyIds: string[]
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
      <table className="w-full min-w-[700px] text-[13px]">
        <thead>
          <tr className="border-b border-border bg-[var(--color-bg-tertiary)]">
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Company
            </th>
            {TABLE_KPI_CODES.map((code) => (
              <th
                key={code}
                className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground"
              >
                {TABLE_KPI_LABELS[code]}
              </th>
            ))}
            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Last Report
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.companyId}
              className={cn(
                'border-b border-border last:border-b-0 transition-colors hover:bg-[var(--color-bg-tertiary)]/50',
                row.isUser && 'border-l-2 border-l-[var(--color-accent)] bg-[var(--color-accent)]/5',
              )}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{row.name}</span>
                  {row.isUser && (
                    <span className="rounded-full bg-[var(--color-accent)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-accent)]">
                      You
                    </span>
                  )}
                </div>
              </td>
              {TABLE_KPI_CODES.map((code) => (
                <td key={code} className="px-4 py-3 text-right font-medium tabular-nums text-foreground">
                  {renderCellValue(row.companyId, code, row.isUser)}
                </td>
              ))}
              <td className="px-4 py-3 text-right tabular-nums text-foreground">
                {lastReportYear[row.companyId] ?? <span className="text-muted-foreground">--</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-16 text-center">
      <div className="mb-4 rounded-full bg-[var(--color-bg-tertiary)] p-4">
        <Building2 className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-[15px] font-semibold text-foreground">No peers configured</h3>
      <p className="mb-6 max-w-sm text-[13px] text-muted-foreground">
        Add competitor companies to your peer group to start monitoring their publications and extracting KPIs.
      </p>
      <Button onClick={onAdd}>
        <Plus className="h-4 w-4" />
        Add Peer
      </Button>
    </div>
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
  `flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
    isActive
      ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
      : 'text-muted-foreground hover:bg-[var(--color-bg-tertiary)] hover:text-foreground'
  }`

export function PeersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') as PeerTabId) || 'competitors'

  return (
    <>
      <Helmet><title>Peers - BenchmarkSignal</title></Helmet>
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
          {activeTab === 'competitors' && <CompetitorsTab />}
          {activeTab === 'calendar' && <CalendarPage embedded />}
          {activeTab === 'review' && <ReviewPage embedded />}
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

function CompetitorsTab() {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploadCompanyId, setUploadCompanyId] = useState<string | undefined>(undefined)
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

  // Fetch KPI review counts per company
  const { data: kpiCounts } = useQuery({
    queryKey: ['peer-kpi-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpi_values')
        .select('company_id, needs_review')
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
  })

  // Build card data
  const peerCards: PeerCardData[] = (companies ?? []).map((company) => {
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
    }
  })

  // All company IDs for table view (peers + user's company)
  const allCompanyIds = useMemo(() => {
    const ids = peerCards.map((p) => p.company.id)
    if (userCompanyId && !ids.includes(userCompanyId)) {
      ids.unshift(userCompanyId)
    }
    return ids
  }, [peerCards, userCompanyId])

  const handleUpload = (companyId: string) => {
    setUploadCompanyId(companyId)
    setUploadDialogOpen(true)
  }

  const handleCheckNow = (eventId: string) => {
    checkMutation.mutate(eventId, {
      onSuccess: () => toast.success('Check completed'),
      onError: (err) => toast.error(`Check failed: ${err.message}`),
    })
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
                        isChecking={checkMutation.isPending}
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
                        isChecking={checkMutation.isPending}
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
        preselectedCompanyId={uploadCompanyId}
      />
    </>
  )
}
