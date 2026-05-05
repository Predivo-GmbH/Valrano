import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Company, KpiDefinition, KpiValue } from '@/types/database'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PivotCell {
  company_id: string
  company_name: string
  kpi_code: string
  kpi_name: string
  value: number | null
  fiscal_year: number
}

export interface ScatterPoint {
  company_id: string
  company_name: string
  x_value: number
  y_value: number
  x_kpi: string
  y_kpi: string
}

export interface HeatmapCell {
  company_id: string
  company_name: string
  kpi_code: string
  kpi_name: string
  value: number | null
  percentile: number
}

// ---------------------------------------------------------------------------
// Pivot data (companies x KPIs matrix)
// ---------------------------------------------------------------------------

export function usePivotData(params: {
  companyIds: string[]
  kpiCodes?: string[]
  fiscalYear?: number
}) {
  return useQuery({
    queryKey: ['pivot-data', params],
    queryFn: async () => {
      const fiscalYear = params.fiscalYear ?? new Date().getFullYear() - 1

      const query = supabase
        .from('kpi_values')
        .select('*, kpi_definitions(*), companies(*)')
        .in('company_id', params.companyIds)
        .eq('fiscal_year', fiscalYear)
        .order('company_id')

      const { data, error } = await query
      if (error) throw error

      const rows = data as (KpiValue & { kpi_definitions: KpiDefinition; companies: Company })[]

      let filtered = rows
      if (params.kpiCodes?.length) {
        const codeSet = new Set(params.kpiCodes)
        filtered = rows.filter((r) => codeSet.has(r.kpi_definitions?.code))
      }

      const cells: PivotCell[] = filtered.map((r) => ({
        company_id: r.company_id,
        company_name: r.companies.name,
        kpi_code: r.kpi_definitions.code,
        kpi_name: r.kpi_definitions.name,
        value: r.normalized_value,
        fiscal_year: r.fiscal_year,
      }))

      // Derive unique companies and KPIs for table headers
      const companies = [...new Map(cells.map((c) => [c.company_id, c.company_name])).entries()]
        .map(([id, name]) => ({ id, name }))
      const kpis = [...new Map(cells.map((c) => [c.kpi_code, c.kpi_name])).entries()]
        .map(([code, name]) => ({ code, name }))

      return { cells, companies, kpis, fiscalYear }
    },
    enabled: params.companyIds.length > 0,
  })
}

// ---------------------------------------------------------------------------
// Scatter plot data (any 2 KPIs plotted against each other)
// ---------------------------------------------------------------------------

export function useScatterData(params: {
  companyIds: string[]
  xKpiCode: string
  yKpiCode: string
  fiscalYear?: number
}) {
  return useQuery({
    queryKey: ['scatter-data', params],
    queryFn: async () => {
      const fiscalYear = params.fiscalYear ?? new Date().getFullYear() - 1

      const { data, error } = await supabase
        .from('kpi_values')
        .select('*, kpi_definitions(*), companies(*)')
        .in('company_id', params.companyIds)
        .eq('fiscal_year', fiscalYear)

      if (error) throw error

      const rows = data as (KpiValue & { kpi_definitions: KpiDefinition; companies: Company })[]

      // Group by company, find x and y values
      const byCompany = new Map<string, { name: string; x?: number; y?: number }>()
      for (const row of rows) {
        const code = row.kpi_definitions.code
        if (code !== params.xKpiCode && code !== params.yKpiCode) continue
        if (row.normalized_value === null) continue

        if (!byCompany.has(row.company_id)) {
          byCompany.set(row.company_id, { name: row.companies.name })
        }
        const entry = byCompany.get(row.company_id)!
        if (code === params.xKpiCode) entry.x = row.normalized_value
        if (code === params.yKpiCode) entry.y = row.normalized_value
      }

      const points: ScatterPoint[] = []
      for (const [companyId, { name, x, y }] of byCompany) {
        if (x !== undefined && y !== undefined) {
          points.push({
            company_id: companyId,
            company_name: name,
            x_value: x,
            y_value: y,
            x_kpi: params.xKpiCode,
            y_kpi: params.yKpiCode,
          })
        }
      }

      return points
    },
    enabled: params.companyIds.length > 0 && !!params.xKpiCode && !!params.yKpiCode,
  })
}

// ---------------------------------------------------------------------------
// Heatmap data (companies x KPIs with percentile coloring)
// ---------------------------------------------------------------------------

export function useHeatmapData(params: {
  companyIds: string[]
  kpiCodes?: string[]
  fiscalYear?: number
}) {
  return useQuery({
    queryKey: ['heatmap-data', params],
    queryFn: async () => {
      const fiscalYear = params.fiscalYear ?? new Date().getFullYear() - 1

      const { data, error } = await supabase
        .from('kpi_values')
        .select('*, kpi_definitions(*), companies(*)')
        .in('company_id', params.companyIds)
        .eq('fiscal_year', fiscalYear)

      if (error) throw error

      const rows = data as (KpiValue & { kpi_definitions: KpiDefinition; companies: Company })[]

      let filtered = rows
      if (params.kpiCodes?.length) {
        const codeSet = new Set(params.kpiCodes)
        filtered = rows.filter((r) => codeSet.has(r.kpi_definitions?.code))
      }

      // Calculate percentiles per KPI
      const valuesByKpi = new Map<string, number[]>()
      for (const row of filtered) {
        if (row.normalized_value === null) continue
        const code = row.kpi_definitions.code
        if (!valuesByKpi.has(code)) valuesByKpi.set(code, [])
        valuesByKpi.get(code)!.push(row.normalized_value)
      }
      for (const values of valuesByKpi.values()) {
        values.sort((a, b) => a - b)
      }

      const cells: HeatmapCell[] = filtered.map((row) => {
        const code = row.kpi_definitions.code
        const val = row.normalized_value
        const sorted = valuesByKpi.get(code) ?? []
        let percentile = 50
        if (val !== null && sorted.length > 0) {
          const below = sorted.filter((v) => v < val).length
          percentile = Math.round((below / sorted.length) * 100)
        }

        return {
          company_id: row.company_id,
          company_name: row.companies.name,
          kpi_code: code,
          kpi_name: row.kpi_definitions.name,
          value: val,
          percentile,
        }
      })

      const companies = [...new Map(cells.map((c) => [c.company_id, c.company_name])).entries()]
        .map(([id, name]) => ({ id, name }))
      const kpis = [...new Map(cells.map((c) => [c.kpi_code, c.kpi_name])).entries()]
        .map(([code, name]) => ({ code, name }))

      return { cells, companies, kpis, fiscalYear }
    },
    enabled: params.companyIds.length > 0,
  })
}
