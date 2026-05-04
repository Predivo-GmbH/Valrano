import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type {
  BenchmarkRule,
  BenchmarkDocument,
  Company,
  NarrativeStyle,
  KpiSelectionItem,
} from '@/types/database'

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useBenchmarkRules() {
  return useQuery({
    queryKey: ['benchmark-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('benchmark_rules')
        .select('*, companies(*)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as (BenchmarkRule & { companies: Company })[]
    },
  })
}

export function useBenchmarkRule(id: string | undefined) {
  return useQuery({
    queryKey: ['benchmark-rules', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('benchmark_rules')
        .select('*, companies(*)')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as BenchmarkRule & { companies: Company }
    },
    enabled: !!id,
  })
}

export function useBenchmarkDocuments(params?: {
  status?: string
  fiscalYear?: number
  companyId?: string
}) {
  return useQuery({
    queryKey: ['benchmark-documents', params],
    queryFn: async () => {
      let query = supabase
        .from('benchmark_documents')
        .select(`
          *,
          trigger_company:companies!benchmark_documents_trigger_company_id_fkey(id, name, ticker),
          customer_company:companies!benchmark_documents_customer_company_id_fkey(id, name, ticker),
          benchmark_rules(id, name, narrative_style)
        `)
        .order('generated_at', { ascending: false })

      if (params?.status) {
        query = query.eq('status', params.status)
      }
      if (params?.fiscalYear) {
        query = query.eq('fiscal_year', params.fiscalYear)
      }
      if (params?.companyId) {
        query = query.eq('trigger_company_id', params.companyId)
      }

      const { data, error } = await query
      if (error) throw error
      return data as (BenchmarkDocument & {
        trigger_company: Pick<Company, 'id' | 'name' | 'ticker'> | null
        customer_company: Pick<Company, 'id' | 'name' | 'ticker'>
        benchmark_rules: Pick<BenchmarkRule, 'id' | 'name' | 'narrative_style'>
      })[]
    },
  })
}

export function useBenchmarkDocument(id: string | undefined) {
  return useQuery({
    queryKey: ['benchmark-documents', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('benchmark_documents')
        .select(`
          *,
          trigger_company:companies!benchmark_documents_trigger_company_id_fkey(id, name, ticker),
          customer_company:companies!benchmark_documents_customer_company_id_fkey(id, name, ticker),
          benchmark_rules(id, name, narrative_style)
        `)
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as BenchmarkDocument & {
        trigger_company: Pick<Company, 'id' | 'name' | 'ticker'> | null
        customer_company: Pick<Company, 'id' | 'name' | 'ticker'>
        benchmark_rules: Pick<BenchmarkRule, 'id' | 'name' | 'narrative_style'>
      }
    },
    enabled: !!id,
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateBenchmarkRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      customer_company_id: string
      name: string
      description?: string
      peer_group_id?: string
      kpi_selection: KpiSelectionItem[]
      narrative_style: NarrativeStyle
      auto_generate: boolean
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('benchmark_rules')
        .insert({
          ...params,
          created_by: user?.id ?? null,
        })
        .select()
        .single()
      if (error) throw error
      return data as BenchmarkRule
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['benchmark-rules'] })
    },
  })
}

export function useUpdateBenchmarkRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      id: string
      name?: string
      description?: string
      kpi_selection?: KpiSelectionItem[]
      narrative_style?: NarrativeStyle
      auto_generate?: boolean
    }) => {
      const { id, ...updates } = params
      const { data, error } = await supabase
        .from('benchmark_rules')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as BenchmarkRule
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['benchmark-rules'] })
    },
  })
}

export function useDeleteBenchmarkRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('benchmark_rules')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['benchmark-rules'] })
    },
  })
}

export function useGenerateBenchmark() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      report_id: string
      benchmark_rule_id?: string
    }) => {
      const { data, error } = await supabase.functions.invoke('generate-benchmark', {
        body: params,
      })
      if (error) throw error
      return data as {
        document_id: string
        title: string
        status: string
        sections: number
        risk_flags: number
        competitive_position: string
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['benchmark-documents'] })
    },
  })
}

export function useUpdateDocumentStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; status: string }) => {
      const { data, error } = await supabase
        .from('benchmark_documents')
        .update({ status: params.status })
        .eq('id', params.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['benchmark-documents'] })
    },
  })
}
