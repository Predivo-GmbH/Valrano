import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { AccountingProfile, AccountingProfileUpdate } from '@/types/database'

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useAccountingProfile() {
  return useQuery({
    queryKey: ['accounting-profile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_profiles')
        .select('*')
        .maybeSingle()
      if (error) throw error
      return data as AccountingProfile | null
    },
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useAnalyzeAccountingProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ reportId, companyName }: { reportId: string; companyName?: string }) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-accounting-profile`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            report_id: reportId,
            company_name: companyName,
          }),
        },
      )

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(body.error ?? `Analysis failed: ${res.status}`)
      }

      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting-profile'] })
    },
  })
}

export function useUpdateAccountingProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: AccountingProfileUpdate }) => {
      const { data, error } = await supabase
        .from('accounting_profiles')
        .update({ ...updates, manually_edited: true, last_edited_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as AccountingProfile
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting-profile'] })
    },
  })
}

export function useDeleteAccountingProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('accounting_profiles')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting-profile'] })
    },
  })
}
