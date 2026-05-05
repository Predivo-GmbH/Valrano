import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import { Building2, Plus, Pencil } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  useMyCompanies,
  useCreateMyCompany,
  useMyCompanyKpis,
  useUpsertMyCompanyKpis,
} from '@/hooks/useMyCompany'
import { useKpiDefinitions } from '@/hooks/useData'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { CardSkeleton } from '@/components/ui/page-skeleton'

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
  const [showCreate, setShowCreate] = useState(false)
  const [editingKpis, setEditingKpis] = useState<string | null>(null)

  const primaryCompany = companies?.find((c) => c.is_primary) ?? companies?.[0]

  return (
    <>
      <Helmet><title>My Company - BenchmarkSignal</title></Helmet>
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">My Company</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Enter your company data to benchmark against peers.
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
                isEditingKpis={editingKpis === company.id}
                onEditKpis={() => setEditingKpis(editingKpis === company.id ? null : company.id)}
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
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Company Card
// ---------------------------------------------------------------------------

function CompanyCard({
  company,
  isEditingKpis,
  onEditKpis,
}: {
  company: { id: string; name: string; sector: string | null; country: string | null; reporting_currency: string | null; headcount: number | null; is_primary: boolean }
  isEditingKpis: boolean
  onEditKpis: () => void
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
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
        <Button variant="outline" size="sm" onClick={onEditKpis}>
          <Pencil className="h-3.5 w-3.5" />
          {isEditingKpis ? 'Close' : 'Edit KPIs'}
        </Button>
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
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const createMutation = useCreateMyCompany()

  const nameInvalid = !name.trim() && (touched.name || submitAttempted)

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
        onSuccess: () => {
          toast.success('Company added')
          onClose()
        },
        onError: (err) => toast.error(`Failed: ${err.message}`),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Your Company</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="company-name" className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Company Name</label>
            <input
              id="company-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              aria-invalid={nameInvalid}
              placeholder="e.g., Acme Corp"
              className={`w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground ${nameInvalid ? 'border-[var(--color-signal-red)]' : 'border-border'}`}
            />
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
