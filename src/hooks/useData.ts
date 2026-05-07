import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type {
  Company,
  KpiDefinition,
  KpiValue,
  PeerGroup,
  PeerGroupMember,
  Report,
} from '@/types/database'

export function useCompanies() {
  return useQuery({
    queryKey: ['companies'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data as Company[]
    },
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
    queryFn: async () => {
      // Use !inner join when filtering by kpiCodes to push filtering to PostgREST
      const selectClause = params.kpiCodes?.length
        ? '*, kpi_definitions!inner(*), companies(*)'
        : '*, kpi_definitions(*), companies(*)'

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

      const { data, error } = await query.order('company_id')
      if (error) throw error

      return data as (KpiValue & {
        kpi_definitions: KpiDefinition
        companies: Company
      })[]
    },
    enabled: !!(params.companyIds?.length || params.fiscalYear),
  })
}

export function useReports(companyId?: string) {
  return useQuery({
    queryKey: ['reports', companyId],
    queryFn: async () => {
      let query = supabase
        .from('reports')
        .select('*, companies(*)')
        .order('fiscal_year', { ascending: false })

      if (companyId) {
        query = query.eq('company_id', companyId)
      }

      const { data, error } = await query
      if (error) throw error
      return data as (Report & { companies: Company })[]
    },
  })
}
