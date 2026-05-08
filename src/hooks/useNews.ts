import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CompanyNews, NewsDigest, ReportContext, SegmentBreakdown } from '@/types/database'

export function useCompanyNews(companyId?: string, options?: { limit?: number; relevant_only?: boolean }) {
  return useQuery({
    queryKey: ['company-news', companyId, options],
    enabled: !!companyId,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      let query = supabase
        .from('company_news')
        .select('*')
        .eq('company_id', companyId!)
        .order('published_at', { ascending: false })
        .limit(options?.limit ?? 100)

      if (options?.relevant_only !== false) {
        query = query.eq('is_relevant', true)
      }

      const { data, error } = await query
      if (error) throw error
      return data as CompanyNews[]
    },
  })
}

export function useAllNews(options?: { companyIds?: string[]; topic?: string; limit?: number }) {
  return useQuery({
    queryKey: ['all-news', options],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      let query = supabase
        .from('company_news')
        .select('*')
        .eq('is_relevant', true)
        .order('published_at', { ascending: false })
        .limit(options?.limit ?? 200)

      if (options?.companyIds && options.companyIds.length > 0) {
        query = query.in('company_id', options.companyIds)
      }
      if (options?.topic) {
        query = query.contains('topics', [options.topic])
      }

      const { data, error } = await query
      if (error) throw error
      return data as CompanyNews[]
    },
  })
}

export function useNewsDigests(companyId?: string) {
  return useQuery({
    queryKey: ['news-digests', companyId],
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news_digests')
        .select('*')
        .eq('company_id', companyId!)
        .order('period_end', { ascending: false })
        .limit(12)

      if (error) throw error
      return data as NewsDigest[]
    },
  })
}

export function useReportContext(reportId?: string) {
  return useQuery({
    queryKey: ['report-context', reportId],
    enabled: !!reportId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_contexts')
        .select('*')
        .eq('report_id', reportId!)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // not found
        throw error
      }
      return data as ReportContext
    },
  })
}

export function useSegmentBreakdowns(companyId?: string, fiscalYear?: number) {
  return useQuery({
    queryKey: ['segment-breakdowns', companyId, fiscalYear],
    enabled: !!companyId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      let query = supabase
        .from('segment_breakdowns')
        .select('*')
        .eq('company_id', companyId!)
        .order('revenue_pct', { ascending: false })

      if (fiscalYear) {
        query = query.eq('fiscal_year', fiscalYear)
      }

      const { data, error } = await query
      if (error) throw error
      return data as SegmentBreakdown[]
    },
  })
}

export function useFetchNews() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (companyId: string) => {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-company-news`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ company_id: companyId }),
        }
      )
      if (!resp.ok) throw new Error(await resp.text())
      return resp.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-news'] })
      queryClient.invalidateQueries({ queryKey: ['all-news'] })
    },
  })
}
