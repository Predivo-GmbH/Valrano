import { useState, useMemo, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { shortKpiLabel } from '@/lib/kpi-labels'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Table2,
  ScatterChart as ScatterIcon,
  Grid3X3,
} from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { useTrendData, useCagr, useMomentum } from '@/hooks/useTrends'
import { usePivotData, useScatterData, useHeatmapData } from '@/hooks/useAnalytics'
import { useCompanies, useKpiDefinitions, usePeerGroups } from '@/hooks/useData'
import { useSmartYear } from '@/hooks/useSmartYear'
import { PageSkeleton } from '@/components/ui/page-skeleton'

type TabId = 'trends' | 'pivot' | 'scatter' | 'heatmap'

const TABS: { id: TabId; label: string; icon: ReactNode }[] = [
  { id: 'trends', label: 'Trends', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'pivot', label: 'Pivot Table', icon: <Table2 className="h-4 w-4" /> },
  { id: 'scatter', label: 'Scatter', icon: <ScatterIcon className="h-4 w-4" /> },
  { id: 'heatmap', label: 'Heatmap', icon: <Grid3X3 className="h-4 w-4" /> },
]

const CHART_COLORS = [
  'var(--color-accent)',
  'var(--color-signal-green)',
  'var(--color-signal-amber)',
  'var(--color-signal-red)',
  'var(--color-financial-blue)',
  'var(--color-accent)',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
]

const SCATTER_COLORS = [
  'var(--color-financial-blue)',
  'var(--color-signal-green)',
  'var(--color-signal-amber)',
  'var(--color-signal-red)',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
  '#f97316',
  '#6366f1',
]

export function AnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') as TabId) || 'trends'

  const { data: companies } = useCompanies()
  const { data: kpiDefs } = useKpiDefinitions()
  const { data: peerGroups } = usePeerGroups()
  const { defaultYear, availableYears } = useSmartYear()

  // Shared filters — initialized from smart year
  const [fiscalYear, setFiscalYear] = useState<number | null>(null)
  const [selectedPeerGroup, setSelectedPeerGroup] = useState<string>('')

  // Trends-specific filters
  const [startYear, setStartYear] = useState<number | null>(null)
  const [endYear, setEndYear] = useState<number | null>(null)
  const [selectedKpi, setSelectedKpi] = useState<string>('')

  // Scatter-specific filters
  const [xKpi, setXKpi] = useState<string>('')
  const [yKpi, setYKpi] = useState<string>('')

  const effectiveYear = fiscalYear ?? defaultYear
  const effectiveStartYear = startYear ?? (defaultYear - 4)
  const effectiveEndYear = endYear ?? defaultYear

  // Validation: year range
  const yearRangeInvalid = effectiveStartYear > effectiveEndYear

  // Validation: scatter same KPI
  const scatterSameKpi = xKpi !== '' && yKpi !== '' && xKpi === yKpi

  const companyIds = useMemo(() => {
    if (selectedPeerGroup && peerGroups) {
      const pg = peerGroups.find((p) => p.id === selectedPeerGroup)
      return pg?.peer_group_members?.map((m) => m.company_id) ?? []
    }
    return companies?.map((c) => c.id) ?? []
  }, [selectedPeerGroup, peerGroups, companies])

  function setTab(tab: TabId) {
    setSearchParams({ tab })
  }

  return (
    <>
      <Helmet><title>Analytics - BenchmarkSignal</title></Helmet>
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">Analytics</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Explore trends, pivot tables, scatter plots, and heatmaps across your benchmark data.
          </p>
        </div>

        {/* Summary cards */}
        {companies && kpiDefs && (
          <div className="mb-6 grid grid-cols-3 gap-3">
            <div className="card-premium rounded-xl border border-border bg-card px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Companies</div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">{companyIds.length}</div>
            </div>
            <div className="card-premium rounded-xl border border-border bg-card px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">KPIs Tracked</div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">{kpiDefs.length}</div>
            </div>
            <div className="card-premium rounded-xl border border-border bg-card px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Data Range</div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                {availableYears.length > 0
                  ? `${availableYears[0]}\u2013${availableYears[availableYears.length - 1]}`
                  : '\u2014'}
              </div>
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div
          className="mb-6 flex items-center gap-1 border-b border-border pb-3"
          role="tablist"
          aria-label="Analytics views"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              aria-label={tab.label}
              id={`tab-${tab.id}`}
              onClick={() => setTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                activeTab === tab.id
                  ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                  : 'text-muted-foreground hover:bg-[var(--color-bg-tertiary)] hover:text-foreground'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          {/* Peer group filter — shared across all tabs */}
          <Select value={selectedPeerGroup} onValueChange={(v) => v && setSelectedPeerGroup(v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Companies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Companies</SelectItem>
              {(peerGroups ?? []).map((pg) => (
                <SelectItem key={pg.id} value={pg.id}>{pg.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Trends-specific: KPI selector + year range */}
          {activeTab === 'trends' && (
            <>
              <Select value={selectedKpi} onValueChange={(v) => v && setSelectedKpi(v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All KPIs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All KPIs</SelectItem>
                  {(kpiDefs ?? []).map((kpi) => (
                    <SelectItem key={kpi.code} value={kpi.code}>{kpi.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={String(effectiveStartYear)} onValueChange={(v) => setStartYear(Number(v))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.length > 0
                    ? availableYears.map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))
                    : Array.from({ length: 10 }, (_, i) => defaultYear - 9 + i).map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
              <span className="text-[13px] text-muted-foreground">to</span>
              <Select value={String(effectiveEndYear)} onValueChange={(v) => setEndYear(Number(v))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.length > 0
                    ? availableYears.map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))
                    : Array.from({ length: 10 }, (_, i) => defaultYear - 9 + i).map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
              {yearRangeInvalid && (
                <p className="w-full text-[12px] text-[var(--color-signal-red)]">
                  Start year must be less than or equal to end year.
                </p>
              )}
            </>
          )}

          {/* Pivot/Heatmap: fiscal year */}
          {(activeTab === 'pivot' || activeTab === 'heatmap') && (
            <Select value={String(effectiveYear)} onValueChange={(v) => setFiscalYear(Number(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Scatter: fiscal year + KPI selectors */}
          {activeTab === 'scatter' && (
            <>
              <Select value={String(effectiveYear)} onValueChange={(v) => setFiscalYear(Number(v))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={xKpi} onValueChange={(v) => v && setXKpi(v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="X Axis KPI..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">X Axis KPI...</SelectItem>
                  {(kpiDefs ?? []).map((kpi) => (
                    <SelectItem key={kpi.code} value={kpi.code}>{kpi.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-[13px] text-muted-foreground">vs</span>
              <Select value={yKpi} onValueChange={(v) => v && setYKpi(v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Y Axis KPI..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Y Axis KPI...</SelectItem>
                  {(kpiDefs ?? []).map((kpi) => (
                    <SelectItem key={kpi.code} value={kpi.code}>{kpi.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {scatterSameKpi && (
                <p className="w-full text-[12px] text-[var(--color-signal-red)]">
                  Select different KPIs for X and Y axes.
                </p>
              )}
            </>
          )}
        </div>

        {/* Tab panels */}
        <div
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
        >
          {activeTab === 'trends' && (
            <TrendsPanel companyIds={companyIds} startYear={effectiveStartYear} endYear={effectiveEndYear} selectedKpi={selectedKpi} disabled={yearRangeInvalid} />
          )}
          {activeTab === 'pivot' && (
            <PivotPanel companyIds={companyIds} fiscalYear={effectiveYear} />
          )}
          {activeTab === 'scatter' && (
            <ScatterPanel companyIds={companyIds} xKpi={scatterSameKpi ? '' : xKpi} yKpi={scatterSameKpi ? '' : yKpi} fiscalYear={effectiveYear} kpiDefs={kpiDefs} />
          )}
          {activeTab === 'heatmap' && (
            <HeatmapPanel companyIds={companyIds} fiscalYear={effectiveYear} />
          )}
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Trends Panel
// ---------------------------------------------------------------------------

function TrendsPanel({
  companyIds,
  startYear,
  endYear,
  selectedKpi,
  disabled,
}: {
  companyIds: string[]
  startYear: number
  endYear: number
  selectedKpi: string
  disabled?: boolean
}) {
  const kpiCodes = selectedKpi ? [selectedKpi] : undefined

  // Pass empty companyIds to disable fetching when range is invalid
  const queryCompanyIds = disabled ? [] : companyIds

  const { data: trends, isLoading } = useTrendData({
    companyIds: queryCompanyIds,
    kpiCodes,
    startYear,
    endYear,
  })

  const { data: cagrData } = useCagr({
    companyIds: queryCompanyIds,
    kpiCodes,
    startYear,
    endYear,
  })

  const { data: momentumData } = useMomentum({
    companyIds: queryCompanyIds,
    kpiCodes,
  })

  const chartData = useMemo(() => {
    if (!trends || trends.length === 0) return []
    const series = trends[0]

    const years = new Set<number>()
    const companyMap = new Map<string, Map<number, number>>()

    for (const dp of series.data_points) {
      if (dp.value === null) continue
      years.add(dp.fiscal_year)
      if (!companyMap.has(dp.company_name)) companyMap.set(dp.company_name, new Map())
      companyMap.get(dp.company_name)!.set(dp.fiscal_year, dp.value)
    }

    const sortedYears = [...years].sort()
    return sortedYears.map((year) => {
      const point: Record<string, number | string> = { year }
      for (const [name, values] of companyMap) {
        point[name] = values.get(year) ?? 0
      }
      point['Peer Median'] = series.peer_median_by_year[year] ?? 0
      return point
    })
  }, [trends])

  const companyNames = useMemo(() => {
    if (!trends || trends.length === 0) return []
    const names = new Set<string>()
    for (const dp of trends[0].data_points) {
      names.add(dp.company_name)
    }
    return [...names]
  }, [trends])

  if (disabled) {
    return (
      <div className="card-premium rounded-xl border border-border bg-card p-12 text-center">
        <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/50" />
        <p className="mt-3 text-sm text-[var(--color-signal-red)]">
          Fix the year range to view trends.
        </p>
      </div>
    )
  }

  if (isLoading) return <PageSkeleton />

  if (!trends || trends.length === 0) {
    return (
      <div className="card-premium rounded-xl border border-border bg-card p-12 text-center">
        <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/50" />
        <h3 className="mt-3 text-lg font-semibold text-foreground">No trend data</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload reports and extract KPIs to see trends over time.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 section-fade-in">
      {/* Line Chart */}
      <div className="card-premium card-accent-top rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 font-semibold text-foreground">
          {trends[0].kpi_name} — Multi-Year Trend
        </h3>
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
              {companyNames.slice(0, 8).map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
              <Line
                type="monotone"
                dataKey="Peer Median"
                stroke="var(--color-muted-foreground)"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* CAGR Table */}
      {cagrData && cagrData.length > 0 && (
        <div className="card-premium rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3">
            <h3 className="font-semibold text-foreground">
              CAGR ({startYear}–{endYear})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="table-premium w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 text-left">Company</th>
                  <th className="px-5 py-3 text-left">KPI</th>
                  <th className="px-5 py-3 text-right">{startYear}</th>
                  <th className="px-5 py-3 text-right">{endYear}</th>
                  <th className="px-5 py-3 text-right">CAGR</th>
                </tr>
              </thead>
              <tbody>
                {cagrData.slice(0, 20).map((row, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="px-5 py-3 font-medium text-foreground">{row.company_name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{row.kpi_name}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                      {row.start_value.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-foreground">
                      {row.end_value.toLocaleString()}
                    </td>
                    <td className={`px-5 py-3 text-right tabular-nums font-medium ${
                      row.cagr_pct > 0 ? 'text-[var(--color-signal-green)]' : row.cagr_pct < 0 ? 'text-[var(--color-signal-red)]' : 'text-muted-foreground'
                    }`}>
                      {row.cagr_pct > 0 ? '+' : ''}{row.cagr_pct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Momentum Indicators */}
      {momentumData && momentumData.length > 0 && (
        <div className="card-premium rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 font-semibold text-foreground">Momentum Indicators (3-Year Trailing)</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {momentumData.slice(0, 12).map((item, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
                <MomentumIcon direction={item.direction} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{item.company_name}</p>
                  <p className="text-xs text-muted-foreground">{item.kpi_name}</p>
                </div>
                <div className="text-right">
                  <MomentumBadge direction={item.direction} />
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {item.avg_yoy_change_pct > 0 ? '+' : ''}{item.avg_yoy_change_pct}% avg
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pivot Table Panel
// ---------------------------------------------------------------------------


function PivotPanel({ companyIds, fiscalYear }: { companyIds: string[]; fiscalYear: number }) {
  const { data, isLoading } = usePivotData({ companyIds, fiscalYear })

  if (isLoading) return <PageSkeleton />
  if (!data || data.cells.length === 0) {
    return (
      <div className="card-premium rounded-xl border border-border bg-card p-12 text-center">
        <Table2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm text-muted-foreground">No data available for {fiscalYear}</p>
      </div>
    )
  }

  const lookup = new Map<string, Map<string, number | null>>()
  for (const cell of data.cells) {
    if (!lookup.has(cell.company_id)) lookup.set(cell.company_id, new Map())
    lookup.get(cell.company_id)!.set(cell.kpi_code, cell.value)
  }

  const visibleKpis = data.kpis

  return (
    <div className="card-premium rounded-xl border border-border bg-card">
      <table className="table-premium w-full text-sm" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr className="border-b border-border">
            <th className="sticky left-0 bg-card px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground" style={{ width: '160px' }}>
              Company
            </th>
            {visibleKpis.map((kpi) => (
              <th key={kpi.code} className="px-2 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {shortKpiLabel(kpi.name)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.companies.map((company) => (
            <tr key={company.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
              <td className="sticky left-0 bg-card px-3 py-3 font-medium text-foreground truncate" style={{ width: '160px' }}>
                {company.name}
              </td>
              {visibleKpis.map((kpi) => {
                const val = lookup.get(company.id)?.get(kpi.code)
                return (
                  <td key={kpi.code} className="px-2 py-3 text-right tabular-nums text-foreground">
                    {val !== null && val !== undefined ? val.toLocaleString() : '\u2014'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Scatter Plot Panel
// ---------------------------------------------------------------------------

function ScatterPanel({
  companyIds,
  xKpi,
  yKpi,
  fiscalYear,
  kpiDefs,
}: {
  companyIds: string[]
  xKpi: string
  yKpi: string
  fiscalYear: number
  kpiDefs: Array<{ code: string; name: string }> | undefined
}) {
  const { data: points, isLoading } = useScatterData({ companyIds, xKpiCode: xKpi, yKpiCode: yKpi, fiscalYear })

  if (!xKpi || !yKpi) {
    return (
      <div className="card-premium rounded-xl border border-border bg-card p-12 text-center">
        <ScatterIcon className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm text-muted-foreground">Select two KPIs to plot against each other.</p>
      </div>
    )
  }

  if (isLoading) return <PageSkeleton />
  if (!points || points.length === 0) {
    return (
      <div className="card-premium rounded-xl border border-border bg-card p-12 text-center">
        <ScatterIcon className="mx-auto h-10 w-10 text-muted-foreground/50" />
        <h3 className="mt-3 text-lg font-semibold text-foreground">No data points</h3>
        <p className="mt-1 text-sm text-muted-foreground">No data points available for these KPIs in {fiscalYear}</p>
      </div>
    )
  }

  const xLabel = kpiDefs?.find((k) => k.code === xKpi)?.name ?? xKpi
  const yLabel = kpiDefs?.find((k) => k.code === yKpi)?.name ?? yKpi

  return (
    <div className="card-premium rounded-xl border border-border bg-card p-5">
      <h3 className="mb-4 font-semibold text-foreground">
        {xLabel} vs {yLabel} ({fiscalYear})
      </h3>
      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              type="number"
              dataKey="x_value"
              name={xLabel}
              stroke="var(--color-muted-foreground)"
              fontSize={11}
              label={{ value: xLabel, position: 'bottom', offset: 15, fontSize: 11, fill: 'var(--color-muted-foreground)' }}
            />
            <YAxis
              type="number"
              dataKey="y_value"
              name={yLabel}
              stroke="var(--color-muted-foreground)"
              fontSize={11}
              label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: -5, fontSize: 11, fill: 'var(--color-muted-foreground)' }}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ payload }) => {
                if (!payload?.length) return null
                const p = payload[0].payload
                return (
                  <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
                    <p className="font-medium text-foreground">{p.company_name}</p>
                    <p className="text-muted-foreground">{xLabel}: {p.x_value?.toLocaleString()}</p>
                    <p className="text-muted-foreground">{yLabel}: {p.y_value?.toLocaleString()}</p>
                  </div>
                )
              }}
            />
            <Scatter data={points} fill="var(--color-primary)">
              {points.map((_, i) => (
                <Cell key={i} fill={SCATTER_COLORS[i % SCATTER_COLORS.length]} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3">
        {points.map((p, i) => (
          <div key={p.company_id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SCATTER_COLORS[i % SCATTER_COLORS.length] }} />
            {p.company_name}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Heatmap Panel
// ---------------------------------------------------------------------------

function HeatmapPanel({ companyIds, fiscalYear }: { companyIds: string[]; fiscalYear: number }) {
  const { data, isLoading } = useHeatmapData({ companyIds, fiscalYear })

  if (isLoading) return <PageSkeleton />
  if (!data || data.cells.length === 0) {
    return (
      <div className="card-premium rounded-xl border border-border bg-card p-12 text-center">
        <Grid3X3 className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm text-muted-foreground">No data available for {fiscalYear}</p>
      </div>
    )
  }

  const lookup = new Map<string, Map<string, { value: number | null; percentile: number }>>()
  for (const cell of data.cells) {
    if (!lookup.has(cell.company_id)) lookup.set(cell.company_id, new Map())
    lookup.get(cell.company_id)!.set(cell.kpi_code, { value: cell.value, percentile: cell.percentile })
  }

  const visibleKpis = data.kpis

  return (
    <div className="space-y-4">
      <div className="card-premium rounded-xl border border-border bg-card">
        <table className="table-premium w-full text-sm" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 bg-card px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground" style={{ width: '160px' }}>
                Company
              </th>
              {visibleKpis.map((kpi) => (
                <th key={kpi.code} className="px-1 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {shortKpiLabel(kpi.name)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.companies.map((company) => (
              <tr key={company.id} className="border-b border-border/50 last:border-0">
                <td className="sticky left-0 bg-card px-3 py-3 font-medium text-foreground truncate" style={{ width: '160px' }}>
                  {company.name}
                </td>
                {visibleKpis.map((kpi) => {
                  const cell = lookup.get(company.id)?.get(kpi.code)
                  if (!cell || cell.value === null) {
                    return <td key={kpi.code} className="px-1 py-2 text-center text-muted-foreground">{'\u2014'}</td>
                  }
                  return (
                    <td key={kpi.code} className="px-1 py-2 text-center">
                      <div
                        className="mx-auto flex h-9 items-center justify-center rounded-md text-[11px] font-medium tabular-nums"
                        style={{
                          backgroundColor: getHeatColor(cell.percentile),
                          color: 'var(--color-foreground)',
                        }}
                        title={`P${cell.percentile} \u2014 ${cell.value.toLocaleString()}`}
                      >
                        {cell.value.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 } as Intl.NumberFormatOptions)}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
        <span>Weak (P0)</span>
        <div className="flex h-4">
          {[0, 20, 40, 60, 80, 100].map((p) => (
            <div key={p} className="h-full w-8" style={{ backgroundColor: getHeatColor(p) }} />
          ))}
        </div>
        <span>Strong (P100)</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHeatColor(percentile: number): string {
  if (percentile >= 80) return 'var(--color-signal-green)'
  if (percentile >= 60) return 'var(--color-signal-green)'
  if (percentile >= 40) return 'var(--color-muted-foreground)'
  if (percentile >= 20) return 'var(--color-signal-red)'
  return 'var(--color-signal-red)'
}

function MomentumIcon({ direction }: { direction: string }) {
  if (direction === 'improving') return <TrendingUp className="h-5 w-5 text-[var(--color-signal-green)]" />
  if (direction === 'declining') return <TrendingDown className="h-5 w-5 text-[var(--color-signal-red)]" />
  return <Minus className="h-5 w-5 text-muted-foreground" />
}

function MomentumBadge({ direction }: { direction: string }) {
  if (direction === 'improving') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-signal-green)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--color-signal-green)]"><TrendingUp className="h-3 w-3" /> Improving</span>
  }
  if (direction === 'declining') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-signal-red)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--color-signal-red)]"><TrendingDown className="h-3 w-3" /> Declining</span>
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">● Stable</span>
}
