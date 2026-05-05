import { useState, useRef, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useCompanies, useReports } from '@/hooks/useData'
import { usePublicationEvents, useCheckPublication } from '@/hooks/useCalendar'
import { useUploadReport, useExtractKpis } from '@/hooks/useExtraction'
import type { Company, ReportType, PublicationEventStatus } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
  CalendarDays,
  ClipboardCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Link } from 'react-router-dom'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  annual: 'Annual Report',
  quarterly: 'Quarterly Report',
  half_year: 'Half-Year Report',
  sustainability: 'Sustainability Report',
}

const STATUS_COLORS: Record<PublicationEventStatus, string> = {
  scheduled: 'bg-blue-500',
  due_today: 'bg-amber-500',
  overdue: 'bg-red-500',
  detected: 'bg-green-500',
  ingested: 'bg-green-400',
  benchmark_ready: 'bg-emerald-500',
  cancelled: 'bg-zinc-400',
}

const MONITORING_ACTIVE_STATUSES: PublicationEventStatus[] = ['scheduled', 'due_today', 'overdue']

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
        toast.success(`Extracted ${extraction.total_kpis_extracted} KPIs`)
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
            <Select value={companyId} onValueChange={(v) => setCompanyId(v)}>
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
            <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
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
              onClick={() => inputRef.current?.click()}
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
}: {
  peer: PeerCardData
  onUpload: (companyId: string) => void
  onCheckNow: (eventId: string) => void
  isChecking: boolean
}) {
  const { company, isMonitoring, monitoringStatus, lastReport, nextExpectedDate, kpiExtracted, kpiPendingReview, nextEventId } = peer

  return (
    <div className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-[var(--color-primary)]/30">
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

      {/* Action buttons */}
      <div className="mt-4 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          asChild
          className="flex-1"
        >
          <Link to={`/companies/${company.id}`}>
            <Eye className="h-3.5 w-3.5" />
            View Profile
          </Link>
        </Button>
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

export function PeersPage() {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploadCompanyId, setUploadCompanyId] = useState<string | undefined>(undefined)

  // Data fetching
  const { data: companies, isLoading: companiesLoading } = useCompanies()
  const { data: reports } = useReports()
  const { data: events } = usePublicationEvents()
  const checkMutation = useCheckPublication()

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
    // Navigate to a "add peer" flow — for now just open upload with no preselection
    // In the future this would open an "Add Company" dialog
    toast.info('Use the Upload Report dialog to add reports for any peer.')
    setUploadCompanyId(undefined)
    setUploadDialogOpen(true)
  }

  const isLoading = companiesLoading

  return (
    <>
      <Helmet><title>Peers - BenchmarkSignal</title></Helmet>
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">

        {/* Header */}
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">
              Peers
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Manage your competitive peer group
            </p>
          </div>
          <Button onClick={handleAddPeer}>
            <Plus className="h-4 w-4" />
            Add Peer
          </Button>
        </div>

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
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {peerCards.map((peer) => (
              <PeerCard
                key={peer.company.id}
                peer={peer}
                onUpload={handleUpload}
                onCheckNow={handleCheckNow}
                isChecking={checkMutation.isPending}
              />
            ))}
          </div>
        )}

        {/* Quick links to Review and Calendar */}
        {!isLoading && peerCards.length > 0 && (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link
              to="/review"
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-[var(--color-primary)]/30"
            >
              <ClipboardCheck className="h-5 w-5 text-[var(--color-signal-amber)]" />
              <div>
                <div className="text-[13px] font-medium text-foreground">Review Queue</div>
                <div className="text-[11px] text-muted-foreground">Approve flagged KPI extractions</div>
              </div>
            </Link>
            <Link
              to="/calendar"
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-[var(--color-primary)]/30"
            >
              <CalendarDays className="h-5 w-5 text-[var(--color-financial-blue)]" />
              <div>
                <div className="text-[13px] font-medium text-foreground">Publication Calendar</div>
                <div className="text-[11px] text-muted-foreground">View all scheduled publication events</div>
              </div>
            </Link>
          </div>
        )}
      </div>

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
