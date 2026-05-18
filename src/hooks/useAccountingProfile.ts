import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { AccountingProfile, AccountingProfileUpdate } from '@/types/database'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function friendlyAnalysisError(status: number | null, detail: string): string {
  const lower = detail.toLowerCase()
  if (status === 413 || lower.includes('payload') || lower.includes('too large') || lower.includes('body limit'))
    return 'The PDF is too large to process. Please try uploading a smaller version (under 20 MB).'
  if (status === 504 || status === 502 || lower.includes('timeout') || lower.includes('timed out') || lower.includes('idle'))
    return 'The analysis timed out — the report may have too many pages. Please try again; the server will retry automatically.'
  if (status === 401 || lower.includes('auth') || lower.includes('session') || lower.includes('expired'))
    return 'Your session has expired. Please refresh the page and try again.'
  if (status === 403 || lower.includes('not in your peer'))
    return 'You do not have permission to analyze this report.'
  if (status === 429 || lower.includes('rate') || lower.includes('overloaded'))
    return 'The AI service is currently busy. Please wait a moment and try again.'
  if (lower.includes('no pdf'))
    return 'This report has no PDF file attached. Please re-upload the document.'
  if (lower.includes('anthropic') || lower.includes('claude'))
    return 'The AI analysis service encountered an error. Please try again in a few minutes.'
  if (status === 500 || status === 546)
    return `Server error during analysis. Please try again. (Code: ${status})`
  if (status)
    return `Analysis failed with error code ${status}. Please try again.`
  return detail || 'An unexpected error occurred during analysis. Please try again.'
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useAccountingProfile() {
  return useQuery({
    queryKey: ['accounting-profile'],
    staleTime: 5 * 60 * 1000,
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
        const detail = body.error ?? `HTTP ${res.status}`
        throw new Error(friendlyAnalysisError(res.status, detail))
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
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}
