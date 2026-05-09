import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  useAccountingProfile,
  useAnalyzeAccountingProfile,
  useDeleteAccountingProfile,
} from '@/hooks/useAccountingProfile'
import { useReports } from '@/hooks/useData'
import type { AccountingPolicies, KpiMapping } from '@/types/database'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'

// ---------------------------------------------------------------------------
// Policy display config
// ---------------------------------------------------------------------------

const POLICY_LABELS: Record<string, { label: string; description: string }> = {
  revenue_recognition: {
    label: 'Revenue Recognition',
    description: 'How revenue is recognized (over time, point-in-time, etc.)',
  },
  rd_treatment: {
    label: 'R&D Treatment',
    description: 'Whether R&D costs are capitalized or expensed',
  },
  lease_treatment: {
    label: 'Lease Accounting',
    description: 'On-balance-sheet (IFRS 16) or operating leases',
  },
  ebitda_definition: {
    label: 'EBITDA Definition',
    description: 'What is included/excluded from EBITDA calculation',
  },
  net_debt_definition: {
    label: 'Net Debt Definition',
    description: 'Components of net debt calculation',
  },
  goodwill_treatment: {
    label: 'Goodwill Treatment',
    description: 'Impairment-only testing or systematic amortization',
  },
  pension_accounting: {
    label: 'Pension Accounting',
    description: 'Method used for pension obligations',
  },
  fx_translation: {
    label: 'FX Translation',
    description: 'Foreign currency translation method',
  },
  segment_reporting: {
    label: 'Segment Reporting',
    description: 'How business segments are reported',
  },
}

const KPI_LABELS: Record<string, string> = {
  REVENUE: 'Revenue',
  EBITDA: 'EBITDA',
  EBITDA_ADJ: 'Adjusted EBITDA',
  EBITDA_MARGIN: 'EBITDA Margin',
  EBIT: 'EBIT',
  NET_INCOME: 'Net Income',
  EPS_BASIC: 'Basic EPS',
  NET_DEBT: 'Net Debt',
  NET_DEBT_EBITDA: 'Net Debt / EBITDA',
  ROIC: 'ROIC',
  CAPEX: 'Capital Expenditure',
  CO2_ABSOLUTE: 'CO2 Emissions',
  CO2_INTENSITY: 'CO2 Intensity',
  LTIFR: 'LTIFR',
  CEMENT_VOLUME: 'Cement Volume',
}

// ---------------------------------------------------------------------------
// Policy Card Component
// ---------------------------------------------------------------------------

function PolicyCard({
  policyKey,
  policy,
}: {
  policyKey: string
  policy: Record<string, unknown>
}) {
  const [expanded, setExpanded] = useState(false)
  const meta = POLICY_LABELS[policyKey]
  if (!meta) return null

  const sourcePage = policy.source_page as number | undefined
  const method = (policy.method as string) ?? (policy.standard as string) ?? (policy.basis as string)

  return (
    <div className="rounded-lg border border-border bg-[var(--color-bg-tertiary)]/30 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[var(--color-bg-tertiary)]/50 transition-colors"
      >
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-foreground">{meta.label}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{meta.description}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          {method && (
            <span className="rounded bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--color-accent)]">
              {method.replace(/_/g, ' ')}
            </span>
          )}
          {sourcePage && (
            <span className="text-[9px] text-muted-foreground">p.{sourcePage}</span>
          )}
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/50 px-4 py-3 space-y-2">
          {Object.entries(policy).map(([key, value]) => {
            if (key === 'source_page') return null
            return (
              <div key={key} className="flex items-start gap-2">
                <span className="text-[10px] text-muted-foreground font-medium min-w-[100px] flex-shrink-0">
                  {key.replace(/_/g, ' ')}
                </span>
                <span className="text-[11px] text-foreground">
                  {Array.isArray(value)
                    ? value.join(', ')
                    : typeof value === 'boolean'
                    ? value ? 'Yes' : 'No'
                    : String(value)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// KPI Mapping Row
// ---------------------------------------------------------------------------

function KpiMappingRow({ code, mapping }: { code: string; mapping: KpiMapping }) {
  const label = KPI_LABELS[code] ?? code

  return (
    <tr className="border-b border-border/30 last:border-0">
      <td className="px-3 py-2 text-[11px] font-medium text-foreground">{label}</td>
      <td className="px-3 py-2 text-[11px] text-muted-foreground">{mapping.formula}</td>
      <td className="px-3 py-2 text-[11px] text-muted-foreground">
        {mapping.label_in_report ?? '—'}
      </td>
      <td className="px-3 py-2 text-[10px] text-muted-foreground text-center">
        {mapping.source_page ? `p.${mapping.source_page}` : '—'}
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function AccountingProfilePage() {
  const { data: profile, isLoading } = useAccountingProfile()
  const { data: reports } = useReports()
  const analyzeMutation = useAnalyzeAccountingProfile()
  const deleteMutation = useDeleteAccountingProfile()

  const [selectedReportId, setSelectedReportId] = useState<string>('')
  const [showKpiMappings, setShowKpiMappings] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  // Filter to user's own company reports (annual type preferred)
  const ownReports = (reports ?? [])
    .filter((r) => r.pdf_storage_path)
    .sort((a, b) => b.fiscal_year - a.fiscal_year)

  const handleAnalyze = () => {
    if (!selectedReportId) return
    analyzeMutation.mutate({ reportId: selectedReportId })
  }

  const handleReAnalyze = () => {
    if (!profile?.source_report_id) return
    analyzeMutation.mutate({ reportId: profile.source_report_id })
  }

  const handleDelete = () => {
    if (!profile) return
    setConfirmDeleteOpen(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // ------------------------------------------------------------------
  // No profile yet — Setup CTA
  // ------------------------------------------------------------------
  if (!profile) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-accent)]/10">
              <BookOpen className="h-5 w-5 text-[var(--color-accent)]" />
            </div>
            <div className="flex-1">
              <h3 className="text-[15px] font-semibold text-foreground">
                Set up your Accounting Profile
              </h3>
              <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed max-w-xl">
                Upload your company's annual report and our AI will analyze your accounting
                framework — standards, policies, and KPI calculation methods. This profile is used
                to normalize competitor data so you get true apples-to-apples comparisons.
              </p>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Select your annual report
                  </label>
                  <select
                    value={selectedReportId}
                    onChange={(e) => setSelectedReportId(e.target.value)}
                    className="mt-1 block w-full max-w-sm rounded-lg border border-border bg-[var(--color-bg-tertiary)] px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  >
                    <option value="">Choose a report...</option>
                    {ownReports.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title ?? `Report FY ${r.fiscal_year}`} ({r.report_type}, FY{r.fiscal_year})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={!selectedReportId || analyzeMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 text-[13px] font-medium text-background transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {analyzeMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing report...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Analyze Accounting Framework
                    </>
                  )}
                </button>

                {analyzeMutation.isError && (
                  <p className="text-[12px] text-[var(--color-signal-red)]">
                    {(analyzeMutation.error as Error).message}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {ownReports.length === 0 && (
          <div className="rounded-lg border border-dashed border-border/50 bg-card/50 p-6 text-center">
            <FileText className="mx-auto h-6 w-6 text-muted-foreground/50 mb-2" />
            <p className="text-[12px] text-muted-foreground mb-3">
              No reports with PDFs found. Upload your company's annual report first to analyze your accounting framework.
            </p>
            <Link
              to="/peers"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3.5 py-1.5 text-[11px] font-medium text-white transition-all hover:opacity-90"
            >
              <Upload className="h-3 w-3" />
              Upload Report
            </Link>
          </div>
        )}
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Profile exists — Display it
  // ------------------------------------------------------------------
  const policies = profile.policies as AccountingPolicies
  const kpiMappings = profile.kpi_mappings as Record<string, KpiMapping>
  const policyEntries = Object.entries(policies).filter(
    ([, v]) => v && typeof v === 'object',
  )
  const kpiMappingEntries = Object.entries(kpiMappings).filter(
    ([, v]) => v && typeof v === 'object',
  )

  return (
    <div className="space-y-6">
      {/* Profile header */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-accent)]/10">
              <BookOpen className="h-4.5 w-4.5 text-[var(--color-accent)]" />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-foreground">
                {profile.company_name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="rounded bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--color-accent)]">
                  {profile.accounting_standard.replace(/_/g, ' ')}
                </span>
                {profile.accounting_standard_confidence !== null && (
                  <span className="text-[10px] text-muted-foreground">
                    {Math.round(profile.accounting_standard_confidence * 100)}% confidence
                  </span>
                )}
                {profile.manually_edited && (
                  <span className="text-[9px] text-muted-foreground italic">manually edited</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReAnalyze}
              disabled={analyzeMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-[var(--color-bg-tertiary)] transition-colors disabled:opacity-40"
            >
              {analyzeMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Re-analyze
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-[var(--color-signal-red)] hover:border-[var(--color-signal-red)]/30 transition-colors disabled:opacity-40"
            >
              <Trash2 className="h-3 w-3" />
              Remove
            </button>
          </div>
        </div>

        {/* Source report info */}
        {profile.source_report_title && (
          <div className="px-5 py-2.5 border-b border-border/50 bg-[var(--color-bg-tertiary)]/20">
            <span className="text-[10px] text-muted-foreground">
              Source: {profile.source_report_title}
              {profile.extracted_at && (
                <> · Analyzed {new Date(profile.extracted_at).toLocaleDateString()}</>
              )}
              {profile.ai_model && <> · {profile.ai_model}</>}
            </span>
          </div>
        )}

        {/* Accounting policies */}
        <div className="px-5 py-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Accounting Policies ({policyEntries.length} detected)
          </h4>
          <div className="space-y-2">
            {policyEntries.map(([key, value]) => (
              <PolicyCard
                key={key}
                policyKey={key}
                policy={value as Record<string, unknown>}
              />
            ))}
            {policyEntries.length === 0 && (
              <p className="text-[12px] text-muted-foreground py-4 text-center">
                No policies were extracted. Try re-analyzing with a different report.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* KPI Mappings */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button
          onClick={() => setShowKpiMappings(!showKpiMappings)}
          className="flex w-full items-center justify-between px-5 py-3 hover:bg-[var(--color-bg-tertiary)]/30 transition-colors"
        >
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            KPI Calculation Methods ({kpiMappingEntries.length} mapped)
          </h4>
          {showKpiMappings ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {showKpiMappings && kpiMappingEntries.length > 0 && (
          <div className="border-t border-border overflow-x-auto">
            <table className="table-premium w-full min-w-max border-collapse">
              <thead>
                <tr className="border-b border-border bg-[var(--color-bg-tertiary)]/20">
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    KPI
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Formula / Method
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Label in Report
                  </th>
                  <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Source
                  </th>
                </tr>
              </thead>
              <tbody>
                {kpiMappingEntries.map(([code, mapping]) => (
                  <KpiMappingRow key={code} code={code} mapping={mapping as KpiMapping} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* How this profile is used */}
      <div className="rounded-lg border border-dashed border-border/50 bg-card/50 p-4">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground">How this profile is used:</strong> When competitor
          reports are processed, the AI uses your accounting framework to normalize their data.
          For example, if you exclude restructuring charges from EBITDA but a competitor includes
          them, the system will adjust their EBITDA to match your definition — giving you a true
          apples-to-apples comparison.
        </p>
      </div>

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Remove accounting profile"
        description="Remove your accounting profile? This cannot be undone."
        onConfirm={() => { if (profile) deleteMutation.mutate(profile.id) }}
        isPending={deleteMutation.isPending}
      />
    </div>
  )
}
