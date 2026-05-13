import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Building2,
  Globe,
  FileText,
  TrendingUp,
  ExternalLink,
  Calendar,
  Upload,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  AlertTriangle,
  Lightbulb,
  Eye,
  Newspaper,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Clock,
  CheckCircle2,
  Target,
  Zap,
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Loader2,
} from 'lucide-react'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { useAllCompanies, useKpiValues, useReports } from '@/hooks/useData'
import { usePrimaryCompany } from '@/hooks/useMyCompany'
import { useAccountingProfile } from '@/hooks/useAccountingProfile'
import { usePublicationEvents, useCreatePublicationEvent, useDeletePublicationEvent } from '@/hooks/useCalendar'
import { useSuggestDates } from '@/hooks/useAiSuggestions'
import { supabase } from '@/lib/supabase'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import { cn } from '@/lib/utils'
import type {
  KpiCategory,
  CompanyNews,
  AiInsight,
  AccountingPolicies,
} from '@/types/database'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** KPIs where lower = better (invert delta color) */
const LOWER_IS_BETTER = new Set([
  'NET_DEBT',
  'NET_DEBT_EBITDA',
  'DEBT_EQUITY',
  'CO2_INTENSITY',
  'CO2_EMISSIONS',
  'CAPEX',
])

const KPI_CATEGORY_GROUPS: { label: string; codes: string[] }[] = [
  { label: 'Profitability', codes: ['EBITDA', 'EBITDA_MARGIN', 'NET_INCOME', 'NET_INCOME_MARGIN', 'OPERATING_PROFIT'] },
  { label: 'Growth', codes: ['REVENUE', 'REVENUE_GROWTH'] },
  { label: 'Leverage', codes: ['NET_DEBT', 'NET_DEBT_EBITDA', 'DEBT_EQUITY'] },
  { label: 'Efficiency', codes: ['ROIC', 'ROE', 'CAPEX', 'CAPEX_REVENUE'] },
  { label: 'ESG', codes: ['CO2_INTENSITY', 'CO2_EMISSIONS', 'ENERGY_INTENSITY'] },
]

const RADAR_DIMENSIONS = ['Profitability', 'Growth', 'Leverage', 'Efficiency', 'Size', 'ESG']

const POLICY_LABELS: { key: keyof AccountingPolicies; label: string }[] = [
  { key: 'revenue_recognition', label: 'Revenue Recognition' },
  { key: 'rd_treatment', label: 'R&D Treatment' },
  { key: 'lease_treatment', label: 'Lease Treatment' },
  { key: 'ebitda_definition', label: 'EBITDA Definition' },
  { key: 'net_debt_definition', label: 'Net Debt Definition' },
  { key: 'goodwill_treatment', label: 'Goodwill Treatment' },
  { key: 'pension_accounting', label: 'Pension Accounting' },
  { key: 'fx_translation', label: 'FX Translation' },
  { key: 'segment_reporting', label: 'Segment Reporting' },
]

const INSIGHT_ICONS: Record<string, typeof TrendingUp> = {
  trend_reversal: TrendingUp,
  outlier: AlertTriangle,
  risk_flag: ShieldAlert,
  opportunity: Lightbulb,
}

const SENTIMENT_STYLES: Record<string, string> = {
  positive: 'bg-[var(--color-signal-green)]/10 text-[var(--color-signal-green)]',
  negative: 'bg-[var(--color-signal-red)]/10 text-[var(--color-signal-red)]',
  neutral: 'bg-muted text-muted-foreground',
  mixed: 'bg-[var(--color-signal-amber)]/10 text-[var(--color-signal-amber)]',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Company logo via Brandfetch Logo API (free 500K/mo, no key, no attribution) */
function companyLogoUrl(websiteUrl: string | null | undefined): string | null {
  if (!websiteUrl) return null
  try {
    const domain = new URL(websiteUrl).hostname.replace(/^www\./, '')
    return `https://logo.brandfetch.com/${domain}`
  } catch {
    return null
  }
}

function formatValue(value: number | null | undefined, unitType?: string): string {
  if (value == null) return '--'
  if (unitType === 'percentage') return `${value.toFixed(1)}%`
  if (unitType === 'ratio') return value.toFixed(2)
  if (unitType === 'intensity') return value.toFixed(2)
  return Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function deltaColor(delta: number, code: string): string {
  const inverted = LOWER_IS_BETTER.has(code)
  const better = inverted ? delta < 0 : delta > 0
  const worse = inverted ? delta > 0 : delta < 0
  if (better) return 'text-[var(--color-signal-green)]'
  if (worse) return 'text-[var(--color-signal-red)]'
  return 'text-muted-foreground'
}

function policyDescription(policy: unknown): string {
  if (!policy) return ''
  if (typeof policy === 'string') return policy
  const p = policy as Record<string, unknown>
  if (p.method && typeof p.method === 'string') return p.method
  if (p.description && typeof p.description === 'string') return p.description
  // EBITDA/NetDebt definitions
  if (Array.isArray(p.excludes)) return `Excludes: ${(p.excludes as string[]).join(', ')}`
  if (Array.isArray(p.includes)) return `Includes: ${(p.includes as string[]).join(', ')}`
  return JSON.stringify(policy)
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return `${Math.floor(days / 365)}y ago`
}

// Inline SVG sparkline from an array of numbers
function Sparkline({
  data,
  width = 80,
  height = 24,
  color = 'var(--color-accent)',
}: {
  data: number[]
  width?: number
  height?: number
  color?: string
}) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - ((v - min) / range) * (height - 4) - 2
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} className="inline-block align-middle">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CompanyProfilePage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  // Core data
  const { data: companies, isLoading: companiesLoading } = useAllCompanies()
  const { data: primaryCompany } = usePrimaryCompany()
  const { data: accountingProfile } = useAccountingProfile()
  const { data: reports } = useReports(id)
  const { data: events } = usePublicationEvents()

  const myCompanyId = primaryCompany?.company_id ?? undefined

  // KPI values for both peer and user's company
  const companyIds = useMemo(() => {
    const ids: string[] = []
    if (id) ids.push(id)
    if (myCompanyId && myCompanyId !== id) ids.push(myCompanyId)
    return ids
  }, [id, myCompanyId])

  const { data: kpiValues, isLoading: kpisLoading } = useKpiValues({ companyIds })

  // News
  const { data: news } = useQuery({
    queryKey: ['company-news', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_news')
        .select('*')
        .eq('company_id', id!)
        .eq('is_relevant', true)
        .order('published_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data as CompanyNews[]
    },
    enabled: !!id,
  })

  // AI Insights
  const { data: insights } = useQuery({
    queryKey: ['ai-insights-company', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_insights')
        .select('*')
        .eq('related_company_id', id!)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return data as AiInsight[]
    },
    enabled: !!id,
  })

  const company = useMemo(() => companies?.find((c) => c.id === id), [companies, id])

  // Organize KPI values by code, then by company, then by year
  type KpiRow = {
    code: string
    name: string
    category: KpiCategory
    unitType: string
    peerValues: Map<number, number>
    myValues: Map<number, number>
  }

  const kpiRows = useMemo(() => {
    if (!kpiValues) return [] as KpiRow[]
    const map = new Map<string, KpiRow>()

    for (const kv of kpiValues) {
      const def = kv.kpi_definitions
      const value = kv.normalized_value ?? kv.raw_value
      if (!def || value == null) continue

      if (!map.has(def.code)) {
        map.set(def.code, {
          code: def.code,
          name: def.name,
          category: def.category,
          unitType: def.unit_type,
          peerValues: new Map(),
          myValues: new Map(),
        })
      }
      const row = map.get(def.code)!
      if (kv.company_id === id) {
        row.peerValues.set(kv.fiscal_year, value)
      } else if (kv.company_id === myCompanyId) {
        row.myValues.set(kv.fiscal_year, value)
      }
    }
    return [...map.values()]
  }, [kpiValues, id, myCompanyId])

  const latestYear = useMemo(() => {
    if (kpiRows.length === 0) return null
    return Math.max(...kpiRows.flatMap((r) => [...r.peerValues.keys(), ...r.myValues.keys()]))
  }, [kpiRows])

  // Publication events for this company
  const companyEvents = useMemo(
    () =>
      (events ?? [])
        .filter((e) => e.company_id === id)
        .sort((a, b) => b.expected_date.localeCompare(a.expected_date)),
    [events, id],
  )

  // Latest report info for data freshness
  const latestReport = useMemo(() => {
    if (!reports || reports.length === 0) return null
    return reports[0] // already sorted by fiscal_year desc
  }, [reports])

  // Comparability check
  const accountingStandardMatch = useMemo(() => {
    if (!accountingProfile) return null
    // We only have the user's profile; for the peer we'd need a separate query
    // For now just show the user's standard
    return accountingProfile.accounting_standard
  }, [accountingProfile])

  // Radar chart data
  const radarData = useMemo(() => {
    if (!latestYear || kpiRows.length === 0) return []

    const dimScores = (companyId: 'peer' | 'my') => {
      const scores: Record<string, number[]> = {}
      for (const row of kpiRows) {
        const group = KPI_CATEGORY_GROUPS.find((g) => g.codes.includes(row.code))
        if (!group) continue
        const values = companyId === 'peer' ? row.peerValues : row.myValues
        const v = values.get(latestYear)
        if (v != null) {
          if (!scores[group.label]) scores[group.label] = []
          scores[group.label].push(v)
        }
      }
      return scores
    }

    const peerScores = dimScores('peer')
    const myScores = dimScores('my')

    // Normalize to 0-100 scale (simple: use rank among the two)
    return RADAR_DIMENSIONS.map((dim) => {
      const peerVals = peerScores[dim]
      const myVals = myScores[dim]
      const peerAvg = peerVals?.length ? peerVals.reduce((a, b) => a + b, 0) / peerVals.length : 0
      const myAvg = myVals?.length ? myVals.reduce((a, b) => a + b, 0) / myVals.length : 0
      const maxVal = Math.max(Math.abs(peerAvg), Math.abs(myAvg)) || 1
      return {
        dimension: dim,
        peer: peerVals?.length ? Math.round((Math.abs(peerAvg) / maxVal) * 100) : 0,
        you: myVals?.length ? Math.round((Math.abs(myAvg) / maxVal) * 100) : 0,
      }
    })
  }, [kpiRows, latestYear])

  const hasRadarData = radarData.some((d) => d.peer > 0 || d.you > 0)

  // Publication pattern detection
  const publicationPattern = useMemo(() => {
    const detected = companyEvents.filter((e) => e.actual_detected_at)
    if (detected.length < 2) return null
    const months = detected.map((e) => new Date(e.actual_detected_at!).getMonth())
    const modeCounts = new Map<number, number>()
    for (const m of months) modeCounts.set(m, (modeCounts.get(m) ?? 0) + 1)
    let maxCount = 0
    let modeMonth = 0
    for (const [m, c] of modeCounts) {
      if (c > maxCount) {
        maxCount = c
        modeMonth = m
      }
    }
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    return monthNames[modeMonth]
  }, [companyEvents])

  // Next expected publication
  const nextEvent = useMemo(() => {
    const now = new Date().toISOString().slice(0, 10)
    return companyEvents.find((e) => e.expected_date >= now && e.status !== 'detected')
  }, [companyEvents])

  const [now] = useState(() => Date.now())
  const nextEventCountdown = useMemo(() => {
    if (!nextEvent) return null
    const diff = new Date(nextEvent.expected_date).getTime() - now
    const days = Math.ceil(diff / 86400000)
    if (days <= 0) return 'Due today'
    if (days === 1) return 'Tomorrow'
    return `In ${days} days`
  }, [nextEvent, now])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (companiesLoading || kpisLoading) return <PageSkeleton />

  if (!company) {
    return (
      <>
        <Helmet>
          <title>Company Not Found - BenchmarkSignal</title>
        </Helmet>
        <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
          <Link
            to="/peers"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Peers
          </Link>
          <div className="card-premium rounded-xl border border-border bg-card p-12 text-center">
            <Building2 className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <h2 className="mt-3 text-lg font-semibold text-foreground">Company not found</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This company doesn't exist or you don't have access.
            </p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Helmet>
        <title>{company.name} - BenchmarkSignal</title>
      </Helmet>
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        {/* Back link */}
        <Link
          to="/peers"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Peers
        </Link>

        {/* ============================================================= */}
        {/* SECTION 1: Enhanced Company Identity Header                    */}
        {/* ============================================================= */}
        <div className="mb-6 card-premium card-accent-top rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                {companyLogoUrl(company.website_url) ? (
                  <img
                    src={companyLogoUrl(company.website_url)!}
                    alt=""
                    className="h-10 w-10 rounded-lg border border-border/50 bg-white object-contain p-1"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/50 bg-[var(--color-bg-tertiary)]">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">
                  {company.name}
                </h1>
                {company.ticker && (
                  <span className="rounded bg-[var(--color-bg-tertiary)] px-2 py-0.5 font-mono text-xs font-medium text-foreground">
                    {company.ticker}
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
                {company.exchange && <span>{company.exchange}</span>}
                {company.sector && (
                  <>
                    <span className="text-border">|</span>
                    <span>{company.sector}</span>
                  </>
                )}
                {company.country && (
                  <>
                    <span className="text-border">|</span>
                    <span>{company.country}</span>
                  </>
                )}
                {company.reporting_currency && (
                  <>
                    <span className="text-border">|</span>
                    <span>{company.reporting_currency}</span>
                  </>
                )}
              </div>

              {/* Links */}
              <div className="mt-3 flex flex-wrap gap-2">
                {company.website_url ? (
                  <a
                    href={company.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Globe className="h-3.5 w-3.5" /> Website{' '}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                    onClick={async () => {
                      const url = window.prompt('Enter website URL (e.g. https://www.holcim.com):')
                      if (!url?.trim()) return
                      try {
                        new URL(url.trim())
                      } catch {
                        alert('Please enter a valid URL starting with https://')
                        return
                      }
                      const { error } = await supabase
                        .from('companies')
                        .update({ website_url: url.trim() })
                        .eq('id', company.id)
                      if (error) {
                        alert('Failed to update: ' + error.message)
                      } else {
                        queryClient.invalidateQueries({ queryKey: ['companies-all'] })
                      }
                    }}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    Add website
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
                {company.ir_page_url && (
                  <a
                    href={company.ir_page_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <FileText className="h-3.5 w-3.5" /> Investor Relations{' '}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Right side: badges */}
            <div className="flex flex-col items-end gap-2">
              {/* Comparability */}
              {accountingStandardMatch && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-accent)]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--color-accent)]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {accountingStandardMatch}
                </div>
              )}
              {/* Data source */}
              <div className="text-right text-[11px]">
                {latestReport ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-signal-green)]/10 px-2.5 py-1 text-[var(--color-signal-green)]">
                    <FileText className="h-3 w-3" />
                    Based on Annual Report FY {latestReport.fiscal_year}
                    {latestReport.publication_date && (
                      <span className="text-[var(--color-signal-green)]/70"> &middot; {relativeTime(latestReport.publication_date)}</span>
                    )}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-signal-amber)]/10 px-2.5 py-1 text-[var(--color-signal-amber)]">
                    <Clock className="h-3 w-3" />
                    Awaiting report
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Info row */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <InfoCard label="Fiscal Year End" value={company.fiscal_year_end ?? '--'} />
            <InfoCard label="ISIN" value={company.isin ?? '--'} />
            <InfoCard label="KPIs Available" value={String(kpiRows.filter((r) => r.peerValues.size > 0).length)} />
            <InfoCard
              label="Reports"
              value={String(reports?.length ?? 0)}
            />
          </div>
        </div>

        {/* ============================================================= */}
        {/* SECTION 2: Head-to-Head Comparison Table                       */}
        {/* ============================================================= */}
        <SectionHeader icon={BarChart3} title="Head-to-Head Comparison" subtitle={latestYear ? `FY ${latestYear}` : undefined} />
        {kpiRows.length > 0 && latestYear ? (
          <div className="mb-6 card-premium rounded-xl border border-border bg-card overflow-x-auto">
            {(['financial', 'esg', 'operational'] as KpiCategory[]).map((cat) => {
              const rows = kpiRows.filter((r) => r.category === cat && r.peerValues.has(latestYear))
              if (rows.length === 0) return null
              return (
                <div key={cat}>
                  <div className="border-b border-border bg-[var(--color-bg-tertiary)] px-5 py-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      {cat}
                    </span>
                  </div>
                  {/* Table header */}
                  <div className="hidden sm:grid grid-cols-[1fr_100px_100px_90px_80px] gap-2 border-b border-border/50 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                    <span>KPI</span>
                    <span className="text-right">{primaryCompany ? 'You' : 'Your Co.'}</span>
                    <span className="text-right">Peer</span>
                    <span className="text-right">Delta</span>
                    <span className="text-right">Trend</span>
                  </div>
                  <div className="divide-y divide-border/30">
                    {rows.map((row) => {
                      const peerVal = row.peerValues.get(latestYear) ?? null
                      const myVal = row.myValues.get(latestYear) ?? null
                      const delta =
                        peerVal != null && myVal != null ? ((peerVal - myVal) / Math.abs(myVal)) * 100 : null
                      const prevPeerVal = row.peerValues.get(latestYear - 1) ?? null
                      const yoy =
                        peerVal != null && prevPeerVal != null
                          ? ((peerVal - prevPeerVal) / Math.abs(prevPeerVal)) * 100
                          : null

                      // Sparkline data for peer
                      const sparkData = [...row.peerValues.entries()]
                        .sort(([a], [b]) => a - b)
                        .map(([, v]) => v)

                      return (
                        <div
                          key={row.code}
                          className="grid grid-cols-2 sm:grid-cols-[1fr_100px_100px_90px_80px] gap-2 px-5 py-2.5 items-center"
                        >
                          <div className="col-span-2 sm:col-span-1">
                            <p className="text-[13px] font-medium text-foreground">{row.name}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-[13px] tabular-nums text-foreground">
                              {myVal != null ? formatValue(myVal, row.unitType) : (
                                <span className="text-[11px] text-muted-foreground/60">--</span>
                              )}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[13px] font-semibold tabular-nums text-foreground">
                              {formatValue(peerVal, row.unitType)}
                            </span>
                          </div>
                          <div className="text-right">
                            {delta != null && isFinite(delta) ? (
                              <span className={cn('text-[12px] tabular-nums', deltaColor(delta, row.code))}>
                                {delta > 0 ? '+' : ''}
                                {delta.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground/60">--</span>
                            )}
                          </div>
                          <div className="flex items-center justify-end gap-1.5">
                            {yoy != null && isFinite(yoy) ? (
                              <>
                                {yoy > 0 ? (
                                  <ArrowUpRight className="h-3 w-3 text-[var(--color-signal-green)]" />
                                ) : yoy < 0 ? (
                                  <ArrowDownRight className="h-3 w-3 text-[var(--color-signal-red)]" />
                                ) : (
                                  <Minus className="h-3 w-3 text-muted-foreground" />
                                )}
                                <Sparkline data={sparkData} width={48} height={18} />
                              </>
                            ) : (
                              <span className="text-[11px] text-muted-foreground/60">--</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {!myCompanyId && (
              <div className="border-t border-border px-5 py-3 text-center">
                <p className="text-[12px] text-muted-foreground">
                  <Link
                    to="/my-company"
                    className="font-medium text-[var(--color-accent)] hover:underline"
                  >
                    Upload your report
                  </Link>{' '}
                  to see a full comparison.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-6 card-premium rounded-xl border border-border bg-card p-6">
            <div className="flex flex-col items-center text-center max-w-md mx-auto">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-accent)]/10 mb-3">
                <BarChart3 className="h-6 w-6 text-[var(--color-accent)]" />
              </div>
              <h3 className="text-[15px] font-semibold text-foreground">Waiting for Report Data</h3>
              <p className="mt-1.5 text-[12px] text-muted-foreground leading-relaxed">
                KPI comparison, trends, and benchmarks will appear here once {company.name}'s annual report has been processed by the pipeline.
              </p>
              <div className="mt-4 w-full rounded-lg bg-[var(--color-bg-tertiary)] p-3 text-left">
                <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">What to expect</p>
                <ul className="space-y-1.5 text-[12px] text-muted-foreground">
                  <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-[var(--color-accent)] shrink-0" /> Side-by-side KPI comparison with your company</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-[var(--color-accent)] shrink-0" /> Year-over-year trends with sparklines</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-[var(--color-accent)] shrink-0" /> Delta analysis showing where you lead or lag</li>
                </ul>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {!company.ir_page_url && (
                  <span className="text-[11px] text-[var(--color-signal-amber)]">
                    Tip: Add an IR page URL in the publication schedule so the system can auto-detect new reports.
                  </span>
                )}
                <Link
                  to={`/peers?tab=upload&company=${company.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[var(--color-accent)]/90"
                >
                  <Upload className="h-3.5 w-3.5" /> Upload Report Manually
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* SECTION 3: Accounting Policy Comparison                        */}
        {/* ============================================================= */}
        <SectionHeader icon={BookOpen} title="Accounting Policy Comparison" />
        <div className="mb-6 card-premium rounded-xl border border-border bg-card">
          <div className="hidden sm:grid grid-cols-[180px_1fr_1fr_40px] gap-2 border-b border-border px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            <span>Policy Area</span>
            <span>Your Company</span>
            <span>Peer</span>
            <span className="text-center">Match</span>
          </div>
          <div className="divide-y divide-border/30">
            {POLICY_LABELS.map(({ key, label }) => {
              const myPolicy = accountingProfile?.policies?.[key]
              const myDesc = policyDescription(myPolicy)
              // Peer profile not available yet
              const peerDesc = ''
              const hasMyData = !!myDesc
              const hasPeerData = !!peerDesc

              return (
                <div
                  key={key}
                  className="grid grid-cols-1 sm:grid-cols-[180px_1fr_1fr_40px] gap-2 px-5 py-2.5 items-start"
                >
                  <span className="text-[13px] font-medium text-foreground">{label}</span>
                  <span className="text-[12px] text-muted-foreground line-clamp-2">
                    {hasMyData ? myDesc : (
                      <span className="italic text-muted-foreground/50">Not set</span>
                    )}
                  </span>
                  <span className="text-[12px] text-muted-foreground line-clamp-2">
                    {hasPeerData ? peerDesc : (
                      <span className="italic text-muted-foreground/50">Upload peer report</span>
                    )}
                  </span>
                  <div className="flex justify-center">
                    {hasMyData && hasPeerData ? (
                      myDesc === peerDesc ? (
                        <CheckCircle2 className="h-4 w-4 text-[var(--color-signal-green)]" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-[var(--color-signal-amber)]" />
                      )
                    ) : (
                      <ShieldQuestion className="h-4 w-4 text-muted-foreground/40" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ============================================================= */}
        {/* SECTION 4: KPI Trend Cards by Category                         */}
        {/* ============================================================= */}
        {kpiRows.length > 0 && latestYear && (
          <>
            <SectionHeader icon={TrendingUp} title="KPI Trends" />
            <div className="mb-6 space-y-4">
              {KPI_CATEGORY_GROUPS.map((group) => {
                const groupRows = kpiRows.filter(
                  (r) => group.codes.includes(r.code) && r.peerValues.size > 0,
                )
                if (groupRows.length === 0) return null
                return (
                  <div key={group.label}>
                    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      {group.label}
                    </h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {groupRows.map((row) => {
                        const current = row.peerValues.get(latestYear)
                        const prev = row.peerValues.get(latestYear - 1)
                        const yoy =
                          current != null && prev != null
                            ? ((current - prev) / Math.abs(prev)) * 100
                            : null
                        const sparkData = [...row.peerValues.entries()]
                          .sort(([a], [b]) => a - b)
                          .map(([, v]) => v)

                        return (
                          <div
                            key={row.code}
                            className="card-premium rounded-xl border border-border bg-card px-4 py-3"
                          >
                            <div className="flex items-start justify-between">
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                                  {row.name}
                                </p>
                                <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-foreground">
                                  {formatValue(current, row.unitType)}
                                </p>
                                {yoy != null && isFinite(yoy) && (
                                  <p
                                    className={cn(
                                      'mt-0.5 text-[12px] tabular-nums',
                                      deltaColor(yoy, row.code),
                                    )}
                                  >
                                    {yoy > 0 ? '+' : ''}
                                    {yoy.toFixed(1)}% YoY
                                  </p>
                                )}
                              </div>
                              <Sparkline data={sparkData} width={72} height={28} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ============================================================= */}
        {/* SECTION 5: Radar Chart — Peer vs Your Company                  */}
        {/* ============================================================= */}
        {hasRadarData && (
          <>
            <SectionHeader icon={Target} title="Profile Comparison" subtitle="Peer vs Your Company" />
            <div className="mb-6 card-premium card-accent-top rounded-xl border border-border bg-card p-5">
              <div className="mx-auto h-[300px] max-w-[480px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius="75%">
                    <PolarGrid stroke="var(--color-border)" />
                    <PolarAngleAxis
                      dataKey="dimension"
                      tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tick={false}
                      axisLine={false}
                    />
                    <Radar
                      name="Your Company"
                      dataKey="you"
                      stroke="var(--color-accent)"
                      fill="var(--color-accent)"
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                    <Radar
                      name={company.name}
                      dataKey="peer"
                      stroke="var(--color-signal-amber)"
                      fill="var(--color-signal-amber)"
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--color-card)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex items-center justify-center gap-6 text-[12px]">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-accent)]" />
                  Your Company
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-signal-amber)]" />
                  {company.name}
                </span>
              </div>
            </div>
          </>
        )}

        {/* ============================================================= */}
        {/* SECTION 6: Report Library                                       */}
        {/* ============================================================= */}
        <SectionHeader icon={FileText} title="Report Library" />
        {reports && reports.length > 0 ? (
          <div className="mb-6 card-premium rounded-xl border border-border bg-card">
            <div className="divide-y divide-border/30">
              {reports.map((report) => (
                <div key={report.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-medium text-foreground">
                        {report.title || `${report.report_type} FY ${report.fiscal_year}`}
                      </p>
                      <span className="rounded bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                        {report.report_type}
                      </span>
                      <StatusBadge status={report.status} />
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                      <span>FY {report.fiscal_year}</span>
                      {report.publication_date && <span>Published {report.publication_date}</span>}
                      {report.page_count && <span>{report.page_count} pages</span>}
                    </div>
                  </div>
                  {report.pdf_storage_path && (
                    <Link
                      to={`/reports/${report.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </Link>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-border px-5 py-3 text-center">
              <Link
                to={`/peers?tab=upload&company=${company.id}`}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-accent)] hover:underline"
              >
                <Upload className="h-3.5 w-3.5" /> Upload Report
              </Link>
            </div>
          </div>
        ) : (
          <div className="mb-6 card-premium rounded-xl border border-border bg-card p-6">
            <div className="flex flex-col items-center text-center max-w-md mx-auto">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-accent)]/10 mb-3">
                <FileText className="h-6 w-6 text-[var(--color-accent)]" />
              </div>
              <h3 className="text-[15px] font-semibold text-foreground">No Reports Yet</h3>
              <p className="mt-1.5 text-[12px] text-muted-foreground leading-relaxed">
                {company.name}'s annual report hasn't been processed yet. Once the pipeline detects and downloads it, KPIs will be extracted automatically and all sections on this page will populate.
              </p>
              <div className="mt-4 w-full rounded-lg bg-[var(--color-bg-tertiary)] p-3 text-left">
                <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">How reports get here</p>
                <ol className="space-y-1.5 text-[12px] text-muted-foreground list-decimal list-inside">
                  <li>The system monitors {company.name}'s IR page{company.ir_page_url ? '' : ' (URL not set yet)'}</li>
                  <li>When a new report is published, it's downloaded automatically</li>
                  <li>AI extracts all KPIs and accounting policies</li>
                  <li>This profile page fills with comparison data</li>
                </ol>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                <Link
                  to={`/peers?tab=upload&company=${company.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[var(--color-accent)]/90"
                >
                  <Upload className="h-3.5 w-3.5" /> Upload Report Manually
                </Link>
                <a
                  href="#publication-schedule"
                  onClick={(e) => { e.preventDefault(); document.getElementById('publication-schedule')?.scrollIntoView({ behavior: 'smooth' }) }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Calendar className="h-3.5 w-3.5" /> Set Publication Date
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* SECTION 7: Publication Schedule                                 */}
        {/* ============================================================= */}
        <PublicationScheduleSection
          companyId={id!}
          companyName={company.name}
          companyEvents={companyEvents}
          publicationPattern={publicationPattern}
          nextEvent={nextEvent}
          nextEventCountdown={nextEventCountdown}
        />

        {/* ============================================================= */}
        {/* SECTION 8: News Feed                                            */}
        {/* ============================================================= */}
        <SectionHeader icon={Newspaper} title="News Feed" />
        {news && news.length > 0 ? (
          <div className="mb-6 card-premium rounded-xl border border-border bg-card divide-y divide-border/30">
            {news.map((article) => (
              <div key={article.id} className="px-5 py-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] font-medium text-foreground hover:text-[var(--color-accent)] hover:underline"
                    >
                      {article.title}
                    </a>
                    {article.ai_summary && (
                      <p className="mt-0.5 text-[12px] text-muted-foreground line-clamp-2">
                        {article.ai_summary}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {article.published_at && (
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(article.published_at).toLocaleDateString('en', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      )}
                      {article.sentiment && (
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-medium',
                            SENTIMENT_STYLES[article.sentiment] ?? SENTIMENT_STYLES.neutral,
                          )}
                        >
                          {article.sentiment}
                        </span>
                      )}
                      {article.topics?.map((topic) => (
                        <span
                          key={topic}
                          className="rounded bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-6 card-premium rounded-xl border border-border bg-card p-6 text-center">
            <Newspaper className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <h3 className="mt-2 text-[15px] font-semibold text-foreground">No News Yet</h3>
            <p className="mt-1 text-[12px] text-muted-foreground">
              News articles about {company.name} will appear here once news monitoring is active.
            </p>
          </div>
        )}

        {/* ============================================================= */}
        {/* SECTION 9: AI Insights                                          */}
        {/* ============================================================= */}
        <SectionHeader icon={Zap} title="AI Insights" />
        {insights && insights.length > 0 ? (
          <div className="mb-6 space-y-3">
            {insights.map((insight) => {
              const Icon = INSIGHT_ICONS[insight.insight_type] ?? Lightbulb
              const priorityColor =
                insight.priority === 'high'
                  ? 'border-l-[var(--color-signal-red)]'
                  : insight.priority === 'medium'
                    ? 'border-l-[var(--color-signal-amber)]'
                    : 'border-l-[var(--color-accent)]'

              return (
                <div
                  key={insight.id}
                  className={cn(
                    'card-premium rounded-xl border border-border border-l-[3px] bg-card px-5 py-3',
                    priorityColor,
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-foreground">{insight.title}</p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">{insight.body}</p>
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        {insight.priority && (
                          <span className="uppercase tracking-[0.05em]">{insight.priority}</span>
                        )}
                        {insight.related_kpi_code && (
                          <>
                            <span className="text-border">|</span>
                            <span className="font-mono">{insight.related_kpi_code}</span>
                          </>
                        )}
                        {insight.fiscal_year && (
                          <>
                            <span className="text-border">|</span>
                            <span>FY {insight.fiscal_year}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="mb-6 card-premium rounded-xl border border-border bg-card p-6 text-center">
            <Zap className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <h3 className="mt-2 text-[15px] font-semibold text-foreground">No AI Insights Yet</h3>
            <p className="mt-1 text-[12px] text-muted-foreground max-w-sm mx-auto">
              AI-generated insights (trend reversals, outliers, opportunities) will appear here once {company.name}'s report data has been analyzed.
            </p>
          </div>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Sub-components (kept in same file per requirements)
// ---------------------------------------------------------------------------

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-[var(--color-bg-tertiary)] px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-[13px] font-semibold tabular-nums text-foreground truncate">
        {value}
      </div>
    </div>
  )
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof TrendingUp
  title: string
  subtitle?: string
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
      {subtitle && (
        <span className="rounded bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {subtitle}
        </span>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    extracted: 'bg-[var(--color-signal-green)]/10 text-[var(--color-signal-green)]',
    reviewed: 'bg-[var(--color-signal-green)]/10 text-[var(--color-signal-green)]',
    processing: 'bg-[var(--color-signal-amber)]/10 text-[var(--color-signal-amber)]',
    pending: 'bg-muted text-muted-foreground',
    error: 'bg-[var(--color-signal-red)]/10 text-[var(--color-signal-red)]',
  }
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-medium',
        styles[status] ?? styles.pending,
      )}
    >
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Publication Schedule Section — inline add/edit/delete + AI suggest
// ---------------------------------------------------------------------------

const REPORT_TYPES = [
  { value: 'annual', label: 'Annual' },
  { value: 'half_year', label: 'Half-Year' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'sustainability', label: 'Sustainability' },
] as const

const EVENT_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  due_today: 'Due Today',
  overdue: 'Overdue',
  detected: 'Detected',
  ingested: 'Ingested',
  benchmark_ready: 'Ready',
  cancelled: 'Cancelled',
}

const EVENT_STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-500/10 text-blue-400',
  due_today: 'bg-amber-500/10 text-amber-400',
  overdue: 'bg-red-500/10 text-red-400',
  detected: 'bg-green-500/10 text-green-400',
  ingested: 'bg-amber-500/10 text-amber-400',
  benchmark_ready: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
  cancelled: 'bg-zinc-500/10 text-zinc-400',
}

function PublicationScheduleSection({
  companyId,
  companyName,
  companyEvents,
  publicationPattern,
  nextEvent,
  nextEventCountdown,
}: {
  companyId: string
  companyName: string
  companyEvents: import('@/types/database').PublicationEvent[]
  publicationPattern: string | null
  nextEvent: import('@/types/database').PublicationEvent | undefined
  nextEventCountdown: string | null
}) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [addReportType, setAddReportType] = useState('annual')
  const [addFiscalYear, setAddFiscalYear] = useState(new Date().getFullYear())
  const [addDate, setAddDate] = useState('')
  const [addTime, setAddTime] = useState('07:00')
  const [suggestingId, setSuggestingId] = useState<string | null>(null)

  const createEvent = useCreatePublicationEvent()
  const deleteEvent = useDeletePublicationEvent()
  const suggestDates = useSuggestDates()

  const handleAdd = () => {
    if (!addDate) return
    createEvent.mutate(
      {
        company_id: companyId,
        report_type: addReportType,
        fiscal_year: addFiscalYear,
        expected_date: addDate,
        expected_time: addTime ? `${addTime}:00` : null,
      },
      {
        onSuccess: () => {
          setShowAddForm(false)
          setAddDate('')
          setAddReportType('annual')
        },
      },
    )
  }

  const handleSuggestNew = () => {
    setSuggestingId('new')
    suggestDates.mutate(
      {
        company_id: companyId,
        company_name: companyName,
        report_type: addReportType,
        fiscal_year: addFiscalYear,
      },
      {
        onSuccess: (data) => {
          setAddDate(data.suggestion.suggested_date)
          setAddTime(data.suggestion.suggested_time)
          setSuggestingId(null)
        },
        onError: () => setSuggestingId(null),
      },
    )
  }

  return (
    <div id="publication-schedule">
      <SectionHeader icon={Calendar} title="Publication Schedule" />
      <div className="mb-6 card-premium rounded-xl border border-border bg-card p-5">
        {/* Pattern + countdown header */}
        {(publicationPattern || nextEvent) && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            {publicationPattern && (
              <p className="text-[12px] text-muted-foreground">
                Typically publishes annual results in <span className="font-medium text-foreground">{publicationPattern}</span>
              </p>
            )}
            {nextEvent && nextEventCountdown && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-accent)]/10 px-3 py-1 text-[11px] font-semibold text-[var(--color-accent)]">
                <Clock className="h-3 w-3" />
                Next: {nextEvent.report_type} FY {nextEvent.fiscal_year} &middot; {nextEventCountdown}
              </span>
            )}
          </div>
        )}

        {/* Events table */}
        {companyEvents.length > 0 ? (
          <div className="space-y-2">
            {companyEvents.map((event) => (
              <div
                key={event.id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-lg border border-border/50 bg-[var(--color-bg-tertiary)]/50 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground">
                    {event.report_type.replace('_', ' ')} &middot; FY {event.fiscal_year}
                    {event.fiscal_quarter ? ` Q${event.fiscal_quarter}` : ''}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(event.expected_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    {event.expected_time ? ` at ${event.expected_time.slice(0, 5)} CET` : ''}
                  </p>
                </div>
                <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium', EVENT_STATUS_COLORS[event.status] ?? 'bg-muted text-muted-foreground')}>
                  {EVENT_STATUS_LABELS[event.status] ?? event.status}
                </span>
                <button
                  onClick={() => deleteEvent.mutate(event.id)}
                  className="shrink-0 rounded-lg p-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  aria-label="Delete event"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground mb-4">
            No publication dates scheduled. Add one so the system knows when to start monitoring for new reports.
          </p>
        )}

        {/* Add new event form */}
        {showAddForm ? (
          <div className="mt-4 rounded-lg border border-border bg-[var(--color-bg-tertiary)]/30 p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Report Type</label>
                <select
                  value={addReportType}
                  onChange={(e) => setAddReportType(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground"
                >
                  {REPORT_TYPES.map((rt) => (
                    <option key={rt.value} value={rt.value}>{rt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Fiscal Year</label>
                <input
                  type="number"
                  value={addFiscalYear}
                  onChange={(e) => setAddFiscalYear(parseInt(e.target.value))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Expected Date</label>
                <input
                  type="date"
                  value={addDate}
                  onChange={(e) => setAddDate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Time (CET)</label>
                <input
                  type="time"
                  value={addTime}
                  onChange={(e) => setAddTime(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSuggestNew}
                disabled={suggestingId === 'new'}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-[var(--color-bg-tertiary)] transition-colors disabled:opacity-40"
              >
                {suggestingId === 'new' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                AI Suggest Date
              </button>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="rounded-lg px-3 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!addDate || createEvent.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-[11px] font-medium text-white hover:bg-[var(--color-accent)]/90 transition-colors disabled:opacity-40"
                >
                  {createEvent.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Add Event
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-4 py-2.5 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors w-full justify-center"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Publication Date
          </button>
        )}
      </div>
    </div>
  )
}

// EmptyCard removed — replaced with inline contextual guidance per section
