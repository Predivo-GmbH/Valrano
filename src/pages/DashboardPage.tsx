import { useState, useMemo, useRef, useEffect, type ReactNode } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useCompanies, useKpiDefinitions, useKpiValues, useReports } from '@/hooks/useData'
import { usePrimaryCompany, useMyCompanyKpis } from '@/hooks/useMyCompany'
import { usePublicationEvents } from '@/hooks/useCalendar'
import { useBenchmarkDocuments } from '@/hooks/useBenchmark'
import {
  useInsights,
  useDismissInsight,
  useGenerateInsights,
  useBookmarkInsight,
  useMarkInsightActed,
  type InsightFocus,
  type InsightTimeRange,
  type InsightReportType,
} from '@/hooks/useInsights'
import { useSmartYear } from '@/hooks/useSmartYear'
import { SetupProgressBanner } from '@/components/onboarding'
import type { Company, KpiCategory } from '@/types/database'
import { shortKpiLabel } from '@/lib/kpi-labels'
import {
  getGreeting,
  getRelativeTime,
  getCountdown,
  getEventStatusColor,
  getEventStatusDot,
  getDocStatusBadge,
} from '@/lib/dashboard-utils'
import {
  KpiCell,
  MetricCard,
  KpiSnapshotCard,
  SortableHeader,
} from '@/components/dashboard'
import type { KpiValueWithJoins, SortConfig, KpiSnapshotCardProps } from '@/components/dashboard'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Upload,
  Building2,
  Users,
  AlertCircle,
  Activity,
  FileText,
  CalendarCheck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  Zap,
  Calendar,
  FileCheck,
  Sparkles,
  ExternalLink,
  Loader2,
  X,
  TrendingUp as TrendingUpIcon,
  AlertTriangle,
  Lightbulb,
  Target,
  SlidersHorizontal,
  Bookmark,
  CheckCircle2,
  Shield,
  Download,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  'CO2_EMISSIONS', 'CO2_INTENSITY', 'ENERGY_INTENSITY',
  'WATER_INTENSITY', 'NET_DEBT', 'DEBT_TO_EQUITY',
])

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computePercentile(myValue: number, peerValues: number[]): number {
  if (peerValues.length === 0) return 50
  const allValues = [...peerValues, myValue].sort((a, b) => a - b)
  const rank = allValues.filter((v) => v < myValue).length
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
          to="/settings?tab=company"
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

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="mb-4 rounded-full bg-[var(--color-bg-tertiary)] p-4">
        <Upload className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-[15px] font-semibold text-foreground">Upload reports to compare</h3>
      <p className="mb-6 text-[13px] text-muted-foreground max-w-sm">
        Upload an annual report or enter KPI values manually so we can generate your benchmark position.
      </p>
      <Link
        to="/peers"
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
          to="/peers"
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
    <div className="space-y-px">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-[52px] skeleton-shimmer" />
      ))}
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="h-4 w-16 skeleton-shimmer mb-3" />
      <div className="h-7 w-12 skeleton-shimmer mb-2" />
      <div className="h-3 w-24 skeleton-shimmer" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Activity feed item
// ---------------------------------------------------------------------------

interface ActivityItemProps {
  icon: ReactNode
  description: string
  time: string
}

function ActivityItem({ icon, description, time }: ActivityItemProps) {
  return (
    <div className="row-accent flex items-center gap-3 py-3 border-b border-border last:border-0">
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

// ---------------------------------------------------------------------------
// AI Insights section
// ---------------------------------------------------------------------------

const INSIGHT_ICONS: Record<string, typeof Sparkles> = {
  trend_reversal: TrendingUpIcon,
  outlier: Target,
  risk_flag: AlertTriangle,
  opportunity: Lightbulb,
}

const INSIGHT_COLORS: Record<string, string> = {
  trend_reversal: 'text-[var(--color-accent)]',
  outlier: 'text-[var(--color-signal-amber)]',
  risk_flag: 'text-[var(--color-signal-red)]',
  opportunity: 'text-[var(--color-signal-green)]',
}

const PRIORITY_BADGE: Record<string, string> = {
  high: 'bg-[var(--color-signal-red)]/10 text-[var(--color-signal-red)]',
  medium: 'bg-[var(--color-signal-amber)]/10 text-[var(--color-signal-amber)]',
  low: 'bg-[var(--color-bg-tertiary)] text-muted-foreground',
}

const FOCUS_OPTIONS: { value: InsightFocus; label: string }[] = [
  { value: 'all', label: 'All KPIs' },
  { value: 'financial', label: 'Financial' },
  { value: 'esg', label: 'ESG' },
  { value: 'operational', label: 'Operational' },
]

const TIME_RANGE_OPTIONS: { value: InsightTimeRange; label: string }[] = [
  { value: '1y', label: '1 Year' },
  { value: '3y', label: '3 Years' },
  { value: '5y', label: '5 Years' },
]

const REPORT_TYPE_OPTIONS: { value: InsightReportType; label: string }[] = [
  { value: 'all', label: 'All Reports' },
  { value: 'annual', label: 'Annual' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half_year', label: 'Half Year' },
  { value: 'sustainability', label: 'Sustainability' },
]

const INSIGHT_TYPE_LABELS: Record<string, string> = {
  trend_reversal: 'Trend',
  outlier: 'Outlier',
  risk_flag: 'Risk',
  opportunity: 'Opportunity',
}

const DELTA_BADGE: Record<string, { label: string; class: string }> = {
  new: { label: 'NEW', class: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' },
  worsened: { label: 'WORSENED', class: 'bg-[var(--color-signal-red)]/10 text-[var(--color-signal-red)]' },
  improved: { label: 'IMPROVED', class: 'bg-[var(--color-signal-green)]/10 text-[var(--color-signal-green)]' },
  unchanged: { label: 'UNCHANGED', class: 'bg-[var(--color-bg-tertiary)] text-muted-foreground/50' },
}

function AiInsightsSection({ hasCompany, hasPeers }: { hasCompany: boolean; hasPeers: boolean }) {
  const { data: insights, isLoading } = useInsights({ dismissed: false })
  const dismissInsight = useDismissInsight()
  const generateInsights = useGenerateInsights()
  const bookmarkInsight = useBookmarkInsight()
  const markActed = useMarkInsightActed()
  const [focus, setFocus] = useState<InsightFocus>('all')
  const [timeRange, setTimeRange] = useState<InsightTimeRange>('1y')
  const [reportType, setReportType] = useState<InsightReportType>('all')
  const [showFilters, setShowFilters] = useState(false)

  // Show setup guidance if prerequisites not met
  if (!hasCompany || !hasPeers) {
    return (
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <span className="text-[15px] font-semibold text-foreground">AI Insights</span>
        </div>
        <div className="card-gradient-border rounded-xl bg-card/50 p-8 flex flex-col items-center justify-center text-center">
          <div className="mb-3 rounded-full bg-[var(--color-bg-tertiary)] p-3">
            <Sparkles className="h-5 w-5 text-muted-foreground/50" />
          </div>
          <p className="text-[13px] font-medium text-muted-foreground">
            {!hasCompany
              ? 'Set your company first to unlock AI Insights'
              : 'Add peer companies to generate competitive insights'}
          </p>
          <p className="text-[11px] text-muted-foreground/70 mt-1 max-w-sm">
            {!hasCompany
              ? 'Go to Settings and set which company you work for. AI Insights will then analyze your position relative to peers.'
              : 'Add competitors and peers via the Peers page. AI will compare their KPIs against yours.'}
          </p>
          <Link
            to={!hasCompany ? '/settings?tab=company' : '/peers'}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3.5 py-1.5 text-[11px] font-medium text-white transition-all hover:opacity-90 cursor-pointer"
          >
            {!hasCompany ? 'Go to Settings' : 'Add Peers'}
          </Link>
        </div>
      </div>
    )
  }

  const handleExportPdf = () => {
    if (!insights || insights.length === 0) return
    const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const lines = [
      'COMPETITIVE INTELLIGENCE BRIEF',
      `Generated: ${now}`,
      `Focus: ${focus === 'all' ? 'All KPIs' : focus} | Time Range: ${timeRange} | Report Type: ${reportType === 'all' ? 'All' : reportType}`,
      `Insights: ${insights.length}`,
      '',
      '═'.repeat(80),
      '',
    ]
    for (const insight of insights) {
      const typeTag = `[${(insight.insight_type ?? '').toUpperCase()}]`
      const priorityTag = `[${(insight.priority ?? '').toUpperCase()}]`
      const confidenceTag = insight.data_confidence ? ` | Confidence: ${insight.data_confidence}` : ''
      lines.push(`${typeTag} ${priorityTag}${confidenceTag}`)
      lines.push(insight.title)
      lines.push('')
      lines.push(insight.body)
      if (insight.companies) {
        lines.push(`Company: ${insight.companies.name}${insight.companies.ticker ? ` (${insight.companies.ticker})` : ''}`)
      }
      if (insight.related_kpi_code) lines.push(`KPI: ${insight.related_kpi_code}`)
      if (insight.fiscal_year) lines.push(`Fiscal Year: ${insight.fiscal_year}`)
      if (insight.is_acted_upon) lines.push(`Status: Acted upon${insight.action_note ? ` — ${insight.action_note}` : ''}`)
      if (insight.is_bookmarked) lines.push('Status: Bookmarked')
      lines.push('')
      lines.push('─'.repeat(80))
      lines.push('')
    }
    lines.push('', 'BenchmarkSignal — AI-Powered Competitive Intelligence', 'https://benchmarksignal.predivo.ch')
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `competitive-intelligence-brief-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleGenerate = () => {
    generateInsights.mutate({ focus, time_range: timeRange, report_type: reportType })
  }

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <Tooltip>
          <TooltipTrigger className="text-[15px] font-semibold text-foreground flex items-center gap-2 cursor-default bg-transparent border-none p-0">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            AI Insights
          </TooltipTrigger>
          <TooltipContent>Company-anchored competitive intelligence — trends, risks, and opportunities relative to your position.</TooltipContent>
        </Tooltip>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-foreground cursor-pointer"
          >
            <SlidersHorizontal className="h-3 w-3" />
            Filters
            {(focus !== 'all' || timeRange !== '1y' || reportType !== 'all') && (
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
            )}
          </button>
          {insights && insights.length > 0 && (
            <Tooltip>
              <TooltipTrigger>
                <button
                  onClick={handleExportPdf}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-foreground cursor-pointer"
                  aria-label="Export insights as brief"
                >
                  <Download className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Export as competitive intelligence brief</TooltipContent>
            </Tooltip>
          )}
          <button
            onClick={handleGenerate}
            disabled={generateInsights.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3.5 py-1.5 text-[11px] font-medium text-white transition-all hover:opacity-90 disabled:opacity-40 cursor-pointer"
          >
            {generateInsights.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {generateInsights.isPending ? 'Analyzing...' : 'Generate Insights'}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Focus</span>
            <Select value={focus} onValueChange={(v) => setFocus(v as InsightFocus)}>
              <SelectTrigger className="h-7 w-[120px] rounded-md border-border bg-[var(--color-bg-tertiary)] text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-lg border-border bg-card text-[11px]">
                {FOCUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-[11px]">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Time Range</span>
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as InsightTimeRange)}>
              <SelectTrigger className="h-7 w-[100px] rounded-md border-border bg-[var(--color-bg-tertiary)] text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-lg border-border bg-card text-[11px]">
                {TIME_RANGE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-[11px]">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Report Type</span>
            <Select value={reportType} onValueChange={(v) => setReportType(v as InsightReportType)}>
              <SelectTrigger className="h-7 w-[130px] rounded-md border-border bg-[var(--color-bg-tertiary)] text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-lg border-border bg-card text-[11px]">
                {REPORT_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-[11px]">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Generation result meta */}
      {generateInsights.data?.meta && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          <span className="rounded bg-[var(--color-bg-tertiary)] px-1.5 py-0.5">{generateInsights.data.meta.companies_analyzed} companies</span>
          <span className="rounded bg-[var(--color-bg-tertiary)] px-1.5 py-0.5">{generateInsights.data.meta.kpis_analyzed} KPIs</span>
          <span className="rounded bg-[var(--color-bg-tertiary)] px-1.5 py-0.5">{generateInsights.data.meta.data_points} data points</span>
          {generateInsights.data.delta_summary && (generateInsights.data.delta_summary.new > 0 || generateInsights.data.delta_summary.worsened > 0 || generateInsights.data.delta_summary.improved > 0) && (
            <>
              <span className="text-muted-foreground/30">|</span>
              {generateInsights.data.delta_summary.new > 0 && (
                <span className="rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)] px-1.5 py-0.5 font-medium">{generateInsights.data.delta_summary.new} new</span>
              )}
              {generateInsights.data.delta_summary.worsened > 0 && (
                <span className="rounded bg-[var(--color-signal-red)]/10 text-[var(--color-signal-red)] px-1.5 py-0.5 font-medium">{generateInsights.data.delta_summary.worsened} worsened</span>
              )}
              {generateInsights.data.delta_summary.improved > 0 && (
                <span className="rounded bg-[var(--color-signal-green)]/10 text-[var(--color-signal-green)] px-1.5 py-0.5 font-medium">{generateInsights.data.delta_summary.improved} improved</span>
              )}
            </>
          )}
          {generateInsights.data.risk_notifications_sent != null && generateInsights.data.risk_notifications_sent > 0 && (
            <>
              <span className="text-muted-foreground/30">|</span>
              <span className="rounded bg-[var(--color-signal-red)]/10 text-[var(--color-signal-red)] px-1.5 py-0.5 font-medium">{generateInsights.data.risk_notifications_sent} risk alert{generateInsights.data.risk_notifications_sent > 1 ? 's' : ''} sent</span>
            </>
          )}
        </div>
      )}

      {/* Insight cards */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 skeleton-shimmer rounded-lg" />
          ))}
        </div>
      ) : !insights || insights.length === 0 ? (
        <div className="card-gradient-border rounded-xl bg-card/50 p-8 flex flex-col items-center justify-center text-center">
          <div className="mb-3 rounded-full bg-[var(--color-bg-tertiary)] p-3">
            <Sparkles className="h-5 w-5 text-muted-foreground/50" />
          </div>
          <p className="text-[13px] font-medium text-muted-foreground">
            {generateInsights.data?.message ? 'No insights available' : 'No insights yet'}
          </p>
          <p className="text-[11px] text-muted-foreground/70 mt-1 max-w-sm">
            {generateInsights.data?.message
              ?? 'Select your focus area and click "Generate Insights" to analyze your benchmark data.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((insight) => {
            const Icon = INSIGHT_ICONS[insight.insight_type] ?? Sparkles
            const iconColor = INSIGHT_COLORS[insight.insight_type] ?? 'text-muted-foreground'
            const priorityClass = PRIORITY_BADGE[insight.priority ?? 'low'] ?? PRIORITY_BADGE.low
            const typeLabel = INSIGHT_TYPE_LABELS[insight.insight_type] ?? insight.insight_type

            // Split body into main text and recommendation (if "Consider..." exists)
            const considerIdx = insight.body.indexOf('Consider')
            const mainBody = considerIdx > 0 ? insight.body.slice(0, considerIdx).trim() : insight.body
            const recommendation = considerIdx > 0 ? insight.body.slice(considerIdx).trim() : null

            const confidenceColor = insight.data_confidence === 'high'
              ? 'text-[var(--color-signal-green)]'
              : insight.data_confidence === 'medium'
              ? 'text-[var(--color-signal-amber)]'
              : insight.data_confidence === 'low'
              ? 'text-[var(--color-signal-red)]'
              : 'text-muted-foreground'

            return (
              <div
                key={insight.id}
                className={`group relative card-premium rounded-lg border bg-card p-4 ${
                  insight.is_acted_upon
                    ? 'border-[var(--color-signal-green)]/30 bg-[var(--color-signal-green)]/[0.02]'
                    : insight.is_bookmarked
                    ? 'border-[var(--color-accent)]/30'
                    : 'border-border'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex-shrink-0 rounded-md p-1.5 bg-current/5 ${iconColor}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${iconColor} bg-current/5`}>
                        {typeLabel}
                      </span>
                      {insight.delta_label && insight.delta_label !== 'unchanged' && DELTA_BADGE[insight.delta_label] && (
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${DELTA_BADGE[insight.delta_label].class}`}>
                          {DELTA_BADGE[insight.delta_label].label}
                        </span>
                      )}
                      <h3 className="text-[13px] font-medium text-foreground truncate flex-1">
                        {insight.title}
                      </h3>
                      {insight.data_confidence && (
                        <Tooltip>
                          <TooltipTrigger className="cursor-default bg-transparent border-none p-0" aria-label={`Data confidence: ${insight.data_confidence}`}>
                            <Shield className={`h-3 w-3 ${confidenceColor}`} />
                          </TooltipTrigger>
                          <TooltipContent>Data confidence: {insight.data_confidence} — based on completeness of underlying KPI data</TooltipContent>
                        </Tooltip>
                      )}
                      <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider flex-shrink-0 ${priorityClass}`}>
                        {insight.priority}
                      </span>
                    </div>
                    <p className="text-[12px] leading-relaxed text-muted-foreground">
                      {mainBody}
                    </p>
                    {recommendation && (
                      <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--color-accent)] bg-[var(--color-accent)]/5 rounded px-2 py-1.5 border-l-2 border-[var(--color-accent)]">
                        {recommendation}
                      </p>
                    )}
                    {insight.is_acted_upon && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[var(--color-signal-green)]">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Acted upon{insight.acted_at ? ` · ${getRelativeTime(insight.acted_at)}` : ''}</span>
                        {insight.action_note && (
                          <span className="text-muted-foreground ml-1">— {insight.action_note}</span>
                        )}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground/70">
                      {insight.companies && (
                        <Link
                          to={`/companies/${insight.companies.id}`}
                          className="hover:text-[var(--color-accent)] hover:underline transition-colors cursor-pointer"
                        >
                          {insight.companies.name}{insight.companies.ticker ? ` (${insight.companies.ticker})` : ''}
                        </Link>
                      )}
                      {insight.related_kpi_code && (
                        <Link
                          to={`/analytics?kpi=${encodeURIComponent(insight.related_kpi_code)}`}
                          className="rounded bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 text-[9px] font-medium hover:text-[var(--color-accent)] hover:underline transition-colors cursor-pointer"
                        >
                          {insight.related_kpi_code}
                        </Link>
                      )}
                      {insight.fiscal_year && (
                        <span>FY {insight.fiscal_year}</span>
                      )}
                      {insight.auto_generated && (
                        <span className="text-[var(--color-accent)]/60">auto</span>
                      )}
                      {insight.created_at && (
                        <span>Generated {getRelativeTime(insight.created_at)}</span>
                      )}
                    </div>
                  </div>
                  {/* Action buttons — visible on hover */}
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <Tooltip>
                      <TooltipTrigger>
                        <button
                          onClick={() => bookmarkInsight.mutate({ id: insight.id, bookmarked: !insight.is_bookmarked })}
                          className={`min-h-[44px] min-w-[44px] flex items-center justify-center transition-all cursor-pointer focus-visible:opacity-100 ${
                            insight.is_bookmarked
                              ? 'text-[var(--color-accent)] opacity-100'
                              : 'text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground'
                          }`}
                          aria-label={insight.is_bookmarked ? 'Remove bookmark' : 'Bookmark insight'}
                        >
                          <Bookmark className={`h-3.5 w-3.5 ${insight.is_bookmarked ? 'fill-current' : ''}`} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{insight.is_bookmarked ? 'Remove bookmark' : 'Bookmark'}</TooltipContent>
                    </Tooltip>
                    {!insight.is_acted_upon && (
                      <Tooltip>
                        <TooltipTrigger>
                          <button
                            onClick={() => markActed.mutate({ id: insight.id })}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all hover:text-[var(--color-signal-green)] cursor-pointer"
                            aria-label="Mark as acted upon"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Mark as acted upon</TooltipContent>
                      </Tooltip>
                    )}
                    <button
                      onClick={() => dismissInsight.mutate(insight.id)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-muted-foreground hover:text-foreground cursor-pointer"
                      aria-label="Dismiss insight"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function DashboardPage() {
  const { defaultYear, availableYears, isLoading: yearLoading } = useSmartYear()
  const [fiscalYear, setFiscalYear] = useState<number | null>(null)
  const [activeCategory, setActiveCategory] = useState<ActiveCategory>('financial')
  const [sortConfig, setSortConfig] = useState<SortConfig>({ columnId: null, direction: 'desc' })
  const [showEmptyPeers, setShowEmptyPeers] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showRightFade, setShowRightFade] = useState(true)

  const effectiveYear = fiscalYear ?? defaultYear

  const { data: primaryCompanyData } = usePrimaryCompany()
  const primaryCompanyName = primaryCompanyData?.name ?? null

  const { data: companies, isLoading: companiesLoading } = useCompanies()
  const { data: kpiDefs, isLoading: defsLoading } = useKpiDefinitions()

  // Peer companies = all visible companies MINUS the user's own company
  const userCompanyId = primaryCompanyData?.company_id
  const peerCompanies = useMemo(() => {
    if (!companies) return []
    if (!userCompanyId) return companies
    return companies.filter((c) => c.id !== userCompanyId)
  }, [companies, userCompanyId])

  const companyIds = useMemo(() => companies?.map((c) => c.id), [companies])

  const { data: kpiValues, isLoading: valuesLoading } = useKpiValues({
    fiscalYear: effectiveYear,
    companyIds,
  })

  const { data: reports } = useReports()
  const { data: publicationEvents } = usePublicationEvents()
  const { data: benchmarkDocs } = useBenchmarkDocuments()
  const { data: myCompanyKpis } = useMyCompanyKpis(primaryCompanyData?.id, effectiveYear)

  const isLoading = companiesLoading || defsLoading || valuesLoading || yearLoading

  // Filter KPI definitions by active category
  const filteredDefs = useMemo(() => {
    if (!kpiDefs) return []
    if (activeCategory === 'all') return kpiDefs
    return kpiDefs.filter((d) => d.category === activeCategory)
  }, [kpiDefs, activeCategory])

  // All columns always visible
  const visibleDefs = filteredDefs


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

  // For each KPI def, collect all peer company values (for min/max signal coloring)
  const kpiPeerValues = useMemo(() => {
    const out = new Map<string, (number | null)[]>()
    if (!peerCompanies.length || !filteredDefs) return out
    for (const def of filteredDefs) {
      const vals = peerCompanies.map((c) => {
        const v = valueMap.get(`${c.id}__${def.id}`)
        return v?.normalized_value ?? null
      })
      out.set(def.id, vals)
    }
    return out
  }, [peerCompanies, filteredDefs, valueMap])

  // Split peer companies (excluding user's own) into those with data vs without
  const { companiesWithData, companiesWithoutData } = useMemo(() => {
    if (!peerCompanies || !filteredDefs) return { companiesWithData: [], companiesWithoutData: [] }

    const withData: Company[] = []
    const withoutData: Company[] = []

    for (const company of peerCompanies) {
      const hasAnyValue = filteredDefs.some((def) => {
        const v = valueMap.get(`${company.id}__${def.id}`)
        return v?.normalized_value != null
      })
      if (hasAnyValue) {
        withData.push(company)
      } else {
        withoutData.push(company)
      }
    }

    return { companiesWithData: withData, companiesWithoutData: withoutData }
  }, [peerCompanies, filteredDefs, valueMap])

  // Sort peer companies by sort column or alphabetical
  const sortedCompaniesWithData = useMemo(() => {
    const sorted = [...companiesWithData]

    if (sortConfig.columnId && sortConfig.columnId !== '__name') {
      sorted.sort((a, b) => {
        const aVal = valueMap.get(`${a.id}__${sortConfig.columnId}`)?.normalized_value ?? null
        const bVal = valueMap.get(`${b.id}__${sortConfig.columnId}`)?.normalized_value ?? null

        // Nulls always last
        if (aVal === null && bVal === null) return a.name.localeCompare(b.name)
        if (aVal === null) return 1
        if (bVal === null) return -1

        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
      })
    } else if (sortConfig.columnId === '__name') {
      sorted.sort((a, b) => {
        return sortConfig.direction === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name)
      })
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name))
    }

    return sorted
  }, [companiesWithData, sortConfig, valueMap])

  function handleSort(columnId: string) {
    setSortConfig((prev) => {
      if (prev.columnId === columnId) {
        return { columnId, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { columnId, direction: 'desc' }
    })
  }

  // Track horizontal scroll for right fade indicator
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
  }, [filteredDefs.length, sortedCompaniesWithData.length])

  // ---------------------------------------------------------------------------
  // Computed metrics for summary cards
  // ---------------------------------------------------------------------------

  const activeMonitored = useMemo(() => {
    if (!publicationEvents) return 0
    return publicationEvents.filter(
      (e) => e.status === 'scheduled' || e.status === 'due_today' || e.status === 'overdue'
    ).length
  }, [publicationEvents])

  const pipelineActive = useMemo(() => {
    if (!publicationEvents) return 0
    return publicationEvents.filter(
      (e) => e.status === 'detected' || e.status === 'ingested'
    ).length
  }, [publicationEvents])

  const nextReport = useMemo(() => {
    if (!publicationEvents) return null
    const upcoming = publicationEvents
      .filter((e) => e.status === 'scheduled' || e.status === 'due_today' || e.status === 'overdue')
      .sort((a, b) => new Date(a.expected_date).getTime() - new Date(b.expected_date).getTime())
    if (upcoming.length === 0) return null
    const event = upcoming[0]
    const companyName = (event as unknown as { companies: Company }).companies?.name ?? 'Unknown'
    return { countdown: getCountdown(event.expected_date), company: companyName, status: event.status }
  }, [publicationEvents])

  const documentsReady = useMemo(() => {
    if (!benchmarkDocs) return 0
    return benchmarkDocs.filter((d) => d.status === 'approved' || d.status === 'delivered').length
  }, [benchmarkDocs])

  const pendingReviews = useMemo(() => {
    if (!kpiValues) return 0
    return (kpiValues as KpiValueWithJoins[]).filter((v) => v.needs_review).length
  }, [kpiValues])

  const upcomingEvents = useMemo(() => {
    if (!publicationEvents) return []
    return publicationEvents
      .filter((e) => e.status !== 'cancelled' && e.status !== 'benchmark_ready')
      .sort((a, b) => {
        const statusOrder: Record<string, number> = { overdue: 0, due_today: 1, detected: 2, ingested: 3, scheduled: 4 }
        const aOrder = statusOrder[a.status] ?? 5
        const bOrder = statusOrder[b.status] ?? 5
        if (aOrder !== bOrder) return aOrder - bOrder
        return new Date(a.expected_date).getTime() - new Date(b.expected_date).getTime()
      })
      .slice(0, 6)
  }, [publicationEvents])

  const recentDocuments = useMemo(() => {
    if (!benchmarkDocs) return []
    return benchmarkDocs.slice(0, 5)
  }, [benchmarkDocs])

  // ---------------------------------------------------------------------------
  // Performance snapshot KPIs
  // ---------------------------------------------------------------------------

  const performanceKpis = useMemo(() => {
    if (!myCompanyKpis || myCompanyKpis.length === 0 || !peerCompanies.length) return []
    const results: KpiSnapshotCardProps[] = []
    for (const myKpi of myCompanyKpis.slice(0, 6)) {
      const def = myKpi.kpi_definitions
      if (!def) continue
      const defId = myKpi.kpi_definition_id
      const peerNums: number[] = []
      for (const c of peerCompanies) {
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
  }, [myCompanyKpis, peerCompanies, valueMap])

  // ---------------------------------------------------------------------------
  // Activity feed
  // ---------------------------------------------------------------------------

  const activityItems = useMemo(() => {
    const items: { time: Date; icon: ReactNode; description: string }[] = []

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

    return items
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, 5)
  }, [reports, publicationEvents])

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const hasCompany = !!primaryCompanyData
  const hasPeers = peerCompanies.length > 0
  const hasKpiData = !!kpiValues && kpiValues.length > 0
  const hasData = !isLoading && hasPeers && hasKpiData
  const isGenuinelyEmpty = !isLoading && (!hasPeers || (!hasKpiData && availableYears.length === 0))
  const isFilteredEmpty = !isLoading && !hasKpiData && hasPeers && availableYears.length > 0

  // Count of KPIs with data in the filtered view
  const dataKpiCount = useMemo(() => {
    if (!filteredDefs || companiesWithData.length === 0) return 0
    return filteredDefs.filter((def) =>
      companiesWithData.some((c) => valueMap.get(`${c.id}__${def.id}`)?.normalized_value != null)
    ).length
  }, [filteredDefs, companiesWithData, valueMap])

  // ---------------------------------------------------------------------------
  // Pipeline status bar computation (extracted from JSX IIFE for performance)
  // ---------------------------------------------------------------------------
  const pipelineStatusBar = useMemo(() => {
    if (!publicationEvents || publicationEvents.length === 0) return null
    const counts = { scheduled: 0, detected: 0, ingested: 0, benchmark_ready: 0 }
    for (const ev of publicationEvents) {
      if (ev.status === 'scheduled' || ev.status === 'due_today' || ev.status === 'overdue') counts.scheduled++
      else if (ev.status === 'detected') counts.detected++
      else if (ev.status === 'ingested') counts.ingested++
      else if (ev.status === 'benchmark_ready') counts.benchmark_ready++
    }
    return [
      { label: 'Scheduled', count: counts.scheduled, color: 'bg-blue-500', borderColor: '#3b82f6' },
      { label: 'Detected', count: counts.detected, color: 'bg-green-500', borderColor: '#22c55e' },
      { label: 'Ingested', count: counts.ingested, color: 'bg-emerald-500', borderColor: '#10b981' },
      { label: 'Benchmark', count: counts.benchmark_ready, color: 'bg-violet-500', borderColor: '#8b5cf6' },
    ]
  }, [publicationEvents])

  // ---------------------------------------------------------------------------
  // Peer benchmark comparison rows (extracted from JSX IIFE for performance)
  // ---------------------------------------------------------------------------
  const peerComparisonRows = useMemo(() => {
    if (!hasCompany || !hasPeers || !myCompanyKpis || myCompanyKpis.length === 0) return null
    const rows: {
      code: string
      label: string
      myValue: number
      peerAvg: number
      peerMedian: number
      rank: number
      totalInRank: number
      signal: 'advantage' | 'neutral' | 'risk'
    }[] = []

    for (const myKpi of myCompanyKpis) {
      const def = myKpi.kpi_definitions
      if (!def) continue
      const defId = myKpi.kpi_definition_id
      const peerNums: number[] = []
      for (const c of peerCompanies) {
        const v = valueMap.get(`${c.id}__${defId}`)
        if (v?.normalized_value != null) peerNums.push(v.normalized_value)
      }
      if (peerNums.length === 0) continue

      const avg = peerNums.reduce((a, b) => a + b, 0) / peerNums.length
      const sorted = [...peerNums].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]

      const higherIsBetter = !LOWER_IS_BETTER_CODES.has(def.code)
      const allVals = [...peerNums, myKpi.value].sort((a, b) => b - a)
      const rank = higherIsBetter
        ? allVals.indexOf(myKpi.value) + 1
        : [...allVals].reverse().indexOf(myKpi.value) + 1

      let signal: 'advantage' | 'neutral' | 'risk' = 'neutral'
      const pctile = computePercentile(myKpi.value, peerNums)
      const effectivePctile = higherIsBetter ? pctile : 100 - pctile
      if (effectivePctile >= 70) signal = 'advantage'
      else if (effectivePctile <= 30) signal = 'risk'

      rows.push({
        code: def.code,
        label: shortKpiLabel(def.name),
        myValue: myKpi.value,
        peerAvg: avg,
        peerMedian: median,
        rank,
        totalInRank: peerNums.length + 1,
        signal,
      })
    }
    return rows.length > 0 ? rows : null
  }, [hasCompany, hasPeers, myCompanyKpis, peerCompanies, valueMap])

  return (
    <TooltipProvider>
    <>
    <Helmet><title>Dashboard - BenchmarkSignal</title></Helmet>
    <div className="section-fade-in mx-auto max-w-[1440px] px-4 py-8 sm:px-6">

      {/* Setup progress banner (shows when wizard dismissed but steps incomplete) */}
      <div className="mb-6">
        <SetupProgressBanner />
      </div>

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

        <Select
          value={String(effectiveYear)}
          onValueChange={(v) => { if (v) setFiscalYear(Number(v)) }}
        >
          <SelectTrigger className="w-[120px] rounded-lg border-border bg-card text-[13px] text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end" className="rounded-lg border-border bg-card text-[13px]">
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
            <div className="stagger-child" style={{ '--stagger': 0 } as React.CSSProperties}>
              <MetricCard
                icon={<Zap className="h-4 w-4 text-[var(--color-accent)]" />}
                label="Pipeline Active"
                value={String(pipelineActive + activeMonitored)}
                subtitle={`${activeMonitored} monitored · ${pipelineActive} processing`}
                accentColor="bg-[var(--color-accent)]/10"
                tooltip="Reports currently being monitored or processed through the ingestion pipeline."
              />
            </div>
            <div className="stagger-child" style={{ '--stagger': 1 } as React.CSSProperties}>
              <MetricCard
                icon={<Calendar className="h-4 w-4 text-[var(--color-primary)]" />}
                label="Next Report"
                value={nextReport?.countdown ?? '\u2014'}
                subtitle={nextReport ? nextReport.company : 'No upcoming reports'}
                accentColor="bg-[var(--color-primary)]/10"
                tooltip="Countdown to the next expected peer report publication."
              />
            </div>
            <div className="stagger-child" style={{ '--stagger': 2 } as React.CSSProperties}>
              <MetricCard
                icon={<FileCheck className="h-4 w-4 text-[var(--color-signal-green)]" />}
                label="Documents Ready"
                value={String(documentsReady)}
                subtitle={`${benchmarkDocs?.length ?? 0} total generated`}
                accentColor="bg-[var(--color-signal-green)]/10"
                tooltip="AI-generated benchmark reports approved or delivered to clients."
              />
            </div>
            <div className="stagger-child" style={{ '--stagger': 3 } as React.CSSProperties}>
              <MetricCard
                icon={<AlertCircle className="h-4 w-4 text-[var(--color-signal-amber)]" />}
                label="Pending Reviews"
                value={String(pendingReviews)}
                subtitle="KPIs need attention"
                accentColor="bg-[var(--color-signal-amber)]/10"
                tooltip="Extracted KPI values flagged for manual review due to low confidence."
              />
            </div>
          </>
        )}
      </div>

      {/* ================================================================== */}
      {/* Pipeline Status Bar                                               */}
      {/* ================================================================== */}
      {pipelineStatusBar && (
          <div className="card-premium mb-8 rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <Tooltip>
                <TooltipTrigger className="text-[13px] font-semibold uppercase tracking-[0.05em] text-muted-foreground flex items-center gap-2 cursor-default bg-transparent border-none p-0">
                  <Activity className="h-4 w-4" />
                  Pipeline Status
                </TooltipTrigger>
                <TooltipContent>Track how peer reports move through detection, ingestion, and benchmarking.</TooltipContent>
              </Tooltip>
              <Link
                to="/peers?tab=calendar"
                className="text-[11px] font-medium text-[var(--color-accent)] hover:underline"
              >
                View Calendar →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {pipelineStatusBar.map((stage) => (
                <div key={stage.label} className="rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-2.5 text-center border-t-2" style={{ borderTopColor: stage.borderColor }}>
                  <div className="flex items-center justify-center gap-1.5 mb-0.5">
                    <span className={`h-2 w-2 rounded-full ${stage.color}`} />
                    <span className="text-[18px] font-semibold tabular-nums text-foreground">{stage.count}</span>
                  </div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{stage.label}</div>
                </div>
              ))}
            </div>
          </div>
      )}

      {/* ================================================================== */}
      {/* Section 3: Upcoming Publications Timeline                         */}
      {/* ================================================================== */}
      {upcomingEvents.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <Tooltip>
              <TooltipTrigger className="text-[15px] font-semibold text-foreground flex items-center gap-2 cursor-default bg-transparent border-none p-0">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Upcoming Publications
              </TooltipTrigger>
              <TooltipContent>Scheduled peer report releases based on historical patterns and announcements.</TooltipContent>
            </Tooltip>
            <Link
              to="/peers?tab=calendar"
              className="text-[11px] font-medium text-[var(--color-accent)] hover:underline flex items-center gap-1"
            >
              View Calendar
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <div className="card-premium rounded-xl border border-border bg-card overflow-hidden">
            {upcomingEvents.map((event, i) => {
              const companyName = (event as unknown as { companies: Company }).companies?.name ?? 'Unknown'
              const isOverdue = event.status === 'overdue'
              const isDueToday = event.status === 'due_today'
              return (
                <div
                  key={event.id}
                  className={`row-accent flex items-center gap-3 px-4 py-3 ${i < upcomingEvents.length - 1 ? 'border-b border-border/50' : ''} ${
                    isOverdue ? 'bg-[var(--color-signal-red)]/[0.03]' : isDueToday ? 'bg-[var(--color-signal-amber)]/[0.03]' : ''
                  }`}
                >
                  <div className={`flex-shrink-0 h-2 w-2 rounded-full ${getEventStatusDot(event.status)} ${isOverdue || isDueToday ? 'status-pulse' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-foreground truncate">{companyName}</span>
                      <span className="flex-shrink-0 text-[10px] text-muted-foreground bg-[var(--color-bg-tertiary)] rounded px-1.5 py-px">
                        {event.report_type}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      FY {event.fiscal_year}{event.fiscal_quarter ? ` Q${event.fiscal_quarter}` : ''}
                      {' · '}
                      {new Date(event.expected_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                  <div className={`flex-shrink-0 text-[12px] font-semibold tabular-nums ${getEventStatusColor(event.status)}`}>
                    {event.status === 'detected' ? 'Detected' :
                     event.status === 'ingested' ? 'Ingested' :
                     getCountdown(event.expected_date)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Section 3b: Performance Snapshot                                   */}
      {/* ================================================================== */}
      {performanceKpis.length > 0 && (
        <div className="mb-8">
          <Tooltip>
            <TooltipTrigger className="text-[15px] font-semibold text-foreground mb-3 cursor-default bg-transparent border-none p-0 w-fit">
              Performance Snapshot
            </TooltipTrigger>
            <TooltipContent>Your company's key KPIs and where they rank among peers.</TooltipContent>
          </Tooltip>
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
      {/* Section 3c: Peer Benchmark Comparison                              */}
      {/* ================================================================== */}
      {peerComparisonRows && (() => {
        const comparisonRows = peerComparisonRows

        const fmtCompact = (v: number) => {
          if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}B`
          if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`
          if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}K`
          return v.toFixed(1)
        }

        return (
          <div className="mb-8">
            <Tooltip>
              <TooltipTrigger className="text-[15px] font-semibold text-foreground mb-3 flex items-center gap-2 cursor-default bg-transparent border-none p-0 w-fit">
                <Users className="h-4 w-4 text-muted-foreground" />
                Peer Benchmark Comparison
              </TooltipTrigger>
              <TooltipContent>Side-by-side comparison of your KPIs vs peer averages and medians.</TooltipContent>
            </Tooltip>
            <div className="card-premium rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="border-b-2 border-border">
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">KPI</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Your Value</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Peer Avg</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Peer Median</th>
                      <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Rank</th>
                      <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Signal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map((row, idx) => (
                      <tr
                        key={row.code}
                        className={`border-b border-border/50 last:border-0 transition-colors ${
                          idx % 2 === 0 ? '' : 'bg-[var(--color-bg-tertiary)]/10'
                        }`}
                      >
                        <td className="px-3 py-2.5 text-[12px] font-medium text-foreground">{row.label}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-foreground font-semibold">{fmtCompact(row.myValue)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{fmtCompact(row.peerAvg)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{fmtCompact(row.peerMedian)}</td>
                        <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">{row.rank}/{row.totalInRank}</td>
                        <td className="px-3 py-2.5 text-center">
                          {row.signal === 'advantage' ? (
                            <span className="inline-flex items-center gap-1 text-[var(--color-signal-green)]">
                              <ArrowUp className="h-3 w-3" />
                              <span className="text-[10px] font-medium">Advantage</span>
                            </span>
                          ) : row.signal === 'risk' ? (
                            <span className="inline-flex items-center gap-1 text-[var(--color-signal-red)]">
                              <ArrowDown className="h-3 w-3" />
                              <span className="text-[10px] font-medium">Risk</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-muted-foreground">Neutral</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-border px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <ArrowUp className="h-2.5 w-2.5 text-[var(--color-signal-green)]" />
                    Advantage
                  </span>
                  <span className="flex items-center gap-1.5">
                    <ArrowDown className="h-2.5 w-2.5 text-[var(--color-signal-red)]" />
                    Risk
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  vs {peerCompanies.length} peer{peerCompanies.length === 1 ? '' : 's'} · FY {effectiveYear}
                </span>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ================================================================== */}
      {/* Section 4: Peer Comparison Table                                   */}
      {/* ================================================================== */}
      <div className="mb-8">
        <Tabs value={activeCategory} onValueChange={(v) => { setActiveCategory(v as ActiveCategory) }}>
          <div className="card-premium rounded-xl border border-border bg-card overflow-hidden">
            {/* Card header: title + category tabs */}
            <div className="flex flex-col gap-3 px-4 py-3 border-b border-border sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <Tooltip>
                  <TooltipTrigger className="text-[13px] font-semibold text-foreground cursor-default bg-transparent border-none p-0">
                    Peer Comparison
                  </TooltipTrigger>
                  <TooltipContent>Side-by-side KPI comparison across all peers, normalized to CHF.</TooltipContent>
                </Tooltip>
                <p className="text-[10px] text-muted-foreground">
                  {companiesWithData.length}/{peerCompanies.length} peers · {dataKpiCount} KPIs · Normalized to CHF
                </p>
              </div>
              <TabsList className="h-7 rounded-lg bg-[var(--color-bg-tertiary)] p-0.5 flex-shrink-0 overflow-x-auto">
                <TabsTrigger
                  value="financial"
                  className="rounded px-2.5 py-0.5 text-[10px] font-medium flex-shrink-0 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
                >
                  Financial
                </TabsTrigger>
                <TabsTrigger
                  value="esg"
                  className="rounded px-2.5 py-0.5 text-[10px] font-medium flex-shrink-0 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
                >
                  ESG
                </TabsTrigger>
                <TabsTrigger
                  value="operational"
                  className="rounded px-2.5 py-0.5 text-[10px] font-medium flex-shrink-0 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
                >
                  Operational
                </TabsTrigger>
                <TabsTrigger
                  value="all"
                  className="rounded px-2.5 py-0.5 text-[10px] font-medium flex-shrink-0 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
                >
                  All
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Table content */}
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
            ) : companiesWithData.length === 0 ? (
              <SetupGuidanceState hasCompany={hasCompany} hasPeers={hasPeers} />
            ) : (
              <div className="relative">
                <div ref={scrollRef} className="overflow-x-auto scrollbar-thin">
                  <table className="table-premium w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                    <thead>
                      <tr className="border-b-2 border-border">
                        {/* Company column header — sticky */}
                        <th className="sticky left-0 z-30 bg-card px-3 py-2 text-left after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border/40 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)] dark:shadow-[2px_0_6px_-2px_rgba(0,0,0,0.3)]" style={{ width: '180px' }}>
                          <button
                            onClick={() => handleSort('__name')}
                            aria-label="Sort by company name"
                            className={`inline-flex items-center gap-1 cursor-pointer bg-transparent border-none p-0 text-[10px] font-semibold uppercase tracking-[0.06em] transition-colors duration-150 min-h-[44px] md:min-h-0 ${
                              sortConfig.columnId === '__name' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            Company
                            {sortConfig.columnId === '__name' ? (
                              sortConfig.direction === 'asc' ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />
                            ) : (
                              <ArrowUpDown className="h-2.5 w-2.5 opacity-30" />
                            )}
                          </button>
                        </th>

                        {visibleDefs.map((def) => (
                          <SortableHeader
                            key={def.id}
                            label={shortKpiLabel(def.name)}
                            columnId={def.id}
                            sortConfig={sortConfig}
                            onSort={handleSort}
                            description={def.description ?? def.name}
                          />
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {sortedCompaniesWithData.map((company, idx) => {
                        const isPrimary = primaryCompanyName !== null && company.name === primaryCompanyName
                        const peerVals = kpiPeerValues

                        return (
                          <tr
                            key={company.id}
                            className={`border-b border-border/50 transition-colors duration-100 last:border-0 ${
                              isPrimary
                                ? 'bg-[var(--color-accent)]/[0.04] hover:bg-[var(--color-accent)]/[0.07]'
                                : idx % 2 === 0
                                ? 'hover:bg-[var(--color-bg-tertiary)]/30'
                                : 'bg-[var(--color-bg-tertiary)]/10 hover:bg-[var(--color-bg-tertiary)]/30'
                            }`}
                          >
                            {/* Company name — sticky, no avatar */}
                            <td className={`sticky left-0 z-20 bg-card px-3 py-2 after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border/30 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)] dark:shadow-[2px_0_6px_-2px_rgba(0,0,0,0.3)] ${isPrimary ? 'border-l-2 border-l-[var(--color-accent)]' : ''}`} style={{ width: '180px' }}>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <Link
                                    to={`/companies/${company.id}`}
                                    className="text-[12px] font-medium text-foreground truncate max-w-[100px] md:max-w-[140px] hover:text-[var(--color-accent)] hover:underline transition-colors"
                                  >
                                    {company.name}
                                  </Link>
                                  {isPrimary && (
                                    <span className="flex-shrink-0 rounded bg-[var(--color-accent)]/10 px-1 py-px text-[9px] font-bold uppercase leading-none text-[var(--color-accent)]">
                                      You
                                    </span>
                                  )}
                                </div>
                                {company.ticker && (
                                  <div className="hidden md:block text-[10px] text-muted-foreground leading-tight mt-px">
                                    {company.exchange ? `${company.exchange}:` : ''}{company.ticker}
                                  </div>
                                )}
                              </div>
                            </td>

                            {visibleDefs.map((def) => {
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
                {/* Right fade indicator — scroll affordance */}
                {showRightFade && (
                  <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--color-card)] to-transparent z-10" />
                )}
              </div>
            )}

            {/* Card footer: legend + category label */}
            {hasData && companiesWithData.length > 0 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-2">
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-signal-green)]" />
                    Best
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-signal-red)]" />
                    Worst
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {activeCategory !== 'all' ? `${CATEGORY_LABELS[activeCategory as KpiCategory]} · ` : ''}FY {effectiveYear}
                </span>
              </div>
            )}

            {/* Empty peers — inside card */}
            {companiesWithoutData.length > 0 && hasData && (
              <div className="border-t border-border/50 px-4 py-2.5">
                <button
                  onClick={() => setShowEmptyPeers(!showEmptyPeers)}
                  className="inline-flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-150"
                >
                  {showEmptyPeers ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  {companiesWithoutData.length} peer{companiesWithoutData.length === 1 ? '' : 's'} without data
                </button>

                {showEmptyPeers && (
                  <div className="mt-2">
                    <div className="flex flex-wrap gap-1.5">
                      {companiesWithoutData
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((company) => (
                        <Link
                          key={company.id}
                          to={`/companies/${company.id}`}
                          className="text-[10px] text-muted-foreground/70 bg-[var(--color-bg-tertiary)] rounded px-2 py-0.5 hover:text-[var(--color-accent)] hover:underline transition-colors"
                        >
                          {company.name}
                        </Link>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      <Link to="/peers" className="text-[var(--color-accent)] hover:underline">
                        Upload reports
                      </Link>
                      {' '}to include them in your benchmark.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </Tabs>
      </div>

      {/* ================================================================== */}
      {/* Section 5: Recent Documents + Recent Activity (2-col on desktop)  */}
      {/* ================================================================== */}
      <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Documents */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <Tooltip>
              <TooltipTrigger className="text-[15px] font-semibold text-foreground flex items-center gap-2 cursor-default bg-transparent border-none p-0">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Recent Documents
              </TooltipTrigger>
              <TooltipContent>AI-generated benchmark reports and briefings ready for review.</TooltipContent>
            </Tooltip>
            <Link
              to="/documents"
              className="text-[11px] font-medium text-[var(--color-accent)] hover:underline flex items-center gap-1"
            >
              View All
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <div className="card-premium rounded-xl border border-border bg-card overflow-hidden">
            {recentDocuments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <FileText className="h-6 w-6 text-muted-foreground/40 mb-2" />
                <p className="text-[13px] text-muted-foreground">No documents generated yet</p>
                <p className="text-[11px] text-muted-foreground/70 mt-1">Documents appear here when reports are processed</p>
              </div>
            ) : (
              recentDocuments.map((doc, i) => {
                const badge = getDocStatusBadge(doc.status)
                const triggerName = doc.trigger_company?.name ?? 'Unknown'
                return (
                  <Link
                    key={doc.id}
                    to={`/documents/${doc.id}`}
                    className={`row-accent flex items-center gap-3 px-4 py-3 transition-colors duration-100 ${
                      i < recentDocuments.length - 1 ? 'border-b border-border/50' : ''
                    }`}
                  >
                    <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-[var(--color-bg-tertiary)] flex items-center justify-center">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-foreground truncate">
                        {doc.title || `${triggerName} Benchmark`}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {triggerName} · FY {doc.fiscal_year}
                        {doc.generated_at ? ` · ${getRelativeTime(doc.generated_at)}` : ''}
                      </div>
                    </div>
                    <span className={`flex-shrink-0 rounded px-2 py-0.5 text-[10px] font-medium ${badge.className}`}>
                      {badge.label}
                    </span>
                  </Link>
                )
              })
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <Tooltip>
            <TooltipTrigger className="text-[15px] font-semibold text-foreground mb-3 flex items-center gap-2 cursor-default bg-transparent border-none p-0">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Recent Activity
            </TooltipTrigger>
            <TooltipContent>Latest report uploads, status changes, and pipeline events.</TooltipContent>
          </Tooltip>
          <div className="card-premium rounded-xl border border-border bg-card px-5 py-2">
            {activityItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <Activity className="h-6 w-6 text-muted-foreground/40 mb-2" />
                <p className="text-[13px] text-muted-foreground">No recent activity</p>
              </div>
            ) : (
              activityItems.map((item, i) => (
                <ActivityItem
                  key={i}
                  icon={item.icon}
                  description={item.description}
                  time={getRelativeTime(item.time.toISOString())}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* Section 6: AI Insights                                            */}
      {/* ================================================================== */}
      <AiInsightsSection hasCompany={hasCompany} hasPeers={hasPeers} />
    </div>
    </>
    </TooltipProvider>
  )
}
