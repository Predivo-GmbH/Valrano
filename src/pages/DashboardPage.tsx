import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useCompanies, useKpiDefinitions, useKpiValues } from '@/hooks/useData'
import { usePrimaryCompany } from '@/hooks/useMyCompany'
import type { Company, KpiDefinition, KpiValue, KpiCategory } from '@/types/database'
import { formatKpiValue } from '@/lib/format'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload } from 'lucide-react'

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
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ fiscalYear }: { fiscalYear: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="mb-4 rounded-full bg-[var(--color-bg-tertiary)] p-4">
        <Upload className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-[15px] font-semibold text-foreground">No data available</h3>
      <p className="mb-6 text-[13px] text-muted-foreground max-w-sm">
        No data available for FY {fiscalYear}. Upload an annual report or try a different year.
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
                "{value.source_text.slice(0, 120)}{value.source_text.length > 120 ? '…' : ''}"
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
// Main dashboard page
// ---------------------------------------------------------------------------

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)

const CATEGORY_LABELS: Record<KpiCategory, string> = {
  financial: 'Financial',
  esg: 'ESG',
  operational: 'Operational',
}

export function DashboardPage() {
  const [fiscalYear, setFiscalYear] = useState<number>(CURRENT_YEAR - 1)
  const [activeCategory, setActiveCategory] = useState<ActiveCategory>('financial')

  const { data: primaryCompanyData } = usePrimaryCompany()
  const primaryCompanyName = primaryCompanyData?.name ?? null

  const { data: companies, isLoading: companiesLoading } = useCompanies()
  const { data: kpiDefs, isLoading: defsLoading } = useKpiDefinitions()
  const { data: kpiValues, isLoading: valuesLoading } = useKpiValues({
    fiscalYear,
    companyIds: companies?.map((c) => c.id),
  })

  const isLoading = companiesLoading || defsLoading || valuesLoading

  // Filter KPI definitions by active category
  const filteredDefs = useMemo(() => {
    if (!kpiDefs) return []
    if (activeCategory === 'all') return kpiDefs
    return kpiDefs.filter((d) => d.category === activeCategory)
  }, [kpiDefs, activeCategory])

  // Build lookup: company_id + kpi_definition_id → KpiValue row
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

  const hasData = !isLoading && companies && companies.length > 0 && kpiValues && kpiValues.length > 0

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-8">

      {/* Page header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">
            Peer Comparison
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Normalized to CHF · Annual reports · Hover values for source reference
          </p>
        </div>

        {/* Fiscal year selector */}
        <Select
          value={String(fiscalYear)}
          onValueChange={(v) => { if (v) setFiscalYear(Number(v)) }}
        >
          <SelectTrigger className="w-[120px] rounded-lg border-border bg-card text-[13px] text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-lg border-border bg-card text-[13px]">
            {YEAR_OPTIONS.map((y) => (
              <SelectItem key={y} value={String(y)} className="text-[13px]">
                FY {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI category tabs */}
      <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as ActiveCategory)}>
        <TabsList className="mb-6 h-9 rounded-lg bg-[var(--color-bg-tertiary)] p-1">
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
          ) : !hasData ? (
            <EmptyState fiscalYear={fiscalYear} />
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
        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          Showing {CATEGORY_LABELS[activeCategory as KpiCategory]} KPIs · FY {fiscalYear}
        </p>
      )}
    </div>
  )
}
