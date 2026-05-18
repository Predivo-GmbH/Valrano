import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportTemplate {
  id: string
  name: string
  description: string | null
  category: string
  template_json: {
    sections: string[]
    style: string
    max_kpis: number
    include_charts: boolean
    include_narrative: boolean
  }
  is_system: boolean
  created_by: string | null
  created_at: string
}

export interface CustomReport {
  id: string
  user_id: string
  title: string
  description: string | null
  template_id: string | null
  config_json: {
    company_ids?: string[]
    kpi_codes?: string[]
    fiscal_year?: number
    peer_group_id?: string
    sections?: string[]
  }
  content_json: Record<string, unknown> | null
  content_html: string | null
  status: 'draft' | 'generating' | 'ready' | 'error'
  error_message: string | null
  schedule_cron: string | null
  last_generated_at: string | null
  last_exported_at: string | null
  last_export_format: string | null
  created_at: string
  updated_at: string
  report_templates?: ReportTemplate | null
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useReportTemplates() {
  return useQuery({
    queryKey: ['report-templates'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_templates')
        .select('*')
        .order('category')
      if (error) throw error
      return data as ReportTemplate[]
    },
  })
}

export function useCustomReports() {
  return useQuery({
    queryKey: ['custom-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_reports')
        .select('*, report_templates(*)')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data as CustomReport[]
    },
  })
}

export function useCustomReport(id: string | undefined) {
  return useQuery({
    queryKey: ['custom-reports', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_reports')
        .select('*, report_templates(*)')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as CustomReport
    },
    enabled: !!id,
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      title: string
      description?: string
      template_id?: string
      config_json: CustomReport['config_json']
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('custom_reports')
        .insert({
          ...params,
          user_id: user.id,
          status: 'draft',
        })
        .select()
        .single()
      if (error) throw error
      return data as CustomReport
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-reports'] })
    },
  })
}

export function useUpdateReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; [key: string]: unknown }) => {
      const { id, ...updates } = params
      const { data, error } = await supabase
        .from('custom_reports')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as CustomReport
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-reports'] })
    },
  })
}

export function useDeleteReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('custom_reports')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-reports'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useGenerateReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (reportId: string) => {
      const { data, error } = await supabase.functions.invoke('generate-report', {
        body: { report_id: reportId },
      })
      if (error) throw error
      return data as { report_id: string; status: string; sections: number; title: string }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-reports'] })
    },
  })
}
