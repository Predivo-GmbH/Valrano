import { useState, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useTrendData, useCagr, useMomentum } from '@/hooks/useTrends'
import { useCompanies, useKpiDefinitions } from '@/hooks/useData'
import { usePeerGroups } from '@/hooks/useData'
import { PageSkeleton } from '@/components/ui/page-skeleton'

const CHART_COLORS = [
  'var(--color-primary)',
  'var(--color-signal-green)',
  'var(--color-signal-amber)',
  'var(--color-signal-red)',
  'var(--color-financial-blue)',
  'var(--color-accent)',
  '#8B5CF6',  // purple - no token, keep hardcoded
  '#EC4899',  // pink - no token, keep hardcoded
  '#14B8A6',  // teal - no token, keep hardcoded
  '#F97316',  // orange - no token, keep hardcoded
]

export function TrendsPage() {
  const { data: companies } = useCompanies()
  const { data: kpiDefs } = useKpiDefinitions()
  const { data: peerGroups } = usePeerGroups()

  const currentYear = new Date().getFullYear() - 1
  const [startYear, setStartYear] = useState(currentYear - 4)
  const [endYear, setEndYear] = useState(currentYear)
  const [selectedKpi, setSelectedKpi] = useState<string>('')
  const [selectedPeerGroup, setSelectedPeerGroup] = useState<string>('')

  // Get company IDs from selected peer group or all
  const companyIds = useMemo(() => {
    if (selectedPeerGroup && peerGroups) {
      const pg = peerGroups.find((p) => p.id === selectedPeerGroup)
      return pg?.peer_group_members?.map((m) => m.company_id) ?? []
    }
    return companies?.map((c) => c.id) ?? []
  }, [selectedPeerGroup, peerGroups, companies])

  const kpiCodes = selectedKpi ? [selectedKpi] : undefined

  const { data: trends, isLoading } = useTrendData({
    companyIds,
    kpiCodes,
    startYear,
    endYear,
  })

  const { data: cagrData } = useCagr({
    companyIds,
    kpiCodes,
    startYear,
    endYear,
  })

  const { data: momentumData } = useMomentum({
    companyIds,
    kpiCodes,
  })

  // Transform trend data for recharts
  const chartData = useMemo(() => {
    if (!trends || trends.length === 0) return []
    const series = trends[0] // Show first KPI

    // Build year → company values map
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

  return (
    <>
      <Helmet><title>Trends - BenchmarkSignal</title></Helmet>
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">Trends & Time-Series</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Track KPI performance over time with growth rates and momentum indicators.
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
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

          <Select value={String(startYear)} onValueChange={(v) => setStartYear(Number(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 10 }, (_, i) => currentYear - 9 + i).map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-[13px] text-muted-foreground">to</span>
          <Select value={String(endYear)} onValueChange={(v) => setEndYear(Number(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 10 }, (_, i) => currentYear - 9 + i).map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <PageSkeleton />
        ) : !trends || trends.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <h3 className="mt-3 text-lg font-semibold text-foreground">No trend data</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload reports and extract KPIs to see trends over time.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Line Chart */}
            <div className="rounded-xl border border-border bg-card p-5">
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
              <div className="rounded-xl border border-border bg-card">
                <div className="border-b border-border px-5 py-3">
                  <h3 className="font-semibold text-foreground">
                    CAGR ({startYear}–{endYear})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
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
              <div className="rounded-xl border border-border bg-card p-5">
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
        )}
      </div>
    </>
  )
}

function MomentumIcon({ direction }: { direction: string }) {
  if (direction === 'improving') return <TrendingUp className="h-5 w-5 text-[var(--color-signal-green)]" />
  if (direction === 'declining') return <TrendingDown className="h-5 w-5 text-[var(--color-signal-red)]" />
  return <Minus className="h-5 w-5 text-muted-foreground" />
}

function MomentumBadge({ direction }: { direction: string }) {
  if (direction === 'improving') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-signal-green)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--color-signal-green)]">▲ Improving</span>
  }
  if (direction === 'declining') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-signal-red)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--color-signal-red)]">▼ Declining</span>
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">● Stable</span>
}
