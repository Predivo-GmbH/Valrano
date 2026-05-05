import { useState, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import { Table2, ScatterChart as ScatterIcon, Grid3X3 } from 'lucide-react'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { usePivotData, useScatterData, useHeatmapData } from '@/hooks/useAnalytics'
import { useCompanies, useKpiDefinitions, usePeerGroups } from '@/hooks/useData'

type ViewMode = 'pivot' | 'scatter' | 'heatmap'

const SCATTER_COLORS = [
  '#3B82F6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
]

export function AnalyticsPage() {
  const { data: companies } = useCompanies()
  const { data: kpiDefs } = useKpiDefinitions()
  const { data: peerGroups } = usePeerGroups()

  const currentYear = new Date().getFullYear() - 1
  const [viewMode, setViewMode] = useState<ViewMode>('pivot')
  const [fiscalYear, setFiscalYear] = useState(currentYear)
  const [selectedPeerGroup, setSelectedPeerGroup] = useState<string>('')
  const [xKpi, setXKpi] = useState<string>('')
  const [yKpi, setYKpi] = useState<string>('')

  const companyIds = useMemo(() => {
    if (selectedPeerGroup && peerGroups) {
      const pg = peerGroups.find((p) => p.id === selectedPeerGroup)
      return pg?.peer_group_members?.map((m) => m.company_id) ?? []
    }
    return companies?.map((c) => c.id) ?? []
  }, [selectedPeerGroup, peerGroups, companies])

  return (
    <>
      <Helmet><title>Analytics - BenchmarkSignal</title></Helmet>
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Explore data with pivot tables, scatter plots, and heatmaps.
          </p>
        </div>

        {/* View mode tabs */}
        <div className="mb-6 flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          <ViewTab active={viewMode === 'pivot'} onClick={() => setViewMode('pivot')} icon={<Table2 className="h-4 w-4" />} label="Pivot Table" />
          <ViewTab active={viewMode === 'scatter'} onClick={() => setViewMode('scatter')} icon={<ScatterIcon className="h-4 w-4" />} label="Scatter Plot" />
          <ViewTab active={viewMode === 'heatmap'} onClick={() => setViewMode('heatmap')} icon={<Grid3X3 className="h-4 w-4" />} label="Heatmap" />
        </div>

        {/* Common filters */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <select
            value={fiscalYear}
            onChange={(e) => setFiscalYear(Number(e.target.value))}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            {Array.from({ length: 5 }, (_, i) => currentYear - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <select
            value={selectedPeerGroup}
            onChange={(e) => setSelectedPeerGroup(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="">All Companies</option>
            {(peerGroups ?? []).map((pg) => (
              <option key={pg.id} value={pg.id}>{pg.name}</option>
            ))}
          </select>

          {viewMode === 'scatter' && (
            <>
              <select
                value={xKpi}
                onChange={(e) => setXKpi(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">X Axis KPI...</option>
                {(kpiDefs ?? []).map((kpi) => (
                  <option key={kpi.code} value={kpi.code}>{kpi.name}</option>
                ))}
              </select>
              <span className="text-sm text-muted-foreground">vs</span>
              <select
                value={yKpi}
                onChange={(e) => setYKpi(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">Y Axis KPI...</option>
                {(kpiDefs ?? []).map((kpi) => (
                  <option key={kpi.code} value={kpi.code}>{kpi.name}</option>
                ))}
              </select>
            </>
          )}
        </div>

        {/* Content */}
        {viewMode === 'pivot' && <PivotView companyIds={companyIds} fiscalYear={fiscalYear} />}
        {viewMode === 'scatter' && <ScatterView companyIds={companyIds} xKpi={xKpi} yKpi={yKpi} fiscalYear={fiscalYear} kpiDefs={kpiDefs} />}
        {viewMode === 'heatmap' && <HeatmapView companyIds={companyIds} fiscalYear={fiscalYear} />}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// View Tab
// ---------------------------------------------------------------------------

function ViewTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-[var(--color-primary)] text-white'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Pivot Table View
// ---------------------------------------------------------------------------

function PivotView({ companyIds, fiscalYear }: { companyIds: string[]; fiscalYear: number }) {
  const { data, isLoading } = usePivotData({ companyIds, fiscalYear })

  if (isLoading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>
  if (!data || data.cells.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <Table2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm text-muted-foreground">No data available for {fiscalYear}</p>
      </div>
    )
  }

  // Build lookup: company_id -> kpi_code -> value
  const lookup = new Map<string, Map<string, number | null>>()
  for (const cell of data.cells) {
    if (!lookup.has(cell.company_id)) lookup.set(cell.company_id, new Map())
    lookup.get(cell.company_id)!.set(cell.kpi_code, cell.value)
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="sticky left-0 bg-card px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Company
            </th>
            {data.kpis.map((kpi) => (
              <th key={kpi.code} className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                {kpi.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.companies.map((company) => (
            <tr key={company.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
              <td className="sticky left-0 bg-card px-4 py-3 font-medium text-foreground whitespace-nowrap">
                {company.name}
              </td>
              {data.kpis.map((kpi) => {
                const val = lookup.get(company.id)?.get(kpi.code)
                return (
                  <td key={kpi.code} className="px-4 py-3 text-right tabular-nums text-foreground">
                    {val !== null && val !== undefined ? val.toLocaleString() : '—'}
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
// Scatter Plot View
// ---------------------------------------------------------------------------

function ScatterView({
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
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <ScatterIcon className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm text-muted-foreground">Select two KPIs to plot against each other.</p>
      </div>
    )
  }

  if (isLoading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>
  if (!points || points.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <p className="text-sm text-muted-foreground">No data points available for these KPIs in {fiscalYear}</p>
      </div>
    )
  }

  const xLabel = kpiDefs?.find((k) => k.code === xKpi)?.name ?? xKpi
  const yLabel = kpiDefs?.find((k) => k.code === yKpi)?.name ?? yKpi

  return (
    <div className="rounded-xl border border-border bg-card p-5">
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
// Heatmap View
// ---------------------------------------------------------------------------

function HeatmapView({ companyIds, fiscalYear }: { companyIds: string[]; fiscalYear: number }) {
  const { data, isLoading } = useHeatmapData({ companyIds, fiscalYear })

  if (isLoading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>
  if (!data || data.cells.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <Grid3X3 className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm text-muted-foreground">No data available for {fiscalYear}</p>
      </div>
    )
  }

  // Build lookup: company_id -> kpi_code -> { value, percentile }
  const lookup = new Map<string, Map<string, { value: number | null; percentile: number }>>()
  for (const cell of data.cells) {
    if (!lookup.has(cell.company_id)) lookup.set(cell.company_id, new Map())
    lookup.get(cell.company_id)!.set(cell.kpi_code, { value: cell.value, percentile: cell.percentile })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 bg-card px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Company
              </th>
              {data.kpis.map((kpi) => (
                <th key={kpi.code} className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  {kpi.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.companies.map((company) => (
              <tr key={company.id} className="border-b border-border/50 last:border-0">
                <td className="sticky left-0 bg-card px-4 py-3 font-medium text-foreground whitespace-nowrap">
                  {company.name}
                </td>
                {data.kpis.map((kpi) => {
                  const cell = lookup.get(company.id)?.get(kpi.code)
                  if (!cell || cell.value === null) {
                    return <td key={kpi.code} className="px-4 py-3 text-center text-muted-foreground">—</td>
                  }
                  return (
                    <td key={kpi.code} className="px-2 py-2 text-center">
                      <div
                        className="mx-auto flex h-10 w-full max-w-[80px] items-center justify-center rounded-md text-xs font-medium"
                        style={{
                          backgroundColor: getHeatColor(cell.percentile),
                          color: cell.percentile > 60 || cell.percentile < 40 ? 'white' : 'var(--color-foreground)',
                        }}
                        title={`P${cell.percentile} — ${cell.value.toLocaleString()}`}
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
      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
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

function getHeatColor(percentile: number): string {
  if (percentile >= 80) return '#059669' // green-600
  if (percentile >= 60) return '#34d399' // green-400
  if (percentile >= 40) return '#6b7280' // gray-500
  if (percentile >= 20) return '#f87171' // red-400
  return '#dc2626' // red-600
}
