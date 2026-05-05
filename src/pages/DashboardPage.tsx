import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useCompanies, useKpiDefinitions, useKpiValues, useReports } from '@/hooks/useData'
import { usePrimaryCompany, useMyCompanyKpis } from '@/hooks/useMyCompany'
import { usePublicationEvents } from '@/hooks/useCalendar'
import { useSmartYear } from '@/hooks/useSmartYear'
import type { Company, KpiDefinition, KpiValue, KpiCategory } from '@/types/database'
import { formatKpiValue } from '@/lib/format'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Upload,
  Building2,
  Users,
  BarChart3,
  TrendingUp,
  Clock,
  AlertCircle,
  Activity,
  FileText,
  CalendarCheck,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type KpiValueWithJoins = KpiValue & {
  kpi_definitions: KpiDefinition
  companies: Company
}

type ActiveCategory = KpiCategory | 'all'

// ---------------------------------------------------------------------------
// Signal coloring — compares a company's value against peer min/max
// ---------------------------------------------------------------------------

function getSignalClass(
  value: number | null,
  values: (number | null)[],
  higherIsBetter: boolean,
): string {
  if (value === null) return 'text-muted-foreground'
  const nums = values.filter((v): v is number => v !== null)
  if (nums.length < 2) return 'text-foreground'
  const max = Math.max(...nums)
  const min = Math.min(...nums)
  if (higherIsBetter) {
    if (value === max) return 'text-[var(--color-signal-green)] font-semibold'
    if (value === min) return 'text-[var(--color-signal-red)]'
  } else {
    if (value === min) return 'text-[var(--color-signal-green)] font-semibold'
    if (value === max) return 'text-[var(--color-signal-red)]'
  }
  return 'text-foreground'
}

// KPIs where lower value is better (costs, emissions, etc.)
const LOWER_IS_BETTER_CODES = new Set([
  'co2_emissions',
  'co2_intensity',
  'energy_intensity',
  'water_intensity',
  'net_debt',
  'debt_to_equity',
])

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function getRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  const diffWeeks = Math.floor(diffDays / 7)
  if (diffWeeks < 5) return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`
  return `${Math.floor(diffMonths / 12)}y ago`
}

function computePercentile(myValue: number, peerValues: number[]): number {
  const allValues = [...peerValues, myValue].sort((a, b) => a - b)
  const rank = allValues.indexOf(myValue)
  return Math.round((rank / (allValues.length - 1)) * 100)
}

// ---------------------------------------------------------------------------
// Empty states — differentiated by setup progress
// ---------------------------------------------------------------------------

function SetupGuidanceState({
  hasCompany,
  hasPeers,
}: {
  hasCompany: boolean
  hasPeers: boolean
}) {
  // Determine the first missing step
  if (!hasCompany) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <div className="mb-4 rounded-full bg-[var(--color-bg-tertiary)] p-4">
          <Building2 className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mb-2 text-[15px] font-semibold text-foreground">Set up your company profile first</h3>
        <p className="mb-6 text-[13px] text-muted-foreground max-w-sm">
          Add your company details so we know who to benchmark against your peers.
        </p>
        <Link
          to="/my-company"
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-[13px] font-medium text-background transition-all duration-200 hover:opacity-90"
        >
          <Building2 className="h-4 w-4" />
          Set Up Company
        </Link>
      </div>
    )
  }

  if (!hasPeers) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <div className="mb-4 rounded-full bg-[var(--color-bg-tertiary)] p-4">
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mb-2 text-[15px] font-semibold text-foreground">Add competitors to start benchmarking</h3>
        <p className="mb-6 text-[13px] text-muted-foreground max-w-sm">
          Add peer companies and upload their annual reports to see how you compare.
        </p>
        <Link
          to="/peers"
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-[13px] font-medium text-background transition-all duration-200 hover:opacity-90"
        >
          <Users className="h-4 w-4" />
          Add Peers
        </Link>
      </div>
    )
  }

  // Has company and peers but no KPI data
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="mb-4 rounded-full bg-[var(--color-bg-tertiary)] p-4">
        <BarChart3 className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-[15px] font-semibold text-foreground">Enter your KPIs to compare against peers</h3>
      <p className="mb-6 text-[13px] text-muted-foreground max-w-sm">
        Upload an annual report or enter KPI values manually so we can generate your benchmark position.
      </p>
      <Link
        to="/upload"
        className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-[13px] font-medium text-background transition-all duration-200 hover:opacity-90"
      >
        <Upload className="h-4 w-4" />
        Upload a Report
      </Link>
    </div>
  )
}

function FilteredEmptyState({ fiscalYear, onClearYear, availableYears }: {
  fiscalYear: number
  onClearYear: (year: number) => void
  availableYears: number[]
}) {
  const latestYear = availableYears[0] ?? fiscalYear
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="mb-4 rounded-full bg-[var(--color-bg-tertiary)] p-4">
        <Upload className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-[15px] font-semibold text-foreground">No results for FY {fiscalYear}</h3>
      <p className="mb-6 text-[13px] text-muted-foreground max-w-sm">
        No data available for this fiscal year. Try a different year or upload a report.
      </p>
      <div className="flex items-center gap-3">
        {latestYear !== fiscalYear && (
          <button
            onClick={() => onClearYear(latestYear)}
            className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-[13px] font-medium text-foreground transition-all duration-200 hover:bg-[var(--color-bg-tertiary)]"
          >
            Switch to FY {latestYear}
          </button>
        )}
        <Link
          to="/upload"
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-[13px] font-medium text-background transition-all duration-200 hover:opacity-90"
        >
          <Upload className="h-4 w-4" />
          Upload a Report
        </Link>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-px">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-[61px] bg-[var(--color-bg-tertiary)] rounded" />
      ))}
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-card p-5">
      <div className="h-4 w-16 bg-[var(--color-bg-tertiary)] rounded mb-3" />
      <div className="h-7 w-12 bg-[var(--color-bg-tertiary)] rounded mb-2" />
      <div className="h-3 w-24 bg-[var(--color-bg-tertiary)] rounded" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// KPI value cell
// ---------------------------------------------------------------------------

interface KpiCellProps {
  value: KpiValueWithJoins | undefined
  signalClass: string
  unitType: string
}

function KpiCell({ value, signalClass, unitType }: KpiCellProps) {
  if (!value) {
    return (
      <td className="px-6 py-5 text-[13px] text-muted-foreground/40 tabular-nums text-right">
        —
      </td>
    )
  }

  const formatted = formatKpiValue(value.normalized_value, unitType)
  const rawLabel = value.raw_currency && value.raw_value !== null
    ? `${value.raw_currency} ${formatKpiValue(value.raw_value, unitType)}`
    : null
  const sourcePage = value.source_page ? `p.${value.source_page}` : null

  return (
    <td className="px-6 py-5 text-right">
      <Tooltip>
        <TooltipTrigger
          className={`cursor-default bg-transparent border-none p-0 text-[13px] tabular-nums transition-colors duration-200 ${signalClass}`}
        >
          {formatted}
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs rounded-lg border border-border bg-[var(--color-bg-elevated)] px-3 py-2 text-[11px] text-foreground shadow-none"
        >
          <div className="space-y-1">
            {rawLabel && (
              <div className="text-muted-foreground">
                Original: <span className="text-foreground font-medium">{rawLabel}</span>
              </div>
            )}
            {sourcePage && (
              <div className="text-muted-foreground">
                Source: <span className="text-foreground font-medium">{sourcePage}</span>
              </div>
            )}
            {value.source_text && (
              <div className="text-muted-foreground border-t border-border pt-1 mt-1 leading-relaxed">
                "{value.source_text.slice(0, 120)}{value.source_text.length > 120 ? '...' : ''}"
              </div>
            )}
            {value.needs_review && (
              <div className="text-[var(--color-signal-amber)] font-medium">Needs review</div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </td>
  )
}

// ---------------------------------------------------------------------------
// Summary Metric Card
// ---------------------------------------------------------------------------

interface MetricCardProps {
  icon: React.ReactNode
  label: string
  value: string
  subtitle: string
  accentColor: string
}

function MetricCard({ icon, label, value, subtitle, accentColor }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-1">
      <div className="flex items-center gap-2 mb-1">
        <div className={`flex items-center justify-center h-7 w-7 rounded-lg ${accentColor}`}>
          {icon}
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="text-[24px] font-bold leading-tight text-foreground tabular-nums">
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground">
        {subtitle}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Performance Snapshot - KPI strip card
// ---------------------------------------------------------------------------

interface KpiSnapshotProps {
  name: string
  value: number
  unitType: string
  percentile: number
}

function KpiSnapshotCard({ name, value, unitType, percentile }: KpiSnapshotProps) {
  const barColor =
    percentile >= 66
      ? 'bg-[var(--color-signal-green)]'
      : percentile >= 33
      ? 'bg-[var(--color-signal-amber)]'
      : 'bg-[var(--color-signal-red)]'

  return (
    <div className="rounded-xl border border-border bg-card p-4 min-w-[180px] flex-1">
      <div className="text-[11px] text-muted-foreground font-medium mb-1 truncate">{name}</div>
      <div className="text-[15px] font-semibold text-foreground tabular-nums mb-2">
        {formatKpiValue(value, unitType)}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${percentile}%` }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">P{percentile}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Activity feed item
// ---------------------------------------------------------------------------

interface ActivityItemProps {
  icon: React.ReactNode
  description: string
  time: string
}

function ActivityItem({ icon, description, time }: ActivityItemProps) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-[var(--color-bg-tertiary)] flex items-center justify-center">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-foreground truncate">{description}</p>
      </div>
      <span className="text-[11px] text-muted-foreground whitespace-nowrap">{time}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main dashboard page
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<KpiCategory, string> = {
  financial: 'Financial',
  esg: 'ESG',
  operational: 'Operational',
}

export function DashboardPage() {
  const { defaultYear, availableYears, isLoading: yearLoading } = useSmartYear()
  const [fiscalYear, setFiscalYear] = useState<number | null>(null)
  const [activeCategory, setActiveCategory] = useState<ActiveCategory>('financial')

  const effectiveYear = fiscalYear ?? defaultYear

  const { data: primaryCompanyData } = usePrimaryCompany()
  const primaryCompanyName = primaryCompanyData?.name ?? null

  const { data: companies, isLoading: companiesLoading } = useCompanies()
  const { data: kpiDefs, isLoading: defsLoading } = useKpiDefinitions()
  const { data: kpiValues, isLoading: valuesLoading } = useKpiValues({
    fiscalYear: effectiveYear,
    companyIds: companies?.map((c) => c.id),
  })

  // Additional data for command center
  const { data: reports } = useReports()
  const { data: publicationEvents } = usePublicationEvents()
  const { data: myCompanyKpis } = useMyCompanyKpis(primaryCompanyData?.id, effectiveYear)

  const isLoading = companiesLoading || defsLoading || valuesLoading || yearLoading

  // Filter KPI definitions by active category
  const filteredDefs = useMemo(() => {
    if (!kpiDefs) return []
    if (activeCategory === 'all') return kpiDefs
    return kpiDefs.filter((d) => d.category === activeCategory)
  }, [kpiDefs, activeCategory])

  // Build lookup: company_id + kpi_definition_id -> KpiValue row
  const valueMap = useMemo(() => {
    const map = new Map<string, KpiValueWithJoins>()
    if (!kpiValues) return map
    for (const v of kpiValues as KpiValueWithJoins[]) {
      const key = `${v.company_id}__${v.kpi_definition_id}`
      map.set(key, v)
    }
    return map
  }, [kpiValues])

  // For each KPI def, collect all company values (for min/max signal coloring)
  const kpiPeerValues = useMemo(() => {
    const out = new Map<string, (number | null)[]>()
    if (!companies || !filteredDefs) return out
    for (const def of filteredDefs) {
      const vals = companies.map((c) => {
        const v = valueMap.get(`${c.id}__${def.id}`)
        return v?.normalized_value ?? null
      })
      out.set(def.id, vals)
    }
    return out
  }, [companies, filteredDefs, valueMap])

  // Sort: primary company first, then alphabetical
  const sortedCompanies = useMemo(() => {
    if (!companies) return []
    return [...companies].sort((a, b) => {
      if (primaryCompanyName && a.name === primaryCompanyName) return -1
      if (primaryCompanyName && b.name === primaryCompanyName) return 1
      return a.name.localeCompare(b.name)
    })
  }, [companies, primaryCompanyName])

  // ---------------------------------------------------------------------------
  // Computed metrics for summary cards
  // ---------------------------------------------------------------------------

  // Percentile position (average across user's KPIs vs peers)
  const positionMetric = useMemo(() => {
    if (!myCompanyKpis || myCompanyKpis.length === 0 || !kpiValues || !companies) return null
    const percentiles: number[] = []
    for (const myKpi of myCompanyKpis) {
      const defId = myKpi.kpi_definition_id
      const peerNums: number[] = []
      for (const c of companies) {
        const v = valueMap.get(`${c.id}__${defId}`)
        if (v?.normalized_value != null) peerNums.push(v.normalized_value)
      }
      if (peerNums.length > 0) {
        const higherIsBetter = !LOWER_IS_BETTER_CODES.has(myKpi.kpi_definitions?.code ?? '')
        let p = computePercentile(myKpi.value, peerNums)
        if (!higherIsBetter) p = 100 - p
        percentiles.push(p)
      }
    }
    if (percentiles.length === 0) return null
    return Math.round(percentiles.reduce((a, b) => a + b, 0) / percentiles.length)
  }, [myCompanyKpis, kpiValues, companies, valueMap])

  // Active monitoring count
  const activeMonitored = useMemo(() => {
    if (!publicationEvents) return 0
    return publicationEvents.filter(
      (e) => e.status === 'scheduled' || e.status === 'due_today' || e.status === 'overdue'
    ).length
  }, [publicationEvents])

  // Data freshness — most recent report upload
  const dataFreshness = useMemo(() => {
    if (!reports || reports.length === 0) return null
    const sorted = [...reports].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    return getRelativeTime(sorted[0].created_at)
  }, [reports])

  // Pending reviews count
  const pendingReviews = useMemo(() => {
    if (!kpiValues) return 0
    return (kpiValues as KpiValueWithJoins[]).filter((v) => v.needs_review).length
  }, [kpiValues])

  // ---------------------------------------------------------------------------
  // Performance snapshot KPIs
  // ---------------------------------------------------------------------------

  const performanceKpis = useMemo(() => {
    if (!myCompanyKpis || myCompanyKpis.length === 0 || !companies) return []
    const results: KpiSnapshotProps[] = []
    for (const myKpi of myCompanyKpis.slice(0, 6)) {
      const def = myKpi.kpi_definitions
      if (!def) continue
      const defId = myKpi.kpi_definition_id
      const peerNums: number[] = []
      for (const c of companies) {
        const v = valueMap.get(`${c.id}__${defId}`)
        if (v?.normalized_value != null) peerNums.push(v.normalized_value)
      }
      let percentile = 50
      if (peerNums.length > 0) {
        const higherIsBetter = !LOWER_IS_BETTER_CODES.has(def.code)
        percentile = computePercentile(myKpi.value, peerNums)
        if (!higherIsBetter) percentile = 100 - percentile
      }
      results.push({
        name: def.name,
        value: myKpi.value,
        unitType: def.unit_type,
        percentile,
      })
    }
    return results
  }, [myCompanyKpis, companies, valueMap])

  // ---------------------------------------------------------------------------
  // Activity feed
  // ---------------------------------------------------------------------------

  const activityItems = useMemo(() => {
    const items: { time: Date; icon: React.ReactNode; description: string }[] = []

    // Recent report uploads
    if (reports) {
      for (const r of reports.slice(0, 5)) {
        const companyName = (r as unknown as { companies: Company }).companies?.name ?? 'Unknown'
        items.push({
          time: new Date(r.created_at),
          icon: <FileText className="h-4 w-4 text-muted-foreground" />,
          description: `${companyName} — ${r.report_type} report uploaded (FY ${r.fiscal_year})`,
        })
      }
    }

    // Publication events
    if (publicationEvents) {
      for (const e of publicationEvents.slice(0, 5)) {
        const companyName = (e as unknown as { companies: Company }).companies?.name ?? 'Unknown'
        const statusLabel =
          e.status === 'detected'
            ? 'publication detected'
            : e.status === 'ingested'
            ? 'report ingested'
            : e.status === 'overdue'
            ? 'publication overdue'
            : `status: ${e.status}`
        items.push({
          time: new Date(e.updated_at ?? e.created_at),
          icon: <CalendarCheck className="h-4 w-4 text-muted-foreground" />,
          description: `${companyName} — ${statusLabel}`,
        })
      }
    }

    // Sort by time descending, take 5
    return items
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, 5)
  }, [reports, publicationEvents])

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const hasCompany = !!primaryCompanyData
  const hasPeers = !!companies && companies.length > 0
  const hasKpiData = !!kpiValues && kpiValues.length > 0
  const hasData = !isLoading && hasPeers && hasKpiData
  // Genuinely empty = no peers or no KPI data at all across any year
  const isGenuinelyEmpty = !isLoading && (!hasPeers || (!hasKpiData && availableYears.length === 0))
  // Filtered to empty = we have data in other years but not this one
  const isFilteredEmpty = !isLoading && !hasKpiData && hasPeers && availableYears.length > 0

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-8">

      {/* ================================================================== */}
      {/* Section 1: Welcome Header                                          */}
      {/* ================================================================== */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">
            {getGreeting()}{primaryCompanyName ? `, ${primaryCompanyName}` : ''}
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Here's your benchmark overview for FY {effectiveYear}
          </p>
        </div>

        {/* Fiscal year selector */}
        <Select
          value={String(effectiveYear)}
          onValueChange={(v) => { if (v) setFiscalYear(Number(v)) }}
        >
          <SelectTrigger className="w-[120px] rounded-lg border-border bg-card text-[13px] text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-lg border-border bg-card text-[13px]">
            {availableYears.map((y) => (
              <SelectItem key={y} value={String(y)} className="text-[13px]">
                FY {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ================================================================== */}
      {/* Section 2: Summary Metric Cards                                    */}
      {/* ================================================================== */}
      <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              icon={<TrendingUp className="h-4 w-4 text-[var(--color-signal-green)]" />}
              label="Your Position"
              value={positionMetric !== null ? `P${positionMetric}` : '\u2014'}
              subtitle={`vs ${companies?.length ?? 0} peers`}
              accentColor="bg-[var(--color-signal-green)]/10"
            />
            <MetricCard
              icon={<Users className="h-4 w-4 text-[var(--color-accent)]" />}
              label="Peers Tracked"
              value={String(companies?.length ?? 0)}
              subtitle={`${activeMonitored} actively monitored`}
              accentColor="bg-[var(--color-accent)]/10"
            />
            <MetricCard
              icon={<Clock className="h-4 w-4 text-[var(--color-primary)]" />}
              label="Data Freshness"
              value={dataFreshness ?? '\u2014'}
              subtitle="Last report uploaded"
              accentColor="bg-[var(--color-primary)]/10"
            />
            <MetricCard
              icon={<AlertCircle className="h-4 w-4 text-[var(--color-signal-amber)]" />}
              label="Pending Reviews"
              value={String(pendingReviews)}
              subtitle="KPIs need attention"
              accentColor="bg-[var(--color-signal-amber)]/10"
            />
          </>
        )}
      </div>

      {/* ================================================================== */}
      {/* Section 3: Performance Snapshot                                    */}
      {/* ================================================================== */}
      {performanceKpis.length > 0 && (
        <div className="mb-8">
          <h2 className="text-[15px] font-semibold text-foreground mb-3">Performance Snapshot</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {performanceKpis.map((kpi) => (
              <KpiSnapshotCard
                key={kpi.name}
                name={kpi.name}
                value={kpi.value}
                unitType={kpi.unitType}
                percentile={kpi.percentile}
              />
            ))}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Section 4: Peer Comparison Table                                   */}
      {/* ================================================================== */}
      <div className="mb-8">
        <div className="mb-4">
          <h2 className="text-[15px] font-semibold text-foreground">Peer Comparison</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Normalized to CHF · Annual reports · Hover values for source reference
          </p>
        </div>

        {/* KPI category tabs */}
        <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as ActiveCategory)}>
          <TabsList className="mb-4 h-9 rounded-lg bg-[var(--color-bg-tertiary)] p-1">
            <TabsTrigger
              value="financial"
              className="rounded-md px-3 py-1 text-[12px] font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
            >
              Financial
            </TabsTrigger>
            <TabsTrigger
              value="esg"
              className="rounded-md px-3 py-1 text-[12px] font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
            >
              ESG
            </TabsTrigger>
            <TabsTrigger
              value="operational"
              className="rounded-md px-3 py-1 text-[12px] font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
            >
              Operational
            </TabsTrigger>
            <TabsTrigger
              value="all"
              className="rounded-md px-3 py-1 text-[12px] font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
            >
              All
            </TabsTrigger>
          </TabsList>

          {/* Table card */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">

            {isLoading ? (
              <div className="p-6">
                <TableSkeleton />
              </div>
            ) : isGenuinelyEmpty ? (
              <SetupGuidanceState hasCompany={hasCompany} hasPeers={hasPeers} />
            ) : isFilteredEmpty ? (
              <FilteredEmptyState
                fiscalYear={effectiveYear}
                onClearYear={(y) => setFiscalYear(y)}
                availableYears={availableYears}
              />
            ) : !hasData ? (
              <SetupGuidanceState hasCompany={hasCompany} hasPeers={hasPeers} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-max border-collapse">
                  <thead className="sticky top-0 z-20">
                    <tr className="border-b border-border bg-card">
                      {/* Company column header */}
                      <th className="sticky left-0 top-0 z-30 bg-card px-6 py-4 text-left">
                        <span
                          className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground"
                        >
                          Company
                        </span>
                      </th>

                      {filteredDefs.map((def) => (
                        <th key={def.id} className="sticky top-0 z-20 bg-card px-6 py-4 text-right">
                          <Tooltip>
                            <TooltipTrigger
                              className="cursor-default bg-transparent border-none p-0 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground whitespace-nowrap"
                            >
                              {def.name}
                            </TooltipTrigger>
                            {def.description && (
                              <TooltipContent
                                side="top"
                                className="max-w-[220px] rounded-lg border border-border bg-[var(--color-bg-elevated)] px-3 py-2 text-[11px] text-muted-foreground shadow-none"
                              >
                                {def.description}
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {sortedCompanies.map((company, idx) => {
                      const isPrimary = primaryCompanyName !== null && company.name === primaryCompanyName
                      const peerVals = kpiPeerValues

                      return (
                        <tr
                          key={company.id}
                          className={`border-b border-border transition-colors duration-200 last:border-0 ${
                            isPrimary
                              ? 'bg-[var(--color-accent)]/[0.04] hover:bg-[var(--color-accent)]/[0.07]'
                              : idx % 2 === 0
                              ? 'hover:bg-[var(--color-bg-tertiary)]'
                              : 'hover:bg-[var(--color-bg-tertiary)]'
                          }`}
                        >
                          {/* Company name + ticker — sticky */}
                          <td className="sticky left-0 z-10 bg-inherit px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-[13px] font-medium ${
                                      isPrimary ? 'text-foreground' : 'text-foreground'
                                    }`}
                                  >
                                    {company.name}
                                  </span>
                                  {isPrimary && (
                                    <span
                                      className="rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-accent)]"
                                    >
                                      Primary
                                    </span>
                                  )}
                                </div>
                                {company.ticker && (
                                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                                    {company.exchange ? `${company.exchange}: ` : ''}{company.ticker}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {filteredDefs.map((def) => {
                            const v = valueMap.get(`${company.id}__${def.id}`)
                            const allVals = peerVals.get(def.id) ?? []
                            const higherIsBetter = !LOWER_IS_BETTER_CODES.has(def.code)
                            const signalClass = getSignalClass(
                              v?.normalized_value ?? null,
                              allVals,
                              higherIsBetter,
                            )
                            return (
                              <KpiCell
                                key={def.id}
                                value={v as KpiValueWithJoins | undefined}
                                signalClass={signalClass}
                                unitType={def.unit_type}
                              />
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Legend */}
          {hasData && (
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-signal-green)]" />
                Best in peer group
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-signal-red)]" />
                Worst in peer group
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" />
                No data
              </div>
            </div>
          )}
        </Tabs>

        {/* Category label when grouped */}
        {activeCategory !== 'all' && hasData && (
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            Showing {CATEGORY_LABELS[activeCategory as KpiCategory]} KPIs · FY {effectiveYear}
          </p>
        )}
      </div>

      {/* ================================================================== */}
      {/* Section 5: Recent Activity                                         */}
      {/* ================================================================== */}
      {activityItems.length > 0 && (
        <div>
          <h2 className="text-[15px] font-semibold text-foreground mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            Recent Activity
          </h2>
          <div className="rounded-xl border border-border bg-card px-5 py-2">
            {activityItems.map((item, i) => (
              <ActivityItem
                key={i}
                icon={item.icon}
                description={item.description}
                time={getRelativeTime(item.time.toISOString())}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
