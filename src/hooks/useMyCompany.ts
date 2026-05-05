import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { MyCompany, MyCompanyKpi, SelfBenchmark, MyCompanyInsert, MyCompanyKpiInsert } from '@/types/database'
import type { KpiDefinition } from '@/types/database'

// ---------------------------------------------------------------------------
// My Company Queries
// ---------------------------------------------------------------------------

export function useMyCompanies() {
  return useQuery({
    queryKey: ['my-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('my_companies')
        .select('*')
        .order('is_primary', { ascending: false })
      if (error) throw error
      return data as MyCompany[]
    },
  })
}

export function useMyCompany(id: string | undefined) {
  return useQuery({
    queryKey: ['my-companies', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('my_companies')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as MyCompany
    },
    enabled: !!id,
  })
}

export function usePrimaryCompany() {
  return useQuery({
    queryKey: ['my-companies', 'primary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('my_companies')
        .select('*')
        .eq('is_primary', true)
        .maybeSingle()
      if (error) throw error
      return data as MyCompany | null
    },
  })
}

// ---------------------------------------------------------------------------
// My Company KPI Queries
// ---------------------------------------------------------------------------

export function useMyCompanyKpis(myCompanyId: string | undefined, fiscalYear?: number) {
  return useQuery({
    queryKey: ['my-company-kpis', myCompanyId, fiscalYear],
    queryFn: async () => {
      let query = supabase
        .from('my_company_kpis')
        .select('*, kpi_definitions(*)')
        .eq('my_company_id', myCompanyId!)
        .order('created_at')
      if (fiscalYear) {
        query = query.eq('fiscal_year', fiscalYear)
      }
      const { data, error } = await query
      if (error) throw error
      return data as (MyCompanyKpi & { kpi_definitions: KpiDefinition })[]
    },
    enabled: !!myCompanyId,
  })
}

// ---------------------------------------------------------------------------
// Self-Benchmark Queries
// ---------------------------------------------------------------------------

export function useSelfBenchmarks(myCompanyId: string | undefined) {
  return useQuery({
    queryKey: ['self-benchmarks', myCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('self_benchmarks')
        .select('*')
        .eq('my_company_id', myCompanyId!)
        .order('generated_at', { ascending: false })
      if (error) throw error
      return data as SelfBenchmark[]
    },
    enabled: !!myCompanyId,
  })
}

export function useLatestSelfBenchmark(myCompanyId: string | undefined) {
  return useQuery({
    queryKey: ['self-benchmarks', myCompanyId, 'latest'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('self_benchmarks')
        .select('*')
        .eq('my_company_id', myCompanyId!)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as SelfBenchmark | null
    },
    enabled: !!myCompanyId,
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateMyCompany() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: Omit<MyCompanyInsert, 'user_id'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('my_companies')
        .insert({ ...params, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data as MyCompany
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-companies'] })
    },
  })
}

export function useUpdateMyCompany() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; [key: string]: unknown }) => {
      const { id, ...updates } = params
      const { data, error } = await supabase
        .from('my_companies')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as MyCompany
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-companies'] })
    },
  })
}

export function useUpsertMyCompanyKpis() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { my_company_id: string; kpis: Omit<MyCompanyKpiInsert, 'my_company_id'>[] }) => {
      const rows = params.kpis.map((kpi) => ({
        ...kpi,
        my_company_id: params.my_company_id,
      }))
      const { data, error } = await supabase
        .from('my_company_kpis')
        .upsert(rows, { onConflict: 'my_company_id,kpi_definition_id,fiscal_year' })
        .select()
      if (error) throw error
      return data as MyCompanyKpi[]
    },
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['my-company-kpis', params.my_company_id] })
    },
  })
}

export function useRunSelfBenchmark() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      my_company_id: string
      peer_group_id?: string
      fiscal_year?: number
    }) => {
      const { data, error } = await supabase.functions.invoke('self-benchmark', {
        body: params,
      })
      if (error) throw error
      return data as {
        benchmark_id: string | null
        company_name: string
        fiscal_year: number
        peer_count: number
        kpi_percentiles: Array<{
          kpi_code: string
          kpi_name: string
          my_value: number
          peer_median: number
          peer_p25: number
          peer_p75: number
          peer_min: number
          peer_max: number
          percentile: number
          peer_count: number
          gap_to_median: number
          gap_to_median_pct: number
          signal: 'strength' | 'neutral' | 'weakness'
        }>
        strengths: Array<{ kpi_name: string; percentile: number }>
        weaknesses: Array<{ kpi_name: string; percentile: number }>
        ai_narrative: string
        overall_percentile: number | null
      }
    },
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['self-benchmarks', params.my_company_id] })
    },
  })
}
