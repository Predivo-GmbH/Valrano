import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Building2, Pencil, Upload, FileText, RotateCw, Loader2, Trash2,
  AlertTriangle, Check, X, Globe, Users, Calendar, DollarSign,
  TrendingUp, Leaf, Settings2, ChevronDown, ChevronRight,
} from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useMyCompanies,
  useMyCompanyKpis,
  useUpdateMyCompany,
  useUpsertMyCompanyKpis,
} from '@/hooks/useMyCompany'
import { useKpiDefinitions, useCompanies, useReports, useKpiValues } from '@/hooks/useData'
import { useExtractKpis, useNormalizeKpis } from '@/hooks/useExtraction'
import { useVisibleCompanyIds } from '@/hooks/useVisibleCompanyIds'
import { supabase } from '@/lib/supabase'
import { formatKpiValue } from '@/lib/format'
import { CardSkeleton } from '@/components/ui/page-skeleton'
import { Badge } from '@/components/ui/badge'
import { CompanyLogo, companyLogoUrl } from '@/components/ui/company-logo'
import { UploadReportDialog } from '@/components/upload-report-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ReportStatusBadge } from '@/components/ui/report-status-badge'


export function MyCompanyPage() {
  const navigate = useNavigate()
  const { data: companies, isLoading } = useMyCompanies()
  const { data: allCompanies } = useCompanies()
  const [uploadCompanyId, setUploadCompanyId] = useState<string | null>(null)

  const primaryCompany = companies?.find((c) => c.is_primary) ?? companies?.[0]
  const primaryCompanyId = primaryCompany?.company_id
  const { data: reports } = useReports(primaryCompanyId ?? undefined)

  const matchedCompany = allCompanies?.find((ac) => ac.id === primaryCompanyId)
  const logoUrl = matchedCompany?.logo_url || companyLogoUrl(matchedCompany?.website_url)

  return (
    <>
      {/* Action buttons — no page header (provided by MyCompanyTabsPage wrapper) */}
      <div className="mb-6 flex items-center justify-end gap-2">
        {primaryCompany?.company_id && (
          <Button variant="outline" onClick={() => setUploadCompanyId(primaryCompany.company_id)}>
            <Upload className="h-3.5 w-3.5" />
            Upload Report
          </Button>
        )}
        {primaryCompany && (
          <Button onClick={() => navigate('/my-company?tab=benchmark')}>View Benchmark</Button>
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
        ) : primaryCompany ? (
          <div className="space-y-6">
            {/* Section 1: Company Profile */}
            <CompanyProfileCard company={primaryCompany} logoUrl={logoUrl} />

            {/* Section 2: Extracted KPIs */}
            {primaryCompanyId && (
              <ExtractedKpisSection companyId={primaryCompanyId} />
            )}

            {/* Section 3: Reports */}
            {reports && reports.length > 0 && (
              <RecentReports reports={reports} />
            )}

            {/* Section 4: Quick Benchmark Position */}
            {primaryCompanyId && (
              <BenchmarkPositionSection companyId={primaryCompanyId} />
            )}

            {/* Manual KPI Entry (collapsed by default) */}
            <ManualKpiSection myCompanyId={primaryCompany.id} />
          </div>
        ) : null}

        {uploadCompanyId && (
          <UploadReportDialog
            open
            onClose={() => setUploadCompanyId(null)}
            companyId={uploadCompanyId}
          />
        )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Section 1: Company Profile Card (Enhanced with inline editing)
// ---------------------------------------------------------------------------

const PROFILE_FIELDS = [
  { key: 'sector', label: 'Sector', icon: Building2, placeholder: 'e.g. Building Materials', type: 'text' as const },
  { key: 'country', label: 'Country', icon: Globe, placeholder: 'e.g. Switzerland', type: 'text' as const },
  { key: 'reporting_currency', label: 'Currency', icon: DollarSign, placeholder: 'e.g. CHF', type: 'text' as const },
  { key: 'headcount', label: 'Headcount', icon: Users, placeholder: 'e.g. 65000', type: 'number' as const },
  { key: 'website_url', label: 'Website', icon: Globe, placeholder: 'e.g. https://example.com', type: 'text' as const },
  { key: 'founded_year', label: 'Founded', icon: Calendar, placeholder: 'e.g. 1912', type: 'number' as const },
] as const

type ProfileFieldKey = typeof PROFILE_FIELDS[number]['key']

function CompanyProfileCard({
  company,
  logoUrl,
}: {
  company: { id: string; company_id: string | null; name: string; sector: string | null; country: string | null; reporting_currency: string | null; headcount: number | null; website_url: string | null; founded_year: number | null; is_primary: boolean }
  logoUrl?: string | null
}) {
  const updateMutation = useUpdateMyCompany()
  const [editingField, setEditingField] = useState<ProfileFieldKey | null>(null)
  const [editValue, setEditValue] = useState('')

  const filledCount = PROFILE_FIELDS.filter((f) => {
    const val = company[f.key as keyof typeof company]
    return val !== null && val !== undefined && val !== ''
  }).length

  function startEdit(field: ProfileFieldKey) {
    const current = company[field as keyof typeof company]
    setEditValue(current != null ? String(current) : '')
    setEditingField(field)
  }

  function saveEdit(field: ProfileFieldKey) {
    const fieldDef = PROFILE_FIELDS.find((f) => f.key === field)
    const value = editValue.trim()
    const parsed = fieldDef?.type === 'number' ? (value ? Number(value) : null) : (value || null)

    updateMutation.mutate(
      { id: company.id, [field]: parsed },
      {
        onSuccess: () => {
          toast.success(`${fieldDef?.label} updated`)
          setEditingField(null)
        },
        onError: (err) => toast.error(`Update failed: ${err.message}`),
      },
    )
  }

  function cancelEdit() {
    setEditingField(null)
    setEditValue('')
  }

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
                <Badge variant="secondary" className="bg-[var(--color-accent)]/10 text-[10px] text-[var(--color-accent)]">
                  Primary
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
              <div
                className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500"
                style={{ width: `${(filledCount / PROFILE_FIELDS.length) * 100}%` }}
              />
            </div>
            <span>{filledCount}/{PROFILE_FIELDS.length}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
        {PROFILE_FIELDS.map((field) => {
          const Icon = field.icon
          const rawValue = company[field.key as keyof typeof company]
          const displayValue = rawValue != null
            ? field.key === 'headcount' ? Number(rawValue).toLocaleString()
            : field.key === 'website_url' ? String(rawValue).replace(/^https?:\/\//, '')
            : String(rawValue)
            : null
          const isEditing = editingField === field.key

          return (
            <div key={field.key} className="group">
              <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                <Icon className="h-3 w-3" />
                {field.label}
              </span>
              {isEditing ? (
                <div className="mt-0.5 flex items-center gap-1">
                  <Input
                    type={field.type ?? 'text'}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder={field.placeholder}
                    className="h-7 text-[13px]"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(field.key)
                      if (e.key === 'Escape') cancelEdit()
                    }}
                  />
                  <Button variant="ghost" size="icon-xs" onClick={() => saveEdit(field.key)} disabled={updateMutation.isPending} aria-label="Save">
                    <Check className="h-3.5 w-3.5 text-[var(--color-signal-green)]" />
                  </Button>
                  <Button variant="ghost" size="icon-xs" onClick={cancelEdit} aria-label="Cancel">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit(field.key)}
                  className="mt-0.5 flex w-full items-center gap-1 rounded px-0 text-left text-[13px] font-medium text-foreground transition-colors hover:text-[var(--color-accent)]"
                >
                  {displayValue ?? <span className="text-muted-foreground/40">Set {field.label.toLowerCase()}...</span>}
                  <Pencil className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-50" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section 2: Extracted KPIs Dashboard
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  financial: 'Financial',
  esg: 'ESG',
  operational: 'Operational',
}

const CATEGORY_ICONS: Record<string, typeof TrendingUp> = {
  financial: TrendingUp,
  esg: Leaf,
  operational: Settings2,
}

function ExtractedKpisSection({ companyId }: { companyId: string }) {
  const { data: kpiValues, isLoading } = useKpiValues({ companyIds: [companyId] })
  const [activeCategory, setActiveCategory] = useState<string>('all')

  const grouped = useMemo(() => {
    if (!kpiValues?.length) return {}
    const map: Record<string, typeof kpiValues> = {}
    for (const kv of kpiValues) {
      const cat = kv.kpi_definitions?.category ?? 'other'
      if (!map[cat]) map[cat] = []
      map[cat].push(kv)
    }
    return map
  }, [kpiValues])

  const categories = Object.keys(grouped).sort()

  const { years, kpisByDef } = useMemo(() => {
    const filtered = activeCategory === 'all'
      ? kpiValues ?? []
      : grouped[activeCategory] ?? []

    const yrs = [...new Set(filtered.map((kv) => kv.fiscal_year))].sort((a, b) => b - a)

    const byDef = new Map<string, typeof filtered>()
    for (const kv of filtered) {
      const defId = kv.kpi_definition_id
      if (!byDef.has(defId)) byDef.set(defId, [])
      byDef.get(defId)!.push(kv)
    }
    for (const values of byDef.values()) {
      values.sort((a, b) => b.fiscal_year - a.fiscal_year)
    }

    return { years: yrs, kpisByDef: byDef }
  }, [kpiValues, activeCategory, grouped])

  if (isLoading) return <CardSkeleton />

  if (!kpiValues?.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <TrendingUp className="mx-auto h-10 w-10 text-muted-foreground/30" />
        <h3 className="mt-3 text-sm font-semibold text-foreground">No KPIs extracted yet</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Upload an annual report to automatically extract financial, ESG, and operational KPIs.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Extracted KPIs</h3>
          <p className="text-[11px] text-muted-foreground">
            {kpiValues.length} KPIs from {years.length} fiscal year{years.length !== 1 ? 's' : ''} ({years.join(', ')})
          </p>
        </div>
        {categories.length > 1 && (
          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="h-8 bg-[var(--color-bg-tertiary)] p-0.5">
              <TabsTrigger value="all" className="h-7 px-3 text-[11px]">All</TabsTrigger>
              {categories.map((cat) => (
                <TabsTrigger key={cat} value={cat} className="h-7 px-3 text-[11px]">
                  {CATEGORY_LABELS[cat] ?? cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </div>

      <div className="space-y-1">
        {/* Header */}
        <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <span className="w-[180px]">KPI</span>
          <span className="w-[80px] text-right">Value</span>
          <span className="w-[60px] text-right">Year</span>
          <span className="flex-1 text-right">Category</span>
        </div>

        {[...kpisByDef.entries()].map(([defId, values]) => {
          const latest = values[0]
          const def = latest.kpi_definitions
          if (!def) return null
          const CatIcon = CATEGORY_ICONS[def.category] ?? TrendingUp

          return (
            <div
              key={defId}
              className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--color-bg-tertiary)]"
            >
              <div className="w-[180px] min-w-0">
                {def.description ? (
                  <TooltipProvider delay={200}>
                    <Tooltip>
                      <TooltipTrigger className="truncate text-[13px] font-medium text-foreground cursor-help border-b border-dotted border-muted-foreground/40">
                        {def.name}
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[280px] text-left text-[12px] font-normal">
                        {def.description}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <p className="truncate text-[13px] font-medium text-foreground">
                    {def.name}
                  </p>
                )}
                {latest.confidence != null && (
                  <p className="text-[10px] text-muted-foreground">
                    {Math.round(latest.confidence * 100)}% confidence
                  </p>
                )}
              </div>
              <div className="w-[80px] text-right">
                <span className="text-[13px] font-semibold tabular-nums text-foreground">
                  {formatKpiValue(latest.normalized_value ?? latest.raw_value, def.unit_type)}
                </span>
                {latest.raw_currency && latest.raw_currency !== 'CHF' && (
                  <p className="text-[10px] text-muted-foreground">
                    {latest.raw_currency} {latest.raw_value}
                  </p>
                )}
              </div>
              <span className="w-[60px] text-right text-[12px] tabular-nums text-muted-foreground">
                FY {latest.fiscal_year}
              </span>
              <div className="flex flex-1 items-center justify-end gap-1.5">
                <CatIcon className="h-3 w-3 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">
                  {CATEGORY_LABELS[def.category] ?? def.category}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
        <p className="text-[10px] text-muted-foreground">
          Auto-extracted from uploaded reports via AI
        </p>
        <div className="flex items-center gap-2">
          {categories.map((cat) => (
            <span key={cat} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
              {CATEGORY_LABELS[cat] ?? cat}: {grouped[cat]?.length ?? 0}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}


// ---------------------------------------------------------------------------
// Section 3: Recent Reports (Enhanced)
// ---------------------------------------------------------------------------

interface ReportWithExtraction {
  id: string
  title: string | null
  report_type: string
  fiscal_year: number
  fiscal_quarter: number | null
  status: string
  created_at: string
  pdf_storage_path: string | null
  extractions?: { id: string; total_kpis_extracted: number; avg_confidence: number | null; model_used: string | null; status: string }[]
}

function RecentReports({ reports }: { reports: ReportWithExtraction[] }) {
  const queryClient = useQueryClient()
  const extractMutation = useExtractKpis()
  const normalizeMutation = useNormalizeKpis()
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string; storagePath: string | null } | null>(null)

  async function handleRetry(reportId: string) {
    setRetryingId(reportId)
    try {
      const extraction = await extractMutation.mutateAsync(reportId)
      try { await normalizeMutation.mutateAsync(reportId) } catch { /* non-fatal */ }
      toast.success(`Extracted ${extraction.total_kpis_extracted} KPIs`)
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['kpi-values'] })
    } catch (err) {
      toast.error(`Extraction failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setRetryingId(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const { id, storagePath } = deleteTarget
    setDeleteTarget(null)
    setDeletingId(id)
    try {
      if (storagePath) {
        await supabase.storage.from('reports').remove([storagePath])
      }
      const { data, error } = await supabase.from('reports').delete().eq('id', id).select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Permission denied — you can only delete reports for your own company')
      toast.success('Report deleted')
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['kpi-values'] })
      queryClient.invalidateQueries({ queryKey: ['extractions'] })
    } catch (err) {
      toast.error(`Delete failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Reports ({reports.length})</h3>
        <div className="space-y-2">
          {reports.slice(0, 10).map((report) => {
            const extraction = report.extractions?.find((e) => e.status === 'completed')
            return (
            <div key={report.id} className="rounded-lg border border-border/50 bg-[var(--color-bg-tertiary)] px-3 py-2.5">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">
                    {report.title ?? `Report FY ${report.fiscal_year}`}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {report.report_type} · FY {report.fiscal_year}{report.fiscal_quarter ? ` Q${report.fiscal_quarter}` : ''} · {new Date(report.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {(report.status === 'pending' || report.status === 'error') && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleRetry(report.id)}
                      disabled={retryingId === report.id}
                      aria-label="Retry extraction"
                      title="Retry extraction"
                    >
                      {retryingId === report.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setDeleteTarget({ id: report.id, title: report.title ?? `Report FY ${report.fiscal_year}`, storagePath: report.pdf_storage_path })}
                    disabled={deletingId === report.id}
                    aria-label="Delete report"
                    title="Delete report"
                    className="hover:bg-destructive/10 hover:text-destructive"
                  >
                    {deletingId === report.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                  <ReportStatusBadge status={report.status} />
                </div>
              </div>
              {extraction && (
                <div className="mt-1.5 flex items-center gap-3 pl-7 text-[10px] text-muted-foreground">
                  <span>{extraction.total_kpis_extracted} KPIs extracted</span>
                  {extraction.avg_confidence != null && (
                    <span>· {Math.round(extraction.avg_confidence * 100)}% confidence</span>
                  )}
                  {extraction.model_used && (
                    <span>· {extraction.model_used}</span>
                  )}
                </div>
              )}
            </div>
            )
          })}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle className="text-center">Delete Report</DialogTitle>
            <DialogDescription className="text-center">
              Are you sure you want to delete <span className="font-medium text-foreground">"{deleteTarget?.title}"</span>?
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-[12px]">
            <p className="mb-2 font-medium text-destructive">This will permanently remove:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-destructive">-</span>
                The uploaded PDF file
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-destructive">-</span>
                All extracted KPIs from this report
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-destructive">-</span>
                The AI analysis and report context
              </li>
            </ul>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Peer benchmarks and calendar events linked to this report will keep working but lose their source reference.
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---------------------------------------------------------------------------
// Section 4: Quick Benchmark Position
// ---------------------------------------------------------------------------

const LOWER_IS_BETTER_CODES = new Set([
  'CO2_EMISSIONS', 'CO2_INTENSITY', 'ENERGY_INTENSITY',
  'WATER_INTENSITY', 'NET_DEBT', 'DEBT_TO_EQUITY',
])

function BenchmarkPositionSection({ companyId }: { companyId: string }) {
  const navigate = useNavigate()
  const { data: visibleIds } = useVisibleCompanyIds()

  // Get my KPIs
  const { data: myKpis } = useKpiValues({ companyIds: [companyId] })

  // Get peer KPIs (all visible companies)
  const peerIds = useMemo(
    () => visibleIds?.filter((id) => id !== companyId) ?? [],
    [visibleIds, companyId],
  )
  const { data: peerKpis } = useKpiValues({ companyIds: peerIds.length > 0 ? peerIds : undefined })

  const benchmarkRows = useMemo(() => {
    if (!myKpis?.length || !peerKpis?.length) return []

    // Build map of my latest KPI per definition
    const myByDef = new Map<string, typeof myKpis[0]>()
    for (const kv of myKpis) {
      const existing = myByDef.get(kv.kpi_definition_id)
      if (!existing || kv.fiscal_year > existing.fiscal_year) {
        myByDef.set(kv.kpi_definition_id, kv)
      }
    }

    // Build map of peer values per definition
    const peerByDef = new Map<string, number[]>()
    for (const kv of peerKpis) {
      if (kv.normalized_value == null) continue
      if (!peerByDef.has(kv.kpi_definition_id)) peerByDef.set(kv.kpi_definition_id, [])
      peerByDef.get(kv.kpi_definition_id)!.push(kv.normalized_value)
    }

    const rows: { name: string; description: string | null; code: string; myValue: number; peerMedian: number; percentile: number; unitType: string }[] = []

    for (const [defId, myKpi] of myByDef) {
      const peerValues = peerByDef.get(defId)
      if (!peerValues?.length || myKpi.normalized_value == null) continue
      const def = myKpi.kpi_definitions
      if (!def) continue

      const sorted = [...peerValues].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2

      const allValues = [...peerValues, myKpi.normalized_value].sort((a, b) => a - b)
      const rank = allValues.filter((v) => v < myKpi.normalized_value!).length
      let pctile = allValues.length > 1 ? Math.round((rank / (allValues.length - 1)) * 100) : 50
      if (LOWER_IS_BETTER_CODES.has(def.code)) pctile = 100 - pctile

      rows.push({
        name: def.name,
        description: def.description ?? null,
        code: def.code,
        myValue: myKpi.normalized_value,
        peerMedian: median,
        percentile: pctile,
        unitType: def.unit_type,
      })
    }

    // Sort by percentile — show strengths first
    rows.sort((a, b) => b.percentile - a.percentile)
    return rows.slice(0, 5)
  }, [myKpis, peerKpis])

  if (!benchmarkRows.length) return null

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Benchmark Position</h3>
          <p className="text-[11px] text-muted-foreground">
            Your position vs {peerIds.length} peer{peerIds.length !== 1 ? 's' : ''} — top 5 KPIs
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/my-company?tab=benchmark')}>
          Full Benchmark
        </Button>
      </div>

      <div className="space-y-3">
        {benchmarkRows.map((row) => {
          const barColor = row.percentile >= 66
            ? 'bg-[var(--color-signal-green)]'
            : row.percentile >= 33
              ? 'bg-[var(--color-signal-amber)]'
              : 'bg-[var(--color-signal-red)]'
          const signal = row.percentile >= 66 ? 'Strength' : row.percentile <= 33 ? 'Risk' : 'Average'

          return (
            <div key={row.code}>
              <div className="mb-1 flex items-center justify-between text-[12px]">
                {row.description ? (
                  <TooltipProvider delay={200}>
                    <Tooltip>
                      <TooltipTrigger className="font-medium text-foreground cursor-help border-b border-dotted border-muted-foreground/40">
                        {row.name}
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[280px] text-left text-[12px] font-normal">
                        {row.description}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <span className="font-medium text-foreground">{row.name}</span>
                )}
                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-foreground">{formatKpiValue(row.myValue, row.unitType)}</span>
                  <span className="text-muted-foreground">vs</span>
                  <span className="tabular-nums text-muted-foreground">{formatKpiValue(row.peerMedian, row.unitType)}</span>
                  <Badge
                    variant="secondary"
                    className={`text-[9px] ${
                      row.percentile >= 66 ? 'bg-[var(--color-signal-green)]/10 text-[var(--color-signal-green)]'
                      : row.percentile <= 33 ? 'bg-[var(--color-signal-red)]/10 text-[var(--color-signal-red)]'
                      : 'bg-[var(--color-signal-amber)]/10 text-[var(--color-signal-amber)]'
                    }`}
                  >
                    {signal}
                  </Badge>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                  style={{ width: `${row.percentile}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Manual KPI Entry (collapsible section)
// ---------------------------------------------------------------------------

function ManualKpiSection({ myCompanyId }: { myCompanyId: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-5 text-left"
      >
        <div>
          <h3 className="text-sm font-semibold text-foreground">Manual KPI Entry</h3>
          <p className="text-[11px] text-muted-foreground">Enter KPIs manually if you don't have a report to upload</p>
        </div>
        {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {isOpen && (
        <div className="border-t border-border px-5 pb-5 pt-4">
          <KpiEditor companyId={myCompanyId} />
        </div>
      )}
    </div>
  )
}


// ---------------------------------------------------------------------------
// KPI Editor (Manual entry form)
// ---------------------------------------------------------------------------

function KpiEditor({ companyId }: { companyId: string }) {
  const navigate = useNavigate()
  const currentYear = new Date().getFullYear() - 1
  const [fiscalYear, setFiscalYear] = useState(currentYear)
  const { data: kpiDefs } = useKpiDefinitions()
  const { data: existingKpis } = useMyCompanyKpis(companyId, fiscalYear)
  const upsertMutation = useUpsertMyCompanyKpis()

  const [values, setValues] = useState<Record<string, string>>({})

  const getInitialValue = (kpiDefId: string): string => {
    if (values[kpiDefId] !== undefined) return values[kpiDefId]
    const existing = existingKpis?.find((k) => k.kpi_definition_id === kpiDefId)
    return existing ? String(existing.value) : ''
  }

  function handleSave() {
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
            onClick: () => navigate('/my-company?tab=benchmark'),
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
            <Input
              id={`kpi-${kpi.id}`}
              type="number"
              step="any"
              value={getInitialValue(kpi.id)}
              onChange={(e) => setValues({ ...values, [kpi.id]: e.target.value })}
              placeholder="—"
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
