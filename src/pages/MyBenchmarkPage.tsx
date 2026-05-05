import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, TrendingDown, Minus, ArrowLeft, Zap, Target, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import {
  usePrimaryCompany,
  useMyCompanyKpis,
  useRunSelfBenchmark,
  useLatestSelfBenchmark,
} from '@/hooks/useMyCompany'
import { usePeerGroups } from '@/hooks/useData'

export function MyBenchmarkPage() {
  const navigate = useNavigate()
  const { data: primaryCompany, isLoading: companyLoading } = usePrimaryCompany()
  const { data: peerGroups } = usePeerGroups()
  const currentYear = new Date().getFullYear() - 1
  const [fiscalYear, setFiscalYear] = useState(currentYear)
  const [peerGroupId, setPeerGroupId] = useState<string>('')

  const { data: kpis } = useMyCompanyKpis(primaryCompany?.id, fiscalYear)
  const { data: latestBenchmark, isLoading: benchmarkLoading } = useLatestSelfBenchmark(primaryCompany?.id)
  const runBenchmark = useRunSelfBenchmark()

  const [liveResult, setLiveResult] = useState<ReturnType<typeof runBenchmark.mutateAsync> extends Promise<infer T> ? T : never>(null as never)

  // Use live result if available, otherwise latest stored
  const benchmarkData = liveResult ?? (latestBenchmark ? {
    company_name: primaryCompany?.name ?? '',
    fiscal_year: latestBenchmark.fiscal_year,
    peer_count: (latestBenchmark.results_json as { peer_company_count?: number })?.peer_company_count ?? 0,
    kpi_percentiles: (latestBenchmark.results_json as { kpi_percentiles?: unknown[] })?.kpi_percentiles ?? [],
    strengths: ((latestBenchmark.results_json as { kpi_percentiles?: Array<{ signal: string; kpi_name: string; percentile: number }> })?.kpi_percentiles ?? []).filter((k) => k.signal === 'strength'),
    weaknesses: ((latestBenchmark.results_json as { kpi_percentiles?: Array<{ signal: string; kpi_name: string; percentile: number }> })?.kpi_percentiles ?? []).filter((k) => k.signal === 'weakness'),
    ai_narrative: latestBenchmark.ai_narrative ?? '',
    overall_percentile: null as number | null,
  } : null)

  function handleRunBenchmark() {
    if (!primaryCompany) {
      toast.error('Add a company first')
      return
    }
    if (!kpis || kpis.length === 0) {
      toast.error('Enter KPI data first')
      navigate('/my-company')
      return
    }

    runBenchmark.mutate(
      {
        my_company_id: primaryCompany.id,
        peer_group_id: peerGroupId || undefined,
        fiscal_year: fiscalYear,
      },
      {
        onSuccess: (data) => {
          setLiveResult(data)
          toast.success('Benchmark generated')
        },
        onError: (err) => toast.error(`Failed: ${err.message}`),
      }
    )
  }

  if (companyLoading || benchmarkLoading) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <div className="py-20 text-center text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!primaryCompany) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <h3 className="text-lg font-semibold text-foreground">No company set up</h3>
          <p className="mt-2 text-sm text-muted-foreground">Add your company first to run a benchmark.</p>
          <button
            onClick={() => navigate('/my-company')}
            className="mt-4 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white"
          >
            Add Company
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <Helmet><title>My Benchmark - BenchmarkSignal</title></Helmet>
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/my-company')}
            className="mb-3 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to My Company
          </button>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            {primaryCompany.name} — Benchmark
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            See how your company compares against industry peers.
          </p>
        </div>

        {/* Controls */}
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
            value={peerGroupId}
            onChange={(e) => setPeerGroupId(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="">Auto (sector match)</option>
            {(peerGroups ?? []).map((pg) => (
              <option key={pg.id} value={pg.id}>{pg.name}</option>
            ))}
          </select>

          <button
            onClick={handleRunBenchmark}
            disabled={runBenchmark.isPending}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            <Zap className="h-4 w-4" />
            {runBenchmark.isPending ? 'Analyzing...' : 'Run Benchmark'}
          </button>
        </div>

        {/* Results */}
        {benchmarkData ? (
          <div className="space-y-6">
            {/* Overall Score */}
            {benchmarkData.overall_percentile !== null && (
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Overall Percentile</p>
                <p className={`mt-2 text-5xl font-bold ${
                  benchmarkData.overall_percentile >= 70 ? 'text-green-500' :
                  benchmarkData.overall_percentile <= 30 ? 'text-red-500' :
                  'text-foreground'
                }`}>
                  P{benchmarkData.overall_percentile}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  vs. {benchmarkData.peer_count} peer companies · FY{benchmarkData.fiscal_year}
                </p>
              </div>
            )}

            {/* Strengths & Weaknesses */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  <h3 className="font-semibold text-foreground">Strengths</h3>
                </div>
                {benchmarkData.strengths.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No KPIs in P70+</p>
                ) : (
                  <ul className="space-y-1.5">
                    {benchmarkData.strengths.map((s: { kpi_name: string; percentile: number }) => (
                      <li key={s.kpi_name} className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{s.kpi_name}</span>
                        <span className="font-medium text-green-500">P{s.percentile}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                  <h3 className="font-semibold text-foreground">Areas for Improvement</h3>
                </div>
                {benchmarkData.weaknesses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No KPIs below P30</p>
                ) : (
                  <ul className="space-y-1.5">
                    {benchmarkData.weaknesses.map((w: { kpi_name: string; percentile: number }) => (
                      <li key={w.kpi_name} className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{w.kpi_name}</span>
                        <span className="font-medium text-red-500">P{w.percentile}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* KPI Percentile Table */}
            {(benchmarkData.kpi_percentiles as Array<{
              kpi_name: string
              my_value: number
              peer_median: number
              percentile: number
              gap_to_median_pct: number
              signal: string
              peer_count: number
            }>).length > 0 && (
              <div className="rounded-xl border border-border bg-card">
                <div className="border-b border-border px-5 py-3">
                  <h3 className="font-semibold text-foreground">KPI Comparison</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <th className="px-5 py-3 text-left">KPI</th>
                        <th className="px-5 py-3 text-right">Your Value</th>
                        <th className="px-5 py-3 text-right">Peer Median</th>
                        <th className="px-5 py-3 text-right">Gap</th>
                        <th className="px-5 py-3 text-center">Percentile</th>
                        <th className="px-5 py-3 text-center">Signal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(benchmarkData.kpi_percentiles as Array<{
                        kpi_name: string
                        my_value: number
                        peer_median: number
                        percentile: number
                        gap_to_median_pct: number
                        signal: string
                        peer_count: number
                      }>).map((kpi) => (
                        <tr key={kpi.kpi_name} className="border-b border-border/50 last:border-0">
                          <td className="px-5 py-3 font-medium text-foreground">{kpi.kpi_name}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-foreground">
                            {kpi.my_value.toLocaleString()}
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                            {kpi.peer_median.toLocaleString()}
                          </td>
                          <td className={`px-5 py-3 text-right tabular-nums font-medium ${
                            kpi.gap_to_median_pct > 0 ? 'text-green-500' :
                            kpi.gap_to_median_pct < 0 ? 'text-red-500' :
                            'text-muted-foreground'
                          }`}>
                            {kpi.gap_to_median_pct > 0 ? '+' : ''}{kpi.gap_to_median_pct}%
                          </td>
                          <td className="px-5 py-3 text-center">
                            <PercentileBar value={kpi.percentile} />
                          </td>
                          <td className="px-5 py-3 text-center">
                            <SignalBadge signal={kpi.signal} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* AI Narrative */}
            {benchmarkData.ai_narrative && (
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="mb-3 flex items-center gap-2">
                  <Target className="h-5 w-5 text-[var(--color-primary)]" />
                  <h3 className="font-semibold text-foreground">Executive Summary</h3>
                </div>
                <div className="prose prose-sm max-w-none text-muted-foreground dark:prose-invert">
                  {benchmarkData.ai_narrative.split('\n\n').map((paragraph: string, i: number) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <h3 className="mt-3 text-lg font-semibold text-foreground">No benchmark yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {kpis && kpis.length > 0
                ? 'Click "Run Benchmark" to analyze your position against peers.'
                : 'Enter your KPI data first, then run a benchmark.'}
            </p>
          </div>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PercentileBar({ value }: { value: number }) {
  const color = value >= 70 ? 'bg-green-500' : value <= 30 ? 'bg-red-500' : 'bg-[var(--color-primary)]'
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">P{value}</span>
    </div>
  )
}

function SignalBadge({ signal }: { signal: string }) {
  if (signal === 'strength') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-500">
        <TrendingUp className="h-3 w-3" /> Strong
      </span>
    )
  }
  if (signal === 'weakness') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-500">
        <TrendingDown className="h-3 w-3" /> Weak
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      <Minus className="h-3 w-3" /> Neutral
    </span>
  )
}
