import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  ArrowLeft,
  Building2,
  Globe,
  FileText,
  TrendingUp,
  ExternalLink,
  Calendar,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { useCompanies, useKpiValues } from '@/hooks/useData'
import { usePublicationEvents } from '@/hooks/useCalendar'
import { PageSkeleton } from '@/components/ui/page-skeleton'

const CHART_COLORS = [
  'var(--color-accent)',
  'var(--color-signal-green)',
  'var(--color-signal-amber)',
  'var(--color-signal-red)',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
]

export function CompanyProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { data: companies, isLoading: companiesLoading } = useCompanies()
  const { data: kpiValues, isLoading: kpisLoading } = useKpiValues({ companyIds: id ? [id] : [] })
  const { data: events } = usePublicationEvents()

  const company = useMemo(() => companies?.find((c) => c.id === id), [companies, id])

  const companyEvents = useMemo(
    () => (events ?? []).filter((e) => e.company_id === id).sort((a, b) => b.expected_date.localeCompare(a.expected_date)),
    [events, id],
  )

  // Group KPI values by KPI definition, then by year
  const kpisByCode = useMemo(() => {
    if (!kpiValues) return []
    const map = new Map<string, { name: string; unit: string | null; values: Map<number, number> }>()
    for (const kv of kpiValues) {
      const def = kv.kpi_definitions
      const value = kv.normalized_value ?? kv.raw_value
      if (!def || value === null) continue
      if (!map.has(def.code)) {
        map.set(def.code, { name: def.name, unit: def.unit_type, values: new Map() })
      }
      map.get(def.code)!.values.set(kv.fiscal_year, value)
    }
    return [...map.entries()].map(([code, data]) => ({
      code,
      name: data.name,
      unit: data.unit,
      values: [...data.values.entries()]
        .sort(([a], [b]) => a - b)
        .map(([year, value]) => ({ year, value })),
    }))
  }, [kpiValues])

  // Latest year values for the summary table
  const latestYear = useMemo(() => {
    if (kpisByCode.length === 0) return null
    return Math.max(...kpisByCode.flatMap((k) => k.values.map((v) => v.year)))
  }, [kpisByCode])

  // Chart data: all KPIs over time
  const chartData = useMemo(() => {
    if (kpisByCode.length === 0) return []
    const years = new Set<number>()
    for (const kpi of kpisByCode) {
      for (const v of kpi.values) years.add(v.year)
    }
    return [...years].sort().map((year) => {
      const point: Record<string, number | string> = { year }
      for (const kpi of kpisByCode) {
        const v = kpi.values.find((val) => val.year === year)
        if (v) point[kpi.name] = v.value
      }
      return point
    })
  }, [kpisByCode])

  if (companiesLoading || kpisLoading) return <PageSkeleton />

  if (!company) {
    return (
      <>
        <Helmet><title>Company Not Found - BenchmarkSignal</title></Helmet>
        <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
          <Link to="/peers" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Peers
          </Link>
          <div className="card-premium rounded-xl border border-border bg-card p-12 text-center">
            <Building2 className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <h2 className="mt-3 text-lg font-semibold text-foreground">Company not found</h2>
            <p className="mt-1 text-sm text-muted-foreground">This company doesn't exist or you don't have access.</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Helmet><title>{company.name} - BenchmarkSignal</title></Helmet>
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        {/* Back link */}
        <Link to="/peers" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Peers
        </Link>

        {/* Company header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">
              {company.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
              {company.ticker && (
                <span className="rounded bg-[var(--color-bg-tertiary)] px-2 py-0.5 font-mono text-xs font-medium text-foreground">
                  {company.ticker}
                </span>
              )}
              {company.exchange && <span>{company.exchange}</span>}
              {company.country && <span>{company.country}</span>}
              {company.sector && <span>{company.sector}</span>}
            </div>
          </div>
        </div>

        {/* Info cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <InfoCard label="Currency" value={company.reporting_currency ?? '—'} />
          <InfoCard label="Fiscal Year End" value={company.fiscal_year_end ?? '—'} />
          <InfoCard label="ISIN" value={company.isin ?? '—'} />
          <InfoCard label="KPIs Available" value={String(kpisByCode.length)} />
        </div>

        {/* Links */}
        {(company.website_url || company.ir_page_url) && (
          <div className="mb-6 flex flex-wrap gap-3">
            {company.website_url && (
              <a
                href={company.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <Globe className="h-4 w-4" /> Website <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {company.ir_page_url && (
              <a
                href={company.ir_page_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <FileText className="h-4 w-4" /> Investor Relations <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}

        {/* KPI Summary Table */}
        {kpisByCode.length > 0 && latestYear && (
          <div className="mb-6 card-premium rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-3">
              <h2 className="font-semibold text-foreground">Key Metrics — FY {latestYear}</h2>
            </div>
            <div className="divide-y divide-border/50">
              {kpisByCode.map((kpi) => {
                const latest = kpi.values.find((v) => v.year === latestYear)
                const prev = kpi.values.find((v) => v.year === latestYear - 1)
                const change = latest && prev ? ((latest.value - prev.value) / Math.abs(prev.value)) * 100 : null
                return (
                  <div key={kpi.code} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{kpi.name}</p>
                      {kpi.unit && <p className="text-[11px] text-muted-foreground">{kpi.unit}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-foreground">
                        {latest?.value.toLocaleString() ?? '—'}
                      </p>
                      {change !== null && isFinite(change) && (
                        <p className={`text-[11px] tabular-nums ${change > 0 ? 'text-[var(--color-signal-green)]' : change < 0 ? 'text-[var(--color-signal-red)]' : 'text-muted-foreground'}`}>
                          {change > 0 ? '+' : ''}{change.toFixed(1)}% YoY
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* KPI Trend Chart */}
        {chartData.length > 1 && (
          <div className="mb-6 card-premium card-accent-top rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-semibold text-foreground">
              <TrendingUp className="mr-2 inline h-4 w-4" />
              Performance Over Time
            </h2>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="year" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                    tickFormatter={(v: number) => Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(v)}
                    width={60}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend />
                  {kpisByCode.slice(0, 8).map((kpi, i) => (
                    <Line
                      key={kpi.code}
                      type="monotone"
                      dataKey={kpi.name}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* No KPI data state */}
        {kpisByCode.length === 0 && (
          <div className="mb-6 card-premium rounded-xl border border-border bg-card p-12 text-center">
            <TrendingUp className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <h3 className="mt-3 text-lg font-semibold text-foreground">No KPI data yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload a report for {company.name} to see extracted KPIs and trends.
            </p>
            <Link
              to={`/peers?tab=upload&company=${company.id}`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent)]/90"
            >
              Upload Report
            </Link>
          </div>
        )}

        {/* Publication Events */}
        {companyEvents.length > 0 && (
          <div className="card-premium rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-3">
              <h2 className="font-semibold text-foreground">
                <Calendar className="mr-2 inline h-4 w-4" />
                Publication History
              </h2>
            </div>
            <div className="divide-y divide-border/50">
              {companyEvents.slice(0, 10).map((event) => (
                <div key={event.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{event.report_type}</p>
                    <p className="text-[11px] text-muted-foreground">Expected: {event.expected_date}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    event.status === 'detected' ? 'bg-[var(--color-signal-green)]/10 text-[var(--color-signal-green)]' :
                    event.status === 'overdue' ? 'bg-[var(--color-signal-red)]/10 text-[var(--color-signal-red)]' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {event.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-premium rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-foreground truncate">{value}</div>
    </div>
  )
}
