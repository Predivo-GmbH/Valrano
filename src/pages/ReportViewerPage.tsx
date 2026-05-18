import { Helmet } from 'react-helmet-async'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Printer, Zap, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useCustomReport, useGenerateReport } from '@/hooks/useReportBuilder'
import { Button } from '@/components/ui/button'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'

export function ReportViewerPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: report, isLoading } = useCustomReport(id)
  const generateMutation = useGenerateReport()

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <div className="py-20 text-center text-sm text-muted-foreground">Loading report...</div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <div className="card-premium rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">Report not found.</p>
          <Button variant="link" onClick={() => navigate('/reports')} className="mt-3">
            Back to Reports
          </Button>
        </div>
      </div>
    )
  }

  const contentJson = report.content_json as {
    title?: string
    fiscal_year?: number
    executive_summary?: string
    key_findings?: string[]
    sections?: Array<{
      id: string
      title: string
      content: string
      data_points?: Array<{ label: string; value: string }>
    }>
  } | null

  function handleExportCsv() {
    if (!contentJson?.sections) return
    const rows = [['Section', 'Content']]
    for (const section of contentJson.sections) {
      rows.push([section.title, section.content.replace(/"/g, '""')])
      if (section.data_points) {
        for (const dp of section.data_points) {
          rows.push([`  ${dp.label}`, dp.value])
        }
      }
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(report?.title ?? 'report').replace(/[^a-z0-9]/gi, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  function handlePrint() {
    window.print()
  }

  return (
    <>
      <Helmet><title>{report.title} - Valrano</title><meta name="robots" content="noindex" /></Helmet>
      <div className="section-fade-in mx-auto max-w-[900px] px-4 py-8 sm:px-6">
        {/* Breadcrumbs */}
        <div className="print:hidden">
          <Breadcrumbs items={[
            { label: 'Reports', href: '/reports' },
            { label: report.title || 'Report' },
          ]} />
        </div>

        {/* Header */}
        <div className="mb-6 flex items-center justify-between print:hidden">
          <Button variant="ghost" size="sm" onClick={() => navigate('/reports')} className="-ml-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Reports
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                generateMutation.mutate(report.id, {
                  onSuccess: () => toast.success('Report regenerated'),
                  onError: (err) => toast.error(`Failed: ${err.message}`),
                })
              }}
              disabled={generateMutation.isPending}
            >
              <Zap className="h-3.5 w-3.5" />
              Regenerate
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
          </div>
        </div>

        {/* Report Content */}
        {report.status === 'draft' ? (
          <div className="card-premium rounded-xl border border-border bg-card p-12 text-center">
            <Clock className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <h3 className="mt-3 text-lg font-semibold text-foreground">Draft — Not Generated Yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Click "Regenerate" to generate this report's content.</p>
          </div>
        ) : report.status === 'error' ? (
          <div className="rounded-xl border border-[var(--color-destructive)]/20 bg-[var(--color-destructive)]/5 p-8 text-center">
            <p className="text-sm text-[var(--color-destructive)]">{report.error_message ?? 'Generation failed'}</p>
          </div>
        ) : contentJson ? (
          <div className="space-y-6 print:space-y-4">
            {/* Title */}
            <div className="border-b border-border pb-4">
              <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{contentJson.title ?? report.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Fiscal Year {contentJson.fiscal_year} · Generated {report.last_generated_at ? new Date(report.last_generated_at).toLocaleString() : '—'}
              </p>
            </div>

            {/* Executive Summary */}
            {contentJson.executive_summary && (
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="mb-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">Executive Summary</h2>
                <p className="text-sm leading-relaxed text-foreground">{contentJson.executive_summary}</p>
              </div>
            )}

            {/* Key Findings */}
            {contentJson.key_findings && contentJson.key_findings.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">Key Findings</h2>
                <ul className="space-y-2">
                  {contentJson.key_findings.map((finding, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[10px] font-bold text-[var(--color-primary)]">
                        {i + 1}
                      </span>
                      {finding}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Sections */}
            {contentJson.sections?.map((section) => (
              <div key={section.id} className="rounded-xl border border-border bg-card p-5">
                <h2 className="mb-3 text-base font-semibold text-foreground">{section.title}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{section.content}</p>
                {section.data_points && section.data_points.length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="table-premium w-full text-sm" aria-label="Report metrics">
                      <thead>
                        <tr className="border-b border-border text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          <th scope="col" className="px-3 py-2 text-left">Metric</th>
                          <th scope="col" className="px-3 py-2 text-right">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.data_points.map((dp, i) => (
                          <tr key={i} className="border-b border-border/50 last:border-0">
                            <td className="px-3 py-2 text-foreground">{dp.label}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium text-foreground">{dp.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="card-premium rounded-xl border border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground">No content available.</p>
          </div>
        )}
      </div>
    </>
  )
}
