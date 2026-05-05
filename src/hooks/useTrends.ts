import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Company, KpiDefinition, KpiValue } from '@/types/database'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrendDataPoint {
  fiscal_year: number
  value: number | null
  company_id: string
  company_name: string
}

export interface TrendSeries {
  kpi_code: string
  kpi_name: string
  unit_type: string
  data_points: TrendDataPoint[]
  peer_median_by_year: Record<number, number>
}

export interface CagrResult {
  kpi_code: string
  kpi_name: string
  company_id: string
  company_name: string
  start_year: number
  end_year: number
  start_value: number
  end_value: number
  cagr_pct: number
  periods: number
}

export interface MomentumResult {
  kpi_code: string
  kpi_name: string
  company_id: string
  company_name: string
  direction: 'improving' | 'stable' | 'declining'
  trailing_years: number
  avg_yoy_change_pct: number
}

// ---------------------------------------------------------------------------
// Multi-year KPI data for trend charts
// ---------------------------------------------------------------------------

export function useTrendData(params: {
  companyIds: string[]
  kpiCodes?: string[]
  startYear?: number
  endYear?: number
}) {
  return useQuery({
    queryKey: ['trend-data', params],
    queryFn: async () => {
      const startYear = params.startYear ?? new Date().getFullYear() - 5
      const endYear = params.endYear ?? new Date().getFullYear() - 1

      const query = supabase
        .from('kpi_values')
        .select('*, kpi_definitions(*), companies(*)')
        .in('company_id', params.companyIds)
        .gte('fiscal_year', startYear)
        .lte('fiscal_year', endYear)
        .order('fiscal_year')

      const { data, error } = await query
      if (error) throw error

      const rows = data as (KpiValue & { kpi_definitions: KpiDefinition; companies: Company })[]

      // Filter by KPI codes if specified
      let filtered = rows
      if (params.kpiCodes?.length) {
        const codeSet = new Set(params.kpiCodes)
        filtered = rows.filter((r) => codeSet.has(r.kpi_definitions?.code))
      }

      // Group by KPI
      const byKpi = new Map<string, TrendSeries>()
      for (const row of filtered) {
        const code = row.kpi_definitions.code
        if (!byKpi.has(code)) {
          byKpi.set(code, {
            kpi_code: code,
            kpi_name: row.kpi_definitions.name,
            unit_type: row.kpi_definitions.unit_type,
            data_points: [],
            peer_median_by_year: {},
          })
        }
        const series = byKpi.get(code)!
        series.data_points.push({
          fiscal_year: row.fiscal_year,
          value: row.normalized_value,
          company_id: row.company_id,
          company_name: row.companies.name,
        })
      }

      // Calculate peer median by year for each KPI
      for (const series of byKpi.values()) {
        const byYear = new Map<number, number[]>()
        for (const dp of series.data_points) {
          if (dp.value === null) continue
          if (!byYear.has(dp.fiscal_year)) byYear.set(dp.fiscal_year, [])
          byYear.get(dp.fiscal_year)!.push(dp.value)
        }
        for (const [year, values] of byYear) {
          values.sort((a, b) => a - b)
          const mid = Math.floor(values.length / 2)
          series.peer_median_by_year[year] = values.length % 2 !== 0
            ? values[mid]
            : (values[mid - 1] + values[mid]) / 2
        }
      }

      return Array.from(byKpi.values())
    },
    enabled: params.companyIds.length > 0,
  })
}

// ---------------------------------------------------------------------------
// CAGR calculation
// ---------------------------------------------------------------------------

export function useCagr(params: {
  companyIds: string[]
  kpiCodes?: string[]
  startYear?: number
  endYear?: number
}) {
  const { data: trends } = useTrendData(params)

  return useQuery({
    queryKey: ['cagr', params],
    queryFn: () => {
      if (!trends) return []

      const results: CagrResult[] = []
      const startYear = params.startYear ?? new Date().getFullYear() - 5
      const endYear = params.endYear ?? new Date().getFullYear() - 1

      for (const series of trends) {
        // Group by company
        const byCompany = new Map<string, { name: string; yearValues: Map<number, number> }>()
        for (const dp of series.data_points) {
          if (dp.value === null) continue
          if (!byCompany.has(dp.company_id)) {
            byCompany.set(dp.company_id, { name: dp.company_name, yearValues: new Map() })
          }
          byCompany.get(dp.company_id)!.yearValues.set(dp.fiscal_year, dp.value)
        }

        for (const [companyId, { name, yearValues }] of byCompany) {
          const startVal = yearValues.get(startYear)
          const endVal = yearValues.get(endYear)
          if (!startVal || !endVal || startVal <= 0) continue

          const periods = endYear - startYear
          const cagr = (Math.pow(endVal / startVal, 1 / periods) - 1) * 100

          results.push({
            kpi_code: series.kpi_code,
            kpi_name: series.kpi_name,
            company_id: companyId,
            company_name: name,
            start_year: startYear,
            end_year: endYear,
            start_value: startVal,
            end_value: endVal,
            cagr_pct: Math.round(cagr * 10) / 10,
            periods,
          })
        }
      }

      return results
    },
    enabled: !!trends && trends.length > 0,
  })
}

// ---------------------------------------------------------------------------
// Momentum indicators (trailing 3-year direction)
// ---------------------------------------------------------------------------

export function useMomentum(params: {
  companyIds: string[]
  kpiCodes?: string[]
  trailingYears?: number
}) {
  const endYear = new Date().getFullYear() - 1
  const trailing = params.trailingYears ?? 3
  const startYear = endYear - trailing

  const { data: trends } = useTrendData({
    ...params,
    startYear,
    endYear,
  })

  return useQuery({
    queryKey: ['momentum', params],
    queryFn: () => {
      if (!trends) return []

      const results: MomentumResult[] = []

      for (const series of trends) {
        const byCompany = new Map<string, { name: string; yearValues: Map<number, number> }>()
        for (const dp of series.data_points) {
          if (dp.value === null) continue
          if (!byCompany.has(dp.company_id)) {
            byCompany.set(dp.company_id, { name: dp.company_name, yearValues: new Map() })
          }
          byCompany.get(dp.company_id)!.yearValues.set(dp.fiscal_year, dp.value)
        }

        for (const [companyId, { name, yearValues }] of byCompany) {
          const yoyChanges: number[] = []
          for (let y = startYear + 1; y <= endYear; y++) {
            const prev = yearValues.get(y - 1)
            const curr = yearValues.get(y)
            if (prev && curr && prev !== 0) {
              yoyChanges.push(((curr - prev) / Math.abs(prev)) * 100)
            }
          }

          if (yoyChanges.length === 0) continue

          const avgChange = yoyChanges.reduce((s, v) => s + v, 0) / yoyChanges.length
          let direction: 'improving' | 'stable' | 'declining' = 'stable'
          if (avgChange > 3) direction = 'improving'
          else if (avgChange < -3) direction = 'declining'

          results.push({
            kpi_code: series.kpi_code,
            kpi_name: series.kpi_name,
            company_id: companyId,
            company_name: name,
            direction,
            trailing_years: trailing,
            avg_yoy_change_pct: Math.round(avgChange * 10) / 10,
          })
        }
      }

      return results
    },
    enabled: !!trends && trends.length > 0,
  })
}
