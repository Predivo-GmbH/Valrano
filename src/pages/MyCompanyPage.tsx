import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import { Building2, Pencil, Upload, FileText, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  useMyCompanies,
  useMyCompanyKpis,
  useUpsertMyCompanyKpis,
} from '@/hooks/useMyCompany'
import { useKpiDefinitions, useCompanies, useReports } from '@/hooks/useData'
import { CardSkeleton } from '@/components/ui/page-skeleton'
import { CompanyLogo, companyLogoUrl } from '@/components/ui/company-logo'
import { UploadReportDialog } from '@/components/upload-report-dialog'


export function MyCompanyPage() {
  const navigate = useNavigate()
  const { data: companies, isLoading } = useMyCompanies()
  const { data: allCompanies } = useCompanies()
  const [editingKpis, setEditingKpis] = useState<string | null>(null)
  const [uploadCompanyId, setUploadCompanyId] = useState<string | null>(null)

  const primaryCompanyId = companies?.find((c) => c.is_primary)?.company_id ?? companies?.[0]?.company_id
  const { data: reports } = useReports(primaryCompanyId ?? undefined)

  const primaryCompany = companies?.find((c) => c.is_primary) ?? companies?.[0]

  return (
    <>
      <Helmet><title>{primaryCompany?.name ?? 'My Company'} - BenchmarkSignal</title></Helmet>
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">{primaryCompany?.name ?? 'My Company'}</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {primaryCompany ? `Manage ${primaryCompany.name}'s data and benchmark against peers.` : 'Enter your company data to benchmark against peers.'}
            </p>
          </div>
          {primaryCompany && (
            <Button onClick={() => navigate('/my-company/benchmark')}>View Benchmark</Button>
          )}
        </div>

        {isLoading ? (
          <CardSkeleton />
        ) : !companies || companies.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">No company configured</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Upload your annual report on the Dashboard to set up your company automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Company cards */}
            {companies.map((company) => (
              <CompanyCard
                key={company.id}
                company={company}
                logoUrl={(() => { const c = allCompanies?.find((ac) => ac.id === company.company_id); return c?.logo_url || companyLogoUrl(c?.website_url) })()}
                isEditingKpis={editingKpis === company.id}
                onEditKpis={() => setEditingKpis(editingKpis === company.id ? null : company.id)}
                onUpload={() => setUploadCompanyId(company.company_id)}
              />
            ))}

            {/* Recent Reports */}
            {reports && reports.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Recent Reports</h3>
                <div className="space-y-2">
                  {reports.slice(0, 10).map((report) => (
                    <div key={report.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-[var(--color-bg-tertiary)] px-3 py-2.5">
                      <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-foreground">
                          {report.title ?? `Report FY ${report.fiscal_year}`}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {report.report_type} · FY {report.fiscal_year}{report.fiscal_quarter ? ` Q${report.fiscal_quarter}` : ''} · {new Date(report.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <ReportStatusBadge status={report.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {uploadCompanyId && (
          <UploadReportDialog
            open
            onClose={() => setUploadCompanyId(null)}
            companyId={uploadCompanyId}
          />
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Company Card
// ---------------------------------------------------------------------------

function CompanyCard({
  company,
  logoUrl,
  isEditingKpis,
  onEditKpis,
  onUpload,
}: {
  company: { id: string; company_id: string | null; name: string; sector: string | null; country: string | null; reporting_currency: string | null; headcount: number | null; is_primary: boolean }
  logoUrl?: string | null
  isEditingKpis: boolean
  onEditKpis: () => void
  onUpload: () => void
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CompanyLogo logoUrl={logoUrl} name={company.name} size="xl" className="rounded-lg" />
          <div>
            <h3 className="font-semibold text-foreground">{company.name}</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {company.sector && <span>{company.sector}</span>}
              {company.country && <span>· {company.country}</span>}
              {company.is_primary && (
                <span className="rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--color-primary)]">
                  Primary
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {company.company_id && (
            <Button variant="outline" size="sm" onClick={onUpload}>
              <Upload className="h-3.5 w-3.5" />
              Upload Report
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onEditKpis}>
            <Pencil className="h-3.5 w-3.5" />
            {isEditingKpis ? 'Close' : 'Edit KPIs'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <span className="text-xs text-muted-foreground">Currency</span>
          <p className="font-medium text-foreground">{company.reporting_currency ?? 'CHF'}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Headcount</span>
          <p className="font-medium text-foreground">{company.headcount?.toLocaleString() ?? '—'}</p>
        </div>
      </div>

      {isEditingKpis && (
        <div className="mt-4 border-t border-border pt-4">
          <KpiEditor companyId={company.id} />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Report Status Badge
// ---------------------------------------------------------------------------

function ReportStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'extracted':
    case 'reviewed':
      return (
        <span className="flex items-center gap-1 rounded-full bg-[var(--color-signal-green)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--color-signal-green)]">
          <CheckCircle2 className="h-3 w-3" />
          {status === 'reviewed' ? 'Reviewed' : 'Extracted'}
        </span>
      )
    case 'pending':
    case 'processing':
      return (
        <span className="flex items-center gap-1 rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--color-accent)]">
          <Clock className="h-3 w-3" />
          {status === 'processing' ? 'Processing' : 'Pending'}
        </span>
      )
    case 'error':
      return (
        <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
          <AlertCircle className="h-3 w-3" />
          Error
        </span>
      )
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// KPI Editor
// ---------------------------------------------------------------------------

function KpiEditor({ companyId }: { companyId: string }) {
  const navigate = useNavigate()
  const currentYear = new Date().getFullYear() - 1
  const [fiscalYear, setFiscalYear] = useState(currentYear)
  const { data: kpiDefs } = useKpiDefinitions()
  const { data: existingKpis } = useMyCompanyKpis(companyId, fiscalYear)
  const upsertMutation = useUpsertMyCompanyKpis()

  const [values, setValues] = useState<Record<string, string>>({})

  // Initialize from existing data
  const getInitialValue = (kpiDefId: string): string => {
    if (values[kpiDefId] !== undefined) return values[kpiDefId]
    const existing = existingKpis?.find((k) => k.kpi_definition_id === kpiDefId)
    return existing ? String(existing.value) : ''
  }

  function handleSave() {
    // Merge existing KPI values with user edits
    const merged: Record<string, string> = {}
    if (existingKpis) {
      for (const kpi of existingKpis) {
        merged[kpi.kpi_definition_id] = String(kpi.value)
      }
    }
    Object.assign(merged, values)

    const kpis = Object.entries(merged)
      .filter(([, val]) => val.trim() !== '')
      .map(([kpiDefId, val]) => ({
        kpi_definition_id: kpiDefId,
        fiscal_year: fiscalYear,
        value: parseFloat(val),
        currency: 'CHF',
        notes: null,
      }))

    if (kpis.length === 0) {
      toast.error('Enter at least one KPI value')
      return
    }

    upsertMutation.mutate(
      { my_company_id: companyId, kpis },
      {
        onSuccess: () => toast.success(`${kpis.length} KPIs saved for ${fiscalYear}`, {
          action: {
            label: 'See Your Position',
            onClick: () => navigate('/my-company/benchmark'),
          },
        }),
        onError: (err) => toast.error(`Failed: ${err.message}`),
      }
    )
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <label htmlFor="kpi-fiscal-year" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Fiscal Year
        </label>
        <Select value={String(fiscalYear)} onValueChange={(v) => setFiscalYear(Number(v))}>
          <SelectTrigger id="kpi-fiscal-year" className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 5 }, (_, i) => currentYear - i).map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(kpiDefs ?? []).map((kpi) => (
          <div key={kpi.id} className="flex items-center gap-2">
            <label htmlFor={`kpi-${kpi.id}`} className="w-32 truncate text-xs text-muted-foreground" title={kpi.name}>
              {kpi.name}
            </label>
            <input
              id={`kpi-${kpi.id}`}
              type="number"
              step="any"
              value={getInitialValue(kpi.id)}
              onChange={(e) => setValues({ ...values, [kpi.id]: e.target.value })}
              placeholder="—"
              className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />
            <span className="text-[10px] text-muted-foreground">
              {kpi.unit_type === 'percentage' ? '%' : kpi.unit_type === 'currency' ? 'CHF' : ''}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={handleSave} disabled={upsertMutation.isPending}>
          {upsertMutation.isPending ? 'Saving...' : 'Save KPIs'}
        </Button>
      </div>
    </div>
  )
}
