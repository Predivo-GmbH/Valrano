import { useState, useRef, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import { Building2, Plus, Pencil, Upload, FileText, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  useMyCompanies,
  useCreateMyCompany,
  useMyCompanyKpis,
  useUpsertMyCompanyKpis,
} from '@/hooks/useMyCompany'
import { useKpiDefinitions, useCompanies } from '@/hooks/useData'
import { useUploadReport, useExtractKpis } from '@/hooks/useExtraction'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { CardSkeleton } from '@/components/ui/page-skeleton'
import { CompanyAutocomplete, type CompanyResult } from '@/components/company-autocomplete/CompanyAutocomplete'
import { REPORT_TYPE_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { ReportType } from '@/types/database'


function companyLogoUrl(websiteUrl: string | null | undefined): string | null {
  if (!websiteUrl) return null
  const domain = websiteUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '')
  return `https://cdn.brandfetch.io/${domain}/w/128/h/128/icon?c=1idRDjMi84k4oQP5jUq`
}

const SECTORS = [
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
]

export function MyCompanyPage() {
  const navigate = useNavigate()
  const { data: companies, isLoading } = useMyCompanies()
  const { data: allCompanies } = useCompanies()
  const [showCreate, setShowCreate] = useState(false)
  const [editingKpis, setEditingKpis] = useState<string | null>(null)
  const [uploadCompanyId, setUploadCompanyId] = useState<string | null>(null)

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
            <h3 className="mt-4 text-lg font-semibold text-foreground">Add your company</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your company details and KPI data to see how you compare against industry peers.
            </p>
            <Button onClick={() => setShowCreate(true)} className="mt-6">
              <Plus className="h-4 w-4" />
              Add Company
            </Button>
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

            {/* Add another company */}
            <Button
              variant="outline"
              onClick={() => setShowCreate(true)}
              className="flex w-full items-center justify-center gap-2 border-dashed"
            >
              <Plus className="h-4 w-4" />
              Add Another Company
            </Button>
          </div>
        )}

        <CreateCompanyDialog open={showCreate} onClose={() => setShowCreate(false)} />
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
          {logoUrl ? (
            <img src={logoUrl} alt={company.name} className="h-10 w-10 rounded-lg object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden') }} />
          ) : null}
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]', logoUrl && 'hidden')}>
            <Building2 className="h-5 w-5" />
          </div>
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

// ---------------------------------------------------------------------------
// Create Company Dialog
// ---------------------------------------------------------------------------

function CreateCompanyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  const [sector, setSector] = useState('')
  const [country, setCountry] = useState('Switzerland')
  const [currency, setCurrency] = useState('CHF')
  const [headcount, setHeadcount] = useState('')
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const createMutation = useCreateMyCompany()

  const nameInvalid = !name.trim() && submitAttempted

  const handleCompanyAutoSelect = (company: CompanyResult) => {
    setName(company.name)
    // Auto-fill sector
    if (company.sector) {
      const match = SECTORS.find((s) =>
        company.sector!.toLowerCase().includes(s.toLowerCase()) ||
        s.toLowerCase().includes(company.sector!.split(' ')[0].toLowerCase()),
      )
      if (match) setSector(match)
    }
    // Auto-fill country from jurisdiction
    if (company.jurisdiction) {
      setCountry(company.jurisdiction)
    }
    // Auto-fill currency
    if (company.currency) {
      setCurrency(company.currency)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitAttempted(true)
    if (!name.trim()) return
    createMutation.mutate(
      {
        name,
        sector: sector || null,
        country: country || null,
        reporting_currency: currency,
        headcount: headcount ? parseInt(headcount) : null,
        is_primary: true,
        founded_year: null,
        website_url: null,
      },
      {
        onSuccess: (data) => {
          toast.success('Company added')
          onClose()
          // Auto-resolve website URL (and thus logo) in background
          if (data?.company_id) {
            supabase.auth.getSession().then(({ data: { session } }) => {
              if (!session) return
              fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-company-website`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                  },
                  body: JSON.stringify({ name, company_id: data.company_id }),
                },
              ).catch(() => {})
            })
          }
        },
        onError: (err) => toast.error(`Failed: ${err.message}`),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Your Company</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="company-name" className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Company Name</label>
            <CompanyAutocomplete
              id="company-name"
              value={name}
              onChange={(v) => { setName(v); setSubmitAttempted(false) }}
              onSelect={handleCompanyAutoSelect}
              placeholder="Start typing to search..."
              className={nameInvalid ? 'border-[var(--color-signal-red)]' : ''}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">Type 3+ letters to search company registers</p>
            {nameInvalid && <p className="mt-1 text-[12px] text-[var(--color-signal-red)]">Company name is required.</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="company-sector" className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Sector</label>
              <Select value={sector} onValueChange={(v) => v && setSector(v)}>
                <SelectTrigger id="company-sector" className="w-full">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Select...</SelectItem>
                  {SECTORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="company-country" className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Country</label>
              <input
                id="company-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="company-currency" className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Currency</label>
              <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
                <SelectTrigger id="company-currency" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CHF">CHF</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="company-headcount" className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Headcount</label>
              <input
                id="company-headcount"
                type="number"
                value={headcount}
                onChange={(e) => setHeadcount(e.target.value)}
                placeholder="e.g., 500"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Adding...' : 'Add Company'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Upload Report Dialog
// ---------------------------------------------------------------------------

function UploadReportDialog({
  open,
  onClose,
  companyId,
}: {
  open: boolean
  onClose: () => void
  companyId: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [reportType, setReportType] = useState<ReportType>('annual')
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear() - 1)
  const [fiscalQuarter, setFiscalQuarter] = useState(1)
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const uploadMutation = useUploadReport()
  const extractMutation = useExtractKpis()

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

      try {
        const extraction = await extractMutation.mutateAsync(result.report_id)
        toast.success(`Extracted ${extraction.total_kpis_extracted} KPIs`)
      } catch {
        toast.error('Upload succeeded but extraction failed — try again later')
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
          {/* Report Type */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Report Type
            </Label>
            <Select value={reportType} onValueChange={(v) => v && setReportType(v as ReportType)}>
              <SelectTrigger className="w-full rounded-lg border-border bg-[var(--color-bg-tertiary)] text-[13px] text-foreground">
                <SelectValue>{REPORT_TYPE_LABELS[reportType]}</SelectValue>
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
                    <SelectValue>Q{fiscalQuarter}</SelectValue>
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
            disabled={isUploading || !file}
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
