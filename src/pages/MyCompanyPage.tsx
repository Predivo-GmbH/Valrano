import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import { Building2, Plus, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import {
  useMyCompanies,
  useCreateMyCompany,
  useMyCompanyKpis,
  useUpsertMyCompanyKpis,
} from '@/hooks/useMyCompany'
import { useKpiDefinitions } from '@/hooks/useData'

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
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">My Company</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your company data to benchmark against peers.
            </p>
          </div>
          {primaryCompany && (
            <button
              onClick={() => navigate('/my-company/benchmark')}
              className="rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
            >
              View Benchmark
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="py-20 text-center text-sm text-muted-foreground">Loading...</div>
        ) : !companies || companies.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">Add your company</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your company details and KPI data to see how you compare against industry peers.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Add Company
            </button>
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
            <button
              onClick={() => setShowCreate(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/50 px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-[var(--color-primary)] hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              Add Another Company
            </button>
          </div>
        )}

        {showCreate && (
          <CreateCompanyDialog onClose={() => setShowCreate(false)} />
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
        <button
          onClick={onEditKpis}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
          {isEditingKpis ? 'Close' : 'Edit KPIs'}
        </button>
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
    const kpis = Object.entries(values)
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
        onSuccess: () => toast.success(`${kpis.length} KPIs saved for ${fiscalYear}`),
        onError: (err) => toast.error(`Failed: ${err.message}`),
      }
    )
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Fiscal Year
        </label>
        <select
          value={fiscalYear}
          onChange={(e) => setFiscalYear(Number(e.target.value))}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        >
          {Array.from({ length: 5 }, (_, i) => currentYear - i).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(kpiDefs ?? []).map((kpi) => (
          <div key={kpi.id} className="flex items-center gap-2">
            <label className="w-32 truncate text-xs text-muted-foreground" title={kpi.name}>
              {kpi.name}
            </label>
            <input
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
        <button
          onClick={handleSave}
          disabled={upsertMutation.isPending}
          className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {upsertMutation.isPending ? 'Saving...' : 'Save KPIs'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create Company Dialog
// ---------------------------------------------------------------------------

function CreateCompanyDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [sector, setSector] = useState('')
  const [country, setCountry] = useState('Switzerland')
  const [currency, setCurrency] = useState('CHF')
  const [headcount, setHeadcount] = useState('')
  const createMutation = useCreateMyCompany()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Add Your Company</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Company Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g., Acme Corp"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Sector</label>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">Select...</option>
                {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Country</label>
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="CHF">CHF</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Headcount</label>
              <input
                type="number"
                value={headcount}
                onChange={(e) => setHeadcount(e.target.value)}
                placeholder="e.g., 500"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50">
              {createMutation.isPending ? 'Adding...' : 'Add Company'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
