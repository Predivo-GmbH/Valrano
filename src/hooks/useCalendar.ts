import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { PublicationEvent, MonitorCheck, Company } from '@/types/database'

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function usePublicationEvents(params?: {
  status?: string
  companyId?: string
  year?: number
}) {
  return useQuery({
    queryKey: ['publication-events', params],
    queryFn: async () => {
      let query = supabase
        .from('publication_events')
        .select('*, companies(*)')
        .order('expected_date', { ascending: true })

      if (params?.status) {
        query = query.eq('status', params.status)
      }
      if (params?.companyId) {
        query = query.eq('company_id', params.companyId)
      }
      if (params?.year) {
        query = query.gte('expected_date', `${params.year}-01-01`)
        query = query.lte('expected_date', `${params.year}-12-31`)
      }

      const { data, error } = await query
      if (error) throw error
      return data as (PublicationEvent & { companies: Company })[]
    },
  })
}

export function usePublicationEvent(id: string | undefined) {
  return useQuery({
    queryKey: ['publication-events', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('publication_events')
        .select('*, companies(*), monitor_checks(*)')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as PublicationEvent & { companies: Company; monitor_checks: MonitorCheck[] }
    },
    enabled: !!id,
  })
}

export function useMonitorChecks(eventId: string | undefined) {
  return useQuery({
    queryKey: ['monitor-checks', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monitor_checks')
        .select('*')
        .eq('publication_event_id', eventId!)
        .order('checked_at', { ascending: false })
      if (error) throw error
      return data as MonitorCheck[]
    },
    enabled: !!eventId,
  })
}

export function useCompanies() {
  return useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw error
      return data as Company[]
    },
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreatePublicationEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      company_id: string
      report_type: string
      fiscal_year: number
      fiscal_quarter?: number | null
      expected_date: string
      expected_time?: string | null
      ir_page_url?: string | null
      direct_pdf_url?: string | null
      notes?: string | null
    }) => {
      const { data, error } = await supabase
        .from('publication_events')
        .insert({
          ...params,
          status: 'scheduled',
        })
        .select()
        .single()
      if (error) throw error
      return data as PublicationEvent
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publication-events'] })
    },
  })
}

export function useUpdatePublicationEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; [key: string]: unknown }) => {
      const { id, ...updates } = params
      const { data, error } = await supabase
        .from('publication_events')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PublicationEvent
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publication-events'] })
    },
  })
}

export function useDeletePublicationEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('publication_events')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publication-events'] })
    },
  })
}

export function useCheckPublication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (publication_event_id: string) => {
      const { data, error } = await supabase.functions.invoke('check-publication', {
        body: { publication_event_id },
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publication-events'] })
      queryClient.invalidateQueries({ queryKey: ['monitor-checks'] })
    },
  })
}
