import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetchAllRows'
import { useVisibleCompanyIds } from './useVisibleCompanyIds'
import type {
  Company,
  KpiDefinition,
  KpiValue,
  PeerGroup,
  PeerGroupMember,
  Report,
  Extraction,
} from '@/types/database'

export function useCompanies() {
  const { data: visibleIds } = useVisibleCompanyIds()

  return useQuery({
    queryKey: ['companies', visibleIds],
    staleTime: 5 * 60 * 1000,
    enabled: !!visibleIds,
    queryFn: async () => {
      if (!visibleIds || visibleIds.length === 0) return [] as Company[]

      // Paginate past the PostgREST 1000-row cap so large peer sets aren't truncated.
      return fetchAllRows<Company>((from, to) =>
        supabase
          .from('companies')
          .select('*')
          .in('id', visibleIds)
          .eq('is_active', true)
          .order('name')
          .range(from, to),
      )
    },
  })
}

/** Fetch ALL active companies (not filtered by peer groups). Used during onboarding. */
export function useAllCompanies() {
  return useQuery({
    queryKey: ['companies-all'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () =>
      // Paginate past the PostgREST 1000-row cap (the full catalog can exceed 1000).
      fetchAllRows<Company>((from, to) =>
        supabase
          .from('companies')
          .select('*')
          .eq('is_active', true)
          .order('name')
          .range(from, to),
      ),
  })
}

export function useKpiDefinitions() {
  return useQuery({
    queryKey: ['kpi-definitions'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpi_definitions')
        .select('*')
        .eq('is_active', true)
        .order('display_order')
      if (error) throw error
      return data as KpiDefinition[]
    },
  })
}

export function usePeerGroups() {
  return useQuery({
    queryKey: ['peer-groups'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('peer_groups')
        .select('*, peer_group_members(*, companies(*))')
        .order('name')
      if (error) throw error
      return data as (PeerGroup & {
        peer_group_members: (PeerGroupMember & { companies: Company })[]
      })[]
    },
  })
}

export function useKpiValues(params: {
  companyIds?: string[]
  kpiCodes?: string[]
  fiscalYear?: number
}) {
  return useQuery({
    queryKey: ['kpi-values', params],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Use !inner join when filtering by kpiCodes to push filtering to PostgREST
      const selectClause = params.kpiCodes?.length
        ? '*, kpi_definitions!inner(*), companies(*)'
        : '*, kpi_definitions(*), companies(*)'

      // Paginate past the PostgREST 1000-row cap: kpi_values is high-cardinality
      // (companies × KPIs × years × quarters) and feeds benchmark math, so a silent
      // 1000-row truncation would produce wrong analytics.
      return fetchAllRows<KpiValue & {
        kpi_definitions: KpiDefinition
        companies: Company
      }>((from, to) => {
        let query = supabase
          .from('kpi_values')
          .select(selectClause)

        if (params.companyIds?.length) {
          query = query.in('company_id', params.companyIds)
        }
        if (params.fiscalYear) {
          query = query.eq('fiscal_year', params.fiscalYear)
        }
        if (params.kpiCodes?.length) {
          query = query.in('kpi_definitions.code', params.kpiCodes)
        }

        return query.order('company_id').range(from, to)
      })
    },
    enabled: !!(params.companyIds?.length || params.fiscalYear),
  })
}

export function useReports(companyId?: string) {
  const { data: visibleIds } = useVisibleCompanyIds()

  return useQuery({
    queryKey: ['reports', companyId, visibleIds],
    staleTime: 5 * 60 * 1000,
    enabled: !!companyId || !!visibleIds,
    queryFn: async () => {
      if (!companyId && !visibleIds?.length) return []

      // Paginate past the PostgREST 1000-row cap so the "Reports" count (reports.length)
      // reflects ALL reports rather than silently capping at 1000 (v11 Gate I).
      return fetchAllRows<Report & { companies: Company; extractions: Extraction[] }>((from, to) => {
        let query = supabase
          .from('reports')
          .select('*, companies(*), extractions(*)')
          .order('fiscal_year', { ascending: false })

        if (companyId) {
          query = query.eq('company_id', companyId)
        } else {
          query = query.in('company_id', visibleIds!)
        }

        return query.range(from, to)
      })
    },
  })
}
