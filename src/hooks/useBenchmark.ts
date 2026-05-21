import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type {
  BenchmarkRule,
  BenchmarkDocument,
  Company,
  NarrativeStyle,
  KpiSelectionItem,
  ApprovalChain,
} from '@/types/database'

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useBenchmarkRules() {
  return useQuery({
    queryKey: ['benchmark-rules'],
    staleTime: 5 * 60 * 1000,
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
    onError: (error: Error) => {
      toast.error(error.message)
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
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useUpdateDocumentStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; status: string; fromStatus?: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('benchmark_documents')
        .update({
          status: params.status,
          status_changed_by: user.id,
          status_changed_at: new Date().toISOString(),
          review_notes: params.notes || null,
        })
        .eq('id', params.id)
        .select()
        .single()
      if (error) throw error

      // Write to audit log
      if (params.fromStatus) {
        await supabase.from('document_status_log').insert({
          document_id: params.id,
          from_status: params.fromStatus,
          to_status: params.status,
          changed_by: user.id,
          notes: params.notes || null,
        })
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['benchmark-documents'] })
    },
  })
}

export function useUpdateDocumentContent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; content_json: Record<string, unknown> }) => {
      const { data, error } = await supabase
        .from('benchmark_documents')
        .update({ content_json: params.content_json })
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

// ---------------------------------------------------------------------------
// Approval Chain Hooks
// ---------------------------------------------------------------------------

export function useApprovalChains() {
  return useQuery({
    queryKey: ['approval-chains'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approval_chains')
        .select('*, benchmark_rules(*)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as (ApprovalChain & { benchmark_rules: BenchmarkRule | null })[]
    },
  })
}

export function useCreateApprovalChain() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: Record<string, unknown>) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('approval_chains')
        .insert({ ...params, created_by: user?.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-chains'] })
    },
  })
}

export function useUpdateApprovalChain() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; name?: string; benchmark_rule_id?: string | null; steps?: unknown[] }) => {
      const { id, ...updates } = params
      const { data, error } = await supabase
        .from('approval_chains')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-chains'] })
    },
  })
}

export function useDeleteApprovalChain() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('approval_chains')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-chains'] })
    },
  })
}

export function useApprovalSteps(documentId: string | undefined) {
  return useQuery({
    queryKey: ['approval-steps', documentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approval_steps')
        .select('*')
        .eq('document_id', documentId!)
        .order('step_number', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!documentId,
  })
}

export function useAdvanceApproval() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { document_id: string; action: string; comment?: string }) => {
      const { data, error } = await supabase.functions.invoke('advance-approval', {
        body: params,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-steps'] })
      queryClient.invalidateQueries({ queryKey: ['benchmark-documents'] })
    },
  })
}

export function useCreateApprovalComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      approval_step_id: string
      comment: string
      [key: string]: unknown
    }) => {
      const { data, error } = await supabase
        .from('approval_comments')
        .insert(params)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-steps'] })
    },
  })
}
