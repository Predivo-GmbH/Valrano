import { useState, useMemo, useRef, useEffect, type ReactNode } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { shortKpiLabel } from '@/lib/kpi-labels'
import { cn } from '@/lib/utils'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Table2,
  ScatterChart as ScatterIcon,
  Grid3X3,
} from 'lucide-react'
import { CompanyLogo } from '@/components/ui/company-logo'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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

// ---------------------------------------------------------------------------
// Scroll-fade wrapper — shows right gradient when table overflows
// ---------------------------------------------------------------------------

function ScrollFadeWrapper({ children, className }: { children: React.ReactNode; className?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showRightFade, setShowRightFade] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const check = () => {
      setShowRightFade(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
    }
    check()
    el.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => {
      el.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
    }
  }, [children])

  return (
    <div className={cn('relative', className)}>
      <div ref={scrollRef} className="overflow-x-auto scrollbar-thin">
        {children}
      </div>
      {showRightFade && (
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card to-transparent" />
      )}
    </div>
  )
}

type TabId = 'trends' | 'pivot' | 'scatter' | 'heatmap'

const TABS: { id: TabId; label: string; shortLabel: string; icon: ReactNode }[] = [
  { id: 'trends', label: 'Trends', shortLabel: 'Trends', icon: <BarChart3 className="h-4 w-4" aria-hidden="true" /> },
  { id: 'pivot', label: 'Pivot Table', shortLabel: 'Pivot', icon: <Table2 className="h-4 w-4" aria-hidden="true" /> },
  { id: 'scatter', label: 'Scatter', shortLabel: 'Scatter', icon: <ScatterIcon className="h-4 w-4" aria-hidden="true" /> },
  { id: 'heatmap', label: 'Heatmap', shortLabel: 'Heat', icon: <Grid3X3 className="h-4 w-4" aria-hidden="true" /> },
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
      <Helmet><title>Analytics - Valrano</title><meta name="robots" content="noindex" /></Helmet>
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">Analytics</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Explore trends, pivot tables, scatter plots, and heatmaps across your benchmark data.
          </p>
        </div>

        {/* Summary cards */}
        {companies && kpiDefs && (
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
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
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                activeTab === tab.id
                  ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                  : 'text-muted-foreground hover:bg-[var(--color-bg-tertiary)] hover:text-foreground'
              }`}
            >
              {tab.icon}
              <span className="sm:hidden">{tab.shortLabel}</span><span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          {/* Peer group filter — shared across all tabs */}
          <Select value={selectedPeerGroup} onValueChange={(v) => setSelectedPeerGroup(v ?? '')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Companies">{selectedPeerGroup ? (peerGroups ?? []).find((pg) => pg.id === selectedPeerGroup)?.name ?? 'All Companies' : 'All Companies'}</SelectValue>
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
                  <SelectValue placeholder="All KPIs">{selectedKpi ? (kpiDefs ?? []).find((k) => k.code === selectedKpi)?.name ?? 'All KPIs' : 'All KPIs'}</SelectValue>
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
                  <SelectValue placeholder="X Axis KPI...">{xKpi ? (kpiDefs ?? []).find((k) => k.code === xKpi)?.name ?? 'X Axis KPI...' : 'X Axis KPI...'}</SelectValue>
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
                  <SelectValue placeholder="Y Axis KPI...">{yKpi ? (kpiDefs ?? []).find((k) => k.code === yKpi)?.name ?? 'Y Axis KPI...' : 'Y Axis KPI...'}</SelectValue>
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
      <Card className="card-premium">
        <CardContent className="p-12 text-center">
          <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-[var(--color-signal-red)]">
            Fix the year range to view trends.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) return <PageSkeleton />

  if (!trends || trends.length === 0) {
    return (
      <Card className="card-premium">
        <CardContent className="p-12 text-center">
          <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <h3 className="mt-3 text-lg font-semibold text-foreground">No trend data</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload reports and extract KPIs to see trends over time.
          </p>
        </CardContent>
      </Card>
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
          <ScrollFadeWrapper>
            <table className="table-premium w-full text-sm" aria-label="Compound annual growth rate">
              <thead>
                <tr className="border-b border-border text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th scope="col" className="px-5 py-3 text-left">Company</th>
                  <th scope="col" className="px-5 py-3 text-left">KPI</th>
                  <th scope="col" className="px-5 py-3 text-right">{startYear}</th>
                  <th scope="col" className="px-5 py-3 text-right">{endYear}</th>
                  <th scope="col" className="px-5 py-3 text-right">CAGR</th>
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
          </ScrollFadeWrapper>
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
  const { data: allCompanies } = useCompanies()

  if (isLoading) return <PageSkeleton />
  if (!data || data.cells.length === 0) {
    return (
      <div className="card-premium rounded-xl border border-border bg-card p-12 text-center">
        <Table2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <h3 className="mt-3 text-lg font-semibold text-foreground">No comparison data</h3>
        <p className="mt-1 text-sm text-muted-foreground">No data available for {fiscalYear}</p>
        <Link to="/competitors" className="mt-3 inline-flex items-center gap-1.5 text-sm text-[var(--color-accent)] hover:underline">
          Upload reports to populate data
        </Link>
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
    <ScrollFadeWrapper className="card-premium rounded-xl border border-border bg-card">
      <table className="table-premium w-full text-sm" style={{ tableLayout: 'fixed' }} aria-label="Peer comparison heatmap">
        <thead>
          <tr className="border-b border-border bg-[var(--color-bg-tertiary)]">
            <th scope="col" className="sticky left-0 z-10 bg-[var(--color-bg-tertiary)] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground" style={{ width: '180px' }}>
              Company
            </th>
            {visibleKpis.map((kpi) => (
              <th scope="col" key={kpi.code} className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                <TooltipProvider delay={200}>
                  <UiTooltip>
                    <TooltipTrigger className="cursor-help">
                      {shortKpiLabel(kpi.name)}
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="text-xs font-medium">{kpi.name}</p>
                    </TooltipContent>
                  </UiTooltip>
                </TooltipProvider>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.companies.map((company, idx) => (
            <tr
              key={company.id}
              className={cn(
                'border-b border-border/50 last:border-0 transition-colors hover:bg-[var(--color-accent)]/5',
                idx % 2 === 1 && 'bg-[var(--color-bg-tertiary)]/30',
              )}
            >
              <td className="sticky left-0 z-10 bg-card px-4 py-3" style={{ width: '180px' }}>
                {(() => { const full = allCompanies?.find(c => c.id === company.id); return (
                <Link to={`/companies/${company.id}`} className="flex items-center gap-2 group min-w-0">
                  <CompanyLogo logoUrl={full?.logo_url} websiteUrl={full?.website_url} name={company.name} size="xs" />
                  <span className="font-medium text-foreground truncate group-hover:text-[var(--color-accent)] transition-colors">
                    {company.name}
                  </span>
                </Link>
                ) })()}
              </td>
              {visibleKpis.map((kpi) => {
                const val = lookup.get(company.id)?.get(kpi.code)
                return (
                  <td key={kpi.code} className="px-3 py-3 text-right tabular-nums text-foreground">
                    {val !== null && val !== undefined
                      ? val.toLocaleString(undefined, { maximumFractionDigits: 1 })
                      : <span className="text-muted-foreground/50">—</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollFadeWrapper>
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
  const { data: allCompanies } = useCompanies()

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
        <Link to="/competitors" className="mt-3 inline-flex items-center gap-1.5 text-sm text-[var(--color-accent)] hover:underline">
          Upload reports to populate data
        </Link>
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
        {points.map((p, i) => {
          const full = allCompanies?.find(c => c.id === p.company_id)
          return (
            <div key={p.company_id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: SCATTER_COLORS[i % SCATTER_COLORS.length] }} />
              <CompanyLogo logoUrl={full?.logo_url} websiteUrl={full?.website_url} name={p.company_name} size="xs" />
              {p.company_name}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Heatmap Panel
// ---------------------------------------------------------------------------

function HeatmapPanel({ companyIds, fiscalYear }: { companyIds: string[]; fiscalYear: number }) {
  const { data, isLoading } = useHeatmapData({ companyIds, fiscalYear })
  const { data: allCompanies } = useCompanies()

  if (isLoading) return <PageSkeleton />
  if (!data || data.cells.length === 0) {
    return (
      <div className="card-premium rounded-xl border border-border bg-card p-12 text-center">
        <Grid3X3 className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <h3 className="mt-3 text-lg font-semibold text-foreground">No heatmap data</h3>
        <p className="mt-1 text-sm text-muted-foreground">No data available for {fiscalYear}</p>
        <Link to="/competitors" className="mt-3 inline-flex items-center gap-1.5 text-sm text-[var(--color-accent)] hover:underline">
          Upload reports to populate data
        </Link>
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
      <ScrollFadeWrapper className="card-premium rounded-xl border border-border bg-card">
        <table className="table-premium w-full text-sm" style={{ tableLayout: 'fixed' }} aria-label="Percentile ranking">
          <thead>
            <tr className="border-b border-border bg-[var(--color-bg-tertiary)]">
              <th scope="col" className="sticky left-0 z-10 bg-[var(--color-bg-tertiary)] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground" style={{ width: '180px' }}>
                Company
              </th>
              {visibleKpis.map((kpi) => (
                <th scope="col" key={kpi.code} className="px-1 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                  <TooltipProvider delay={200}>
                    <UiTooltip>
                      <TooltipTrigger className="cursor-help">
                        {shortKpiLabel(kpi.name)}
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs font-medium">{kpi.name}</p>
                        </TooltipContent>
                    </UiTooltip>
                  </TooltipProvider>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.companies.map((company) => {
              const full = allCompanies?.find(c => c.id === company.id)
              return (
              <tr key={company.id} className="border-b border-border/50 last:border-0">
                <td className="sticky left-0 z-10 bg-card px-4 py-3" style={{ width: '180px' }}>
                  <Link to={`/companies/${company.id}`} className="flex items-center gap-2 group min-w-0">
                    <CompanyLogo logoUrl={full?.logo_url} websiteUrl={full?.website_url} name={company.name} size="xs" />
                    <span className="font-medium text-foreground truncate group-hover:text-[var(--color-accent)] transition-colors">
                      {company.name}
                    </span>
                  </Link>
                </td>
                {visibleKpis.map((kpi) => {
                  const cell = lookup.get(company.id)?.get(kpi.code)
                  if (!cell || cell.value === null) {
                    return <td key={kpi.code} className="px-1 py-2 text-center text-muted-foreground/50">—</td>
                  }
                  return (
                    <td key={kpi.code} className="px-1 py-2 text-center">
                      <TooltipProvider delay={100}>
                        <UiTooltip>
                          <TooltipTrigger
                              className="mx-auto flex h-9 items-center justify-center rounded-lg text-[11px] font-semibold tabular-nums cursor-default border border-transparent hover:border-[var(--color-accent)]/30 transition-colors"
                              style={{
                                backgroundColor: getHeatColor(cell.percentile),
                                color: getHeatTextColor(cell.percentile),
                              }}
                            >
                              {cell.value.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 } as Intl.NumberFormatOptions)}
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-xs font-medium">{kpi.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Value: {cell.value.toLocaleString()} · Percentile: P{cell.percentile}
                            </p>
                          </TooltipContent>
                        </UiTooltip>
                      </TooltipProvider>
                    </td>
                  )
                })}
              </tr>
              )
            })}
          </tbody>
        </table>
      </ScrollFadeWrapper>

      {/* Legend — smooth gradient bar */}
      <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
        <span className="text-[var(--color-signal-red)]">Weak (P0)</span>
        <div className="flex h-3 rounded-full overflow-hidden border border-border/50">
          <div className="w-10" style={{ backgroundColor: 'rgba(239, 68, 68, 0.25)' }} />
          <div className="w-10" style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)' }} />
          <div className="w-10" style={{ backgroundColor: 'rgba(156, 163, 175, 0.10)' }} />
          <div className="w-10" style={{ backgroundColor: 'rgba(34, 197, 94, 0.12)' }} />
          <div className="w-10" style={{ backgroundColor: 'rgba(34, 197, 94, 0.25)' }} />
        </div>
        <span className="text-[var(--color-signal-green)]">Strong (P100)</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHeatColor(percentile: number): string {
  // Smooth gradient: red → amber → neutral → green
  if (percentile >= 80) return 'rgba(34, 197, 94, 0.25)' // green
  if (percentile >= 60) return 'rgba(34, 197, 94, 0.12)' // light green
  if (percentile >= 40) return 'rgba(156, 163, 175, 0.10)' // neutral gray
  if (percentile >= 20) return 'rgba(239, 68, 68, 0.12)' // light red
  return 'rgba(239, 68, 68, 0.25)' // red
}

function getHeatTextColor(percentile: number): string {
  if (percentile >= 60) return 'var(--color-signal-green)'
  if (percentile >= 40) return 'var(--color-foreground)'
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
