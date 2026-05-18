import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Shared hook for visible_company_ids RPC
// ---------------------------------------------------------------------------
// Both useSmartYear and useCompanies need this list. By sharing the query key,
// React Query deduplicates the RPC call — eliminating one network round-trip.
// ---------------------------------------------------------------------------

export function useVisibleCompanyIds() {
  return useQuery({
    queryKey: ['visible-company-ids'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('visible_company_ids')
      if (error) throw error
      return (data ?? []) as string[]
    },
  })
}
