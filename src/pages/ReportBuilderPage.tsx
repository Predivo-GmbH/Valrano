import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import { Plus, FileText, Trash2, Zap, Download, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  useCustomReports,
  useCreateReport,
  useDeleteReport,
  useGenerateReport,
  useReportTemplates,
  type CustomReport,
} from '@/hooks/useReportBuilder'
import { useCompanies, useKpiDefinitions, usePeerGroups } from '@/hooks/useData'

const STATUS_CONFIG = {
  draft: { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Draft' },
  generating: { icon: Loader2, color: 'text-[var(--color-primary)]', bg: 'bg-[var(--color-primary)]/10', label: 'Generating...' },
  ready: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Ready' },
  error: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Error' },
}

export function ReportBuilderPage() {
  const navigate = useNavigate()
  const { data: reports, isLoading } = useCustomReports()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <>
      <Helmet><title>Reports - BenchmarkSignal</title></Helmet>
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Report Builder</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create custom reports from your benchmark data with AI-generated narratives.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            New Report
          </button>
        </div>

        {isLoading ? (
          <div className="py-20 text-center text-sm text-muted-foreground">Loading...</div>
        ) : !reports || reports.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <h3 className="mt-3 text-lg font-semibold text-foreground">No reports yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first report from a template or build one from scratch.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" />
              Create Report
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <ReportCard key={report.id} report={report} onView={() => navigate(`/reports/${report.id}`)} />
            ))}
          </div>
        )}

        {showCreate && <CreateReportDialog onClose={() => setShowCreate(false)} />}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Report Card
// ---------------------------------------------------------------------------

function ReportCard({ report, onView }: { report: CustomReport; onView: () => void }) {
  const generateMutation = useGenerateReport()
  const deleteMutation = useDeleteReport()
  const status = STATUS_CONFIG[report.status]
  const StatusIcon = status.icon

  return (
    <div className="rounded-xl border border-border bg-card p-5 transition-colors hover:bg-card/80">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-foreground">{report.title}</h3>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${status.bg} ${status.color}`}>
              <StatusIcon className={`h-3 w-3 ${report.status === 'generating' ? 'animate-spin' : ''}`} />
              {status.label}
            </span>
          </div>
          {report.description && (
            <p className="mt-1 text-sm text-muted-foreground">{report.description}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            {report.report_templates && (
              <span>Template: {report.report_templates.name}</span>
            )}
            {report.last_generated_at && (
              <span>Generated: {new Date(report.last_generated_at).toLocaleDateString()}</span>
            )}
            {report.config_json.fiscal_year && (
              <span>FY{report.config_json.fiscal_year}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {report.status === 'ready' && (
            <button
              onClick={onView}
              className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Download className="h-3.5 w-3.5" />
              View
            </button>
          )}
          <button
            onClick={() => {
              generateMutation.mutate(report.id, {
                onSuccess: () => toast.success('Report generated'),
                onError: (err) => toast.error(`Failed: ${err.message}`),
              })
            }}
            disabled={generateMutation.isPending || report.status === 'generating'}
            className="flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[var(--color-primary)]/10 px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/20 disabled:opacity-50"
          >
            <Zap className="h-3.5 w-3.5" />
            Generate
          </button>
          <button
            onClick={() => {
              if (confirm('Delete this report?')) {
                deleteMutation.mutate(report.id, {
                  onSuccess: () => toast.success('Report deleted'),
                })
              }
            }}
            className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create Report Dialog
// ---------------------------------------------------------------------------

function CreateReportDialog({ onClose }: { onClose: () => void }) {
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

  const selectedTemplate = templates?.find((t) => t.id === templateId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

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
        onSuccess: () => {
          toast.success('Report created')
          onClose()
        },
        onError: (err) => toast.error(`Failed: ${err.message}`),
      }
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Create Report</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g., Q4 2025 Board Presentation"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Description (optional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Template</label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">Custom (no template)</option>
              {(templates ?? []).map((t) => (
                <option key={t.id} value={t.id}>{t.name} — {t.description}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Fiscal Year</label>
              <select
                value={fiscalYear}
                onChange={(e) => setFiscalYear(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 - i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Peer Group</label>
              <select
                value={peerGroupId}
                onChange={(e) => setPeerGroupId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">All Companies</option>
                {(peerGroups ?? []).map((pg) => (
                  <option key={pg.id} value={pg.id}>{pg.name}</option>
                ))}
              </select>
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
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50">
              {createMutation.isPending ? 'Creating...' : 'Create Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
