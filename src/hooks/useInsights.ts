import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { AiInsight } from '@/types/database'

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

      if (params?.dismissed !== undefined) {
        query = query.eq('is_dismissed', params.dismissed)
      }

      const { data, error } = await query
      if (error) throw error
      return data as (AiInsight & {
        companies: { id: string; name: string; ticker: string | null } | null
      })[]
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
    mutationFn: async (params?: { fiscal_year?: number }) => {
      const { data, error } = await supabase.functions.invoke('generate-insights', {
        body: params ?? {},
      })
      if (error) throw error
      return data as { insights: AiInsight[]; count: number }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-insights'] })
    },
  })
}
