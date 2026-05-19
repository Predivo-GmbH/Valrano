import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { IrCatalogItem } from '@/types/database'

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useIrCatalogItems(companyId?: string) {
  return useQuery({
    queryKey: ['ir-catalog', companyId],
    enabled: !!companyId,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ir_catalog_items')
        .select('*')
        .eq('company_id', companyId!)
        .order('fiscal_year', { ascending: false, nullsFirst: false })
        .order('detected_at', { ascending: false })

      if (error) throw error
      return data as IrCatalogItem[]
    },
  })
}

export function useIrCatalogCount(companyId?: string) {
  return useQuery({
    queryKey: ['ir-catalog-count', companyId],
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('ir_catalog_items')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId!)

      if (error) throw error
      return count ?? 0
    },
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useScanIrPage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (companyId: string) => {
      const { data, error } = await supabase.functions.invoke('scan-ir-page', {
        body: { company_id: companyId },
      })
      if (error) throw error
      return data as { success: boolean; items_found: number; items_new: number; items_updated: number; message?: string }
    },
    onSuccess: (_data, companyId) => {
      queryClient.invalidateQueries({ queryKey: ['ir-catalog', companyId] })
      queryClient.invalidateQueries({ queryKey: ['ir-catalog-count', companyId] })
    },
    onError: (err: Error) => {
      toast.error(`IR page scan failed: ${err.message}`)
    },
  })
}

export function useDownloadCatalogItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { catalogItemId: string; companyId: string }) => {
      const { data, error } = await supabase.functions.invoke('download-catalog-item', {
        body: { catalog_item_id: params.catalogItemId },
      })
      if (error) throw error
      return data as { success: boolean; report_id: string; pipeline_triggered: boolean }
    },
    onSuccess: (_data, params) => {
      queryClient.invalidateQueries({ queryKey: ['ir-catalog', params.companyId] })
      queryClient.invalidateQueries({ queryKey: ['ir-catalog-count', params.companyId] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
    onError: (err: Error) => {
      toast.error(`Download failed: ${err.message}`)
    },
  })
}
