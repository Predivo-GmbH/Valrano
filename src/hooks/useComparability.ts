import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ComparabilityAdjustment } from '@/types/database'

export function useComparabilityAdjustments(benchmarkDocumentId?: string) {
  return useQuery({
    queryKey: ['comparability-adjustments', benchmarkDocumentId],
    enabled: !!benchmarkDocumentId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comparability_adjustments')
        .select('*')
        .eq('benchmark_document_id', benchmarkDocumentId!)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as ComparabilityAdjustment[]
    },
  })
}

export function useCompanyAdjustments(companyId?: string, fiscalYear?: number) {
  return useQuery({
    queryKey: ['company-adjustments', companyId, fiscalYear],
    enabled: !!companyId && !!fiscalYear,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      let query = supabase
        .from('comparability_adjustments')
        .select('*')
        .eq('adjusted_company_id', companyId!)

      if (fiscalYear) query = query.eq('fiscal_year', fiscalYear)

      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      return data as ComparabilityAdjustment[]
    },
  })
}

export function useComputeComparability() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { adjusted_company_id: string; reference_company_id: string; fiscal_year: number; benchmark_document_id?: string }) => {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/compute-comparability`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(params),
        }
      )
      if (!resp.ok) throw new Error(await resp.text())
      return resp.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comparability-adjustments'] })
      queryClient.invalidateQueries({ queryKey: ['company-adjustments'] })
    },
  })
}
