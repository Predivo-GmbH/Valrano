import { Helmet } from 'react-helmet-async'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download, FileText, CheckCircle2, Clock, AlertTriangle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { ReportStatusBadge as StatusBadge } from '@/components/ui/report-status-badge'

export function UploadedReportPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: report, isLoading } = useQuery({
    queryKey: ['uploaded-report', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('*, companies(id, name, ticker)')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data
    },
  })

  const { data: kpis } = useQuery({
    queryKey: ['uploaded-report-kpis', id],
    enabled: !!id && report?.status === 'extracted',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpi_values')
        .select('*, kpi_definitions(code, name, unit)')
        .eq('report_id', id!)
        .order('kpi_definition_id')
      if (error) throw error
      return data
    },
  })

  async function handleDownloadPdf() {
    if (!report?.pdf_storage_path) return
    const { data, error } = await supabase.storage
      .from('reports')
      .createSignedUrl(report.pdf_storage_path, 300)
    if (error || !data?.signedUrl) return
    window.open(data.signedUrl, '_blank')
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6">
        <div className="py-20 text-center text-sm text-muted-foreground">Loading report...</div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6">
        <div className="card-premium rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">Report not found.</p>
          <Button variant="link" onClick={() => navigate(-1)} className="mt-3">
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  const company = report.companies as { id: string; name: string; ticker: string | null } | null

  return (
    <>
      <Helmet><title>{report.title || 'Report'} - Valrano</title><meta name="robots" content="noindex" /></Helmet>
      <div className="section-fade-in mx-auto max-w-[1000px] px-4 py-8 sm:px-6">
        <Breadcrumbs items={[
          ...(company ? [{ label: company.name, href: `/companies/${company.id}` }] : []),
          { label: report.title || 'Report' },
        ]} />

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          {report.pdf_storage_path && (
            <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
              <Download className="h-3.5 w-3.5" />
              View PDF
            </Button>
          )}
        </div>

        {/* Report Info Card */}
        <div className="card-premium mb-6 rounded-xl border border-border bg-card p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)]/10">
              <FileText className="h-5 w-5 text-[var(--color-accent)]" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold text-foreground">{report.title || `${report.report_type} FY ${report.fiscal_year}`}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground">
                {company && <span>{company.name}</span>}
                <span className="rounded bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 text-[10px] font-medium uppercase">{report.report_type}</span>
                <span>FY {report.fiscal_year}{report.fiscal_quarter ? ` Q${report.fiscal_quarter}` : ''}</span>
                <StatusBadge status={report.status} />
              </div>
            </div>
          </div>
        </div>

        {/* Extracted KPIs */}
        {kpis && kpis.length > 0 && (
          <div className="card-premium rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-3">
              <h2 className="text-[13px] font-semibold text-foreground">Extracted KPIs ({kpis.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Extracted KPI values">
                <thead>
                  <tr className="border-b border-border text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    <th scope="col" className="px-5 py-2.5 text-left">KPI</th>
                    <th scope="col" className="px-5 py-2.5 text-right">Value</th>
                    <th scope="col" className="px-5 py-2.5 text-right">Currency</th>
                    <th scope="col" className="px-5 py-2.5 text-right">Confidence</th>
                    <th scope="col" className="px-5 py-2.5 text-left">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {kpis.map((kpi) => {
                    const def = kpi.kpi_definitions as { code: string; name: string; unit: string | null } | null
                    return (
                      <tr key={kpi.id} className="text-[12px]">
                        <td className="px-5 py-2.5 font-medium text-foreground">{def?.name ?? def?.code ?? '—'}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-foreground">
                          {typeof kpi.raw_value === 'number' ? kpi.raw_value.toLocaleString() : '—'}
                        </td>
                        <td className="px-5 py-2.5 text-right text-muted-foreground">{kpi.raw_currency ?? '—'}</td>
                        <td className="px-5 py-2.5 text-right">
                          <span className={`tabular-nums ${kpi.confidence >= 0.85 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {(kpi.confidence * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-muted-foreground max-w-[200px] truncate">{kpi.raw_label ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {report.status === 'pending' && (
          <div className="card-premium rounded-xl border border-border bg-card p-8 text-center">
            <Clock className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">This report is pending extraction. KPIs will appear here once processed.</p>
          </div>
        )}

        {report.status === 'processing' && (
          <div className="card-premium rounded-xl border border-border bg-card p-8 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[var(--color-accent)]" />
            <p className="mt-3 text-sm text-muted-foreground">Extraction in progress...</p>
          </div>
        )}
      </div>
    </>
  )
}
