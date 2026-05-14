import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus,
  FileText,
  Trash2,
  Zap,
  Eye,
  Download,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Pencil,
  Presentation,
} from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
  useCustomReports,
  useCreateReport,
  useDeleteReport,
  useGenerateReport,
  useReportTemplates,
  type CustomReport,
} from '@/hooks/useReportBuilder'
import { useBenchmarkDocuments } from '@/hooks/useBenchmark'
import { useCompanies, useKpiDefinitions, usePeerGroups } from '@/hooks/useData'
import type { DocumentStatus } from '@/types/database'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { CardSkeleton } from '@/components/ui/page-skeleton'
import { cn } from '@/lib/utils'
import {
  useCorporateTemplates,
  useGenerateFromTemplate,
  useDownloadExport,
} from '@/hooks/useCorporateTemplates'

// ---------------------------------------------------------------------------
// Tab filter type
// ---------------------------------------------------------------------------

type TabFilter = 'all' | 'benchmark' | 'custom'

// ---------------------------------------------------------------------------
// Benchmark doc status badge styling
// ---------------------------------------------------------------------------

const DOC_STATUS_CONFIG: Record<DocumentStatus, { label: string; className: string }> = {
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

// Custom report status config
const REPORT_STATUS_CONFIG = {
  draft: { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Draft' },
  generating: { icon: Loader2, color: 'text-[var(--color-primary)]', bg: 'bg-[var(--color-primary)]/10', label: 'Generating...' },
  ready: { icon: CheckCircle2, color: 'text-[var(--color-signal-green)]', bg: 'bg-[var(--color-signal-green)]/10', label: 'Ready' },
  error: { icon: AlertCircle, color: 'text-[var(--color-signal-red)]', bg: 'bg-[var(--color-signal-red)]/10', label: 'Error' },
}

// ---------------------------------------------------------------------------
// Main merged page
// ---------------------------------------------------------------------------

export function ReportBuilderPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabFilter>('all')
  const [showCreate, setShowCreate] = useState(false)

  // Data fetching
  const { data: documents, isLoading: docsLoading } = useBenchmarkDocuments({})
  const { data: reports, isLoading: reportsLoading } = useCustomReports()

  const isLoading = docsLoading || reportsLoading

  const tabs: { key: TabFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'benchmark', label: 'Benchmark Docs' },
    { key: 'custom', label: 'Custom Reports' },
  ]

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '\u2014'
    return new Date(dateStr).toLocaleDateString('en-CH', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const showBenchmarkDocs = activeTab === 'all' || activeTab === 'benchmark'
  const showCustomReports = activeTab === 'all' || activeTab === 'custom'

  const hasDocs = (documents ?? []).length > 0
  const hasReports = (reports ?? []).length > 0
  const hasAny = hasDocs || hasReports

  return (
    <>
      <Helmet><title>Reports - BenchmarkSignal</title></Helmet>
      <div className="section-fade-in mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">Reports</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Auto-generated benchmark documents and custom reports from your data.
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            New Report
          </Button>
        </div>

        {/* Summary cards */}
        {!isLoading && (
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-border bg-card px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Total Documents</div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">{(documents ?? []).length + (reports ?? []).length}</div>
            </div>
            <div className="rounded-lg border border-border bg-card px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Benchmark Docs</div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">{(documents ?? []).length}</div>
            </div>
            <div className="rounded-lg border border-border bg-card px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Custom Reports</div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">{(reports ?? []).length}</div>
            </div>
          </div>
        )}

        {/* Tab filter bar */}
        <div
          className="mb-6 flex items-center gap-1 rounded-lg border border-border bg-card p-1"
          role="tablist"
          aria-label="Report type filter"
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'min-h-[44px] rounded-md px-4 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
                activeTab === tab.key
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground hover:bg-[var(--color-bg-tertiary)]'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <CardSkeleton />
        ) : !hasAny ? (
          <EmptyState onCreateReport={() => setShowCreate(true)} />
        ) : (
          <div className="space-y-3">
            {/* Benchmark Documents */}
            {showBenchmarkDocs && (documents ?? []).map((doc) => (
              <BenchmarkDocCard key={`doc-${doc.id}`} doc={doc} formatDate={formatDate} />
            ))}

            {/* Custom Reports */}
            {showCustomReports && (reports ?? []).map((report) => (
              <CustomReportCard
                key={`report-${report.id}`}
                report={report}
                onView={() => navigate(`/reports/${report.id}`)}
                formatDate={formatDate}
              />
            ))}

            {/* Show empty message for filtered tab if no items */}
            {activeTab === 'benchmark' && !hasDocs && (
              <div className="rounded-xl border border-border bg-card p-8 text-center">
                <p className="text-sm text-muted-foreground">No benchmark documents yet.</p>
              </div>
            )}
            {activeTab === 'custom' && !hasReports && (
              <div className="rounded-xl border border-border bg-card p-8 text-center">
                <p className="text-sm text-muted-foreground">No custom reports yet.</p>
                <Button onClick={() => setShowCreate(true)} className="mt-3" size="sm">
                  <Plus className="h-4 w-4" />
                  Create Report
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Count */}
        {hasAny && !isLoading && (
          <p className="mt-4 text-[11px] text-muted-foreground">
            {activeTab === 'all' && `${(documents ?? []).length + (reports ?? []).length} total`}
            {activeTab === 'benchmark' && `${(documents ?? []).length} document${(documents ?? []).length !== 1 ? 's' : ''}`}
            {activeTab === 'custom' && `${(reports ?? []).length} report${(reports ?? []).length !== 1 ? 's' : ''}`}
          </p>
        )}

        <CreateReportDialog open={showCreate} onClose={() => setShowCreate(false)} />
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ onCreateReport }: { onCreateReport: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="mb-4 rounded-full bg-[var(--color-bg-tertiary)] p-4">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-[15px] font-semibold text-foreground">No reports yet</h3>
      <p className="mb-6 text-[13px] text-muted-foreground max-w-sm">
        Upload a competitor report to auto-generate benchmark documents, or create a custom report from your data.
      </p>
      <div className="flex items-center gap-3">
        <Link
          to="/peers?tab=upload"
          className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-2.5 text-[13px] font-medium text-foreground transition-all duration-200 hover:bg-[var(--color-bg-tertiary)]"
        >
          Upload a Report
        </Link>
        <Button onClick={onCreateReport} className="rounded-full px-6">
          <Plus className="h-4 w-4" />
          Create Custom Report
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Benchmark Document Card
// ---------------------------------------------------------------------------

interface BenchmarkDoc {
  id: string
  title: string
  status: DocumentStatus
  fiscal_year: number
  generated_at: string | null
  benchmark_rules?: { name: string } | null
  trigger_company?: { name: string; ticker?: string | null } | null
}

function BenchmarkDocCard({ doc, formatDate }: { doc: BenchmarkDoc; formatDate: (d: string | null | undefined) => string }) {
  const statusCfg = DOC_STATUS_CONFIG[doc.status] ?? DOC_STATUS_CONFIG.draft

  return (
    <div className="card-premium rounded-xl border border-border bg-card p-5 transition-colors hover:bg-card/80">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)]/10">
              <FileText className="h-4 w-4 text-[var(--color-accent)]" />
            </div>
            <div className="min-w-0">
              <Link
                to={`/documents/${doc.id}`}
                className="truncate block max-w-[400px] font-semibold text-foreground hover:text-[var(--color-accent)] transition-colors"
              >
                {doc.title}
              </Link>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                  statusCfg.className,
                )}>
                  {statusCfg.label}
                </span>
                <span className="inline-flex items-center rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--color-accent)]">
                  Auto-generated
                </span>
              </div>
            </div>
          </div>
          <div className="mt-2 ml-11 flex items-center gap-3 text-xs text-muted-foreground">
            {doc.trigger_company?.name && <span>{doc.trigger_company.name}</span>}
            {doc.benchmark_rules?.name && <span>Template: {doc.benchmark_rules.name}</span>}
            <span>FY {doc.fiscal_year}</span>
            {doc.generated_at && <span>{formatDate(doc.generated_at)}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Link to={`/documents/${doc.id}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'inline-flex items-center gap-1.5')}>
            <Eye className="h-3.5 w-3.5" />
            View
          </Link>
          <Link
            to={`/documents/${doc.id}`}
            target="_blank"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'inline-flex items-center gap-1.5')}
          >
            <Download className="h-3.5 w-3.5" />
            Export PDF
          </Link>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom Report Card
// ---------------------------------------------------------------------------

function CustomReportCard({
  report,
  onView,
  formatDate,
}: {
  report: CustomReport
  onView: () => void
  formatDate: (d: string | null | undefined) => string
}) {
  const generateMutation = useGenerateReport()
  const deleteMutation = useDeleteReport()
  const generateFromTemplate = useGenerateFromTemplate()
  const downloadExport = useDownloadExport()
  const { data: corporateTemplates } = useCorporateTemplates()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showTemplateSelect, setShowTemplateSelect] = useState(false)
  const status = REPORT_STATUS_CONFIG[report.status]
  const StatusIcon = status.icon

  const readyTemplates = (corporateTemplates ?? []).filter((t) => t.status === 'ready')

  const handleExportWithTemplate = async (templateId: string) => {
    setShowTemplateSelect(false)
    try {
      const res = await generateFromTemplate.mutateAsync({
        template_id: templateId,
        report_id: report.id,
      })
      const blob = await downloadExport.mutateAsync(res.output_path)
      const tpl = readyTemplates.find((t) => t.id === templateId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${report.title}.${tpl?.file_format ?? 'pptx'}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Branded report downloaded')
    } catch (err) {
      toast.error(`Export failed: ${(err as Error).message}`)
    }
  }

  return (
    <div className="card-premium rounded-xl border border-border bg-card p-5 transition-colors hover:bg-card/80">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-foreground">{report.title}</h3>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${status.bg} ${status.color}`}>
              <StatusIcon className={`h-3 w-3 ${report.status === 'generating' ? 'animate-spin' : ''}`} />
              {status.label}
            </span>
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Custom
            </span>
          </div>
          {report.description && (
            <p className="mt-1 text-sm text-muted-foreground">{report.description}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            {report.report_templates && (
              <span>Template: {report.report_templates.name}</span>
            )}
            {report.config_json.fiscal_year && (
              <span>FY{report.config_json.fiscal_year}</span>
            )}
            {report.config_json.kpi_codes && (
              <span>{report.config_json.kpi_codes.length} KPIs</span>
            )}
            {report.last_generated_at && (
              <span>{formatDate(report.last_generated_at)}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 relative">
          {report.status === 'ready' && (
            <>
              <Button variant="outline" size="sm" onClick={onView}>
                <Eye className="h-3.5 w-3.5" />
                View
              </Button>
              <Button variant="ghost" size="sm" onClick={onView}>
                <Download className="h-3.5 w-3.5" />
                Export PDF
              </Button>
              {readyTemplates.length > 0 && (
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTemplateSelect(!showTemplateSelect)}
                    disabled={generateFromTemplate.isPending}
                  >
                    {generateFromTemplate.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Presentation className="h-3.5 w-3.5" />
                    )}
                    Branded
                  </Button>
                  {showTemplateSelect && (
                    <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-card p-1 shadow-lg">
                      {readyTemplates.map((tpl) => (
                        <button
                          key={tpl.id}
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[12px] text-foreground hover:bg-muted"
                          onClick={() => handleExportWithTemplate(tpl.id)}
                        >
                          <Presentation className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                          {tpl.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          {report.status === 'draft' && (
            <Button variant="outline" size="sm" onClick={onView}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              generateMutation.mutate(report.id, {
                onSuccess: () => toast.success('Report generated', {
                  action: {
                    label: 'View Report',
                    onClick: () => onView(),
                  },
                }),
                onError: (err) => toast.error(`Failed: ${err.message}`),
              })
            }}
            disabled={generateMutation.isPending || report.status === 'generating'}
          >
            <Zap className="h-3.5 w-3.5" />
            Generate
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete report"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <ConfirmDeleteDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Report"
        description="Are you sure you want to delete this report? This action cannot be undone."
        onConfirm={() => {
          deleteMutation.mutate(report.id, {
            onSuccess: () => { toast.success('Report deleted'); setShowDeleteConfirm(false) },
          })
        }}
        isPending={deleteMutation.isPending}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create Report Dialog
// ---------------------------------------------------------------------------

function CreateReportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const { data: templates } = useReportTemplates()
  const { data: companies } = useCompanies()
  const { data: kpiDefs } = useKpiDefinitions()
  const { data: peerGroups } = usePeerGroups()
  const createMutation = useCreateReport()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [templateId, setTemplateId] = useState<string>('')
  const [peerGroupId, setPeerGroupId] = useState<string>('')
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear() - 1)
  const [selectedKpis, setSelectedKpis] = useState<string[]>([])
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const titleInvalid = !title.trim() && (touched.title || submitAttempted)

  const selectedTemplate = templates?.find((t) => t.id === templateId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitAttempted(true)
    if (!title.trim()) return

    const config: CustomReport['config_json'] = {
      fiscal_year: fiscalYear,
      peer_group_id: peerGroupId || undefined,
      kpi_codes: selectedKpis.length > 0 ? selectedKpis : undefined,
      sections: selectedTemplate?.template_json.sections,
    }

    if (!peerGroupId) {
      config.company_ids = companies?.map((c) => c.id)
    }

    createMutation.mutate(
      {
        title,
        description: description || undefined,
        template_id: templateId || undefined,
        config_json: config,
      },
      {
        onSuccess: (data) => {
          toast.success('Report created')
          onClose()
          // Auto-navigate to viewer after creation
          if (data?.id) {
            navigate(`/reports/${data.id}`)
          }
        },
        onError: (err) => toast.error(`Failed: ${err.message}`),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Report</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="report-title" className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Title</label>
            <input
              id="report-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, title: true }))}
              aria-invalid={titleInvalid}
              placeholder="e.g., Q4 2025 Board Presentation"
              className={`w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground ${titleInvalid ? 'border-[var(--color-signal-red)]' : 'border-border'}`}
            />
            {titleInvalid && <p className="mt-1 text-[12px] text-[var(--color-signal-red)]">Report title is required.</p>}
          </div>

          <div>
            <label htmlFor="report-description" className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Description (optional)</label>
            <textarea
              id="report-description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              placeholder="Brief description..."
              rows={3}
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">{description.length}/500</p>
          </div>

          <div>
            <label htmlFor="report-template" className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Template</label>
            <Select value={templateId} onValueChange={(v) => v && setTemplateId(v)}>
              <SelectTrigger id="report-template" className="w-full">
                <SelectValue placeholder="Custom (no template)">{templateId ? (templates ?? []).find((t) => t.id === templateId)?.name ?? 'Custom (no template)' : 'Custom (no template)'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Custom (no template)</SelectItem>
                {(templates ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name} — {t.description}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="report-fiscal-year" className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Fiscal Year</label>
              <Select value={String(fiscalYear)} onValueChange={(v) => setFiscalYear(Number(v))}>
                <SelectTrigger id="report-fiscal-year" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 - i).map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="report-peer-group" className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Peer Group</label>
              <Select value={peerGroupId} onValueChange={(v) => v && setPeerGroupId(v)}>
                <SelectTrigger id="report-peer-group" className="w-full">
                  <SelectValue placeholder="All Companies">{peerGroupId ? (peerGroups ?? []).find((pg) => pg.id === peerGroupId)?.name ?? 'All Companies' : 'All Companies'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Companies</SelectItem>
                  {(peerGroups ?? []).map((pg) => (
                    <SelectItem key={pg.id} value={pg.id}>{pg.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              KPIs to include ({selectedKpis.length || 'all'})
            </label>
            <div className="max-h-32 overflow-y-auto rounded-lg border border-border bg-background p-2">
              {(kpiDefs ?? []).map((kpi) => (
                <label key={kpi.id} className="flex items-center gap-2 px-2 py-1 text-sm text-foreground hover:bg-muted/30 rounded">
                  <input
                    type="checkbox"
                    checked={selectedKpis.includes(kpi.code)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedKpis([...selectedKpis, kpi.code])
                      } else {
                        setSelectedKpis(selectedKpis.filter((c) => c !== kpi.code))
                      }
                    }}
                  />
                  {kpi.name}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Report'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
