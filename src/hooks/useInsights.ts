import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { AiInsight } from '@/types/database'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InsightFocus = 'all' | 'financial' | 'esg' | 'operational'
export type InsightTimeRange = '1y' | '3y' | '5y'
export type InsightReportType = 'all' | 'annual' | 'quarterly' | 'half_year' | 'sustainability'

export interface GenerateInsightsParams {
  fiscal_year?: number
  focus?: InsightFocus
  time_range?: InsightTimeRange
  report_type?: InsightReportType
}

export interface GenerateInsightsResult {
  insights: AiInsight[]
  count: number
  message?: string
  batch_id?: string
  delta_summary?: {
    new: number
    worsened: number
    improved: number
    unchanged: number
  }
  risk_notifications_sent?: number
  meta?: {
    focus: string
    time_range: string
    report_type: string
    fiscal_year: number
    companies_analyzed: number
    kpis_analyzed: number
    data_points: number
    auto_generated?: boolean
    triggered_by?: string
  }
}

export type InsightWithCompany = AiInsight & {
  companies: { id: string; name: string; ticker: string | null } | null
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useInsights(params?: { dismissed?: boolean }) {
  return useQuery({
    queryKey: ['ai-insights', params],
    queryFn: async () => {
      let query = supabase
        .from('ai_insights')
        .select('*, companies:related_company_id(id, name, ticker)')
        .order('created_at', { ascending: false })
        .limit(50)

      if (params?.dismissed !== undefined) {
        query = query.eq('is_dismissed', params.dismissed)
      }

      const { data, error } = await query
      if (error) throw error
      return data as InsightWithCompany[]
    },
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useDismissInsight() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai_insights')
        .update({ is_dismissed: true })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-insights'] })
    },
  })
}

export function useGenerateInsights() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params?: GenerateInsightsParams) => {
      const { data, error } = await supabase.functions.invoke('generate-insights', {
        body: params ?? {},
      })
      if (error) throw error
      return data as GenerateInsightsResult
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-insights'] })
    },
  })
}

export function useBookmarkInsight() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, bookmarked }: { id: string; bookmarked: boolean }) => {
      const { error } = await supabase
        .from('ai_insights')
        .update({ is_bookmarked: bookmarked })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-insights'] })
    },
  })
}

export function useMarkInsightActed() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      const { error } = await supabase
        .from('ai_insights')
        .update({
          is_acted_upon: true,
          acted_at: new Date().toISOString(),
          action_note: note ?? null,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-insights'] })
    },
  })
}
