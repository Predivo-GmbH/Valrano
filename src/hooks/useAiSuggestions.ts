import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface DateSuggestion {
  suggested_date: string
  suggested_time: string
  confidence: number
  reasoning: string
  source: 'historical_pattern' | 'industry_norm' | 'public_announcement' | 'estimated'
}

interface DateSuggestionResponse {
  suggestion: DateSuggestion
  usage: {
    used: number
    limit: number
    tier: string
    remaining: number
  }
}

interface IrUrlResponse {
  ir_page_url: string | null
  validated: boolean
  confidence?: number
  stored?: boolean
  source?: 'existing'
  usage?: {
    used: number
    limit: number
    tier: string
    remaining: number
  }
}

export function useSuggestDates() {
  return useMutation<DateSuggestionResponse, Error, {
    company_id: string
    company_name: string
    report_type: string
    fiscal_year: number
  }>({
    mutationFn: async (params) => {
      const { data, error } = await supabase.functions.invoke('suggest-publication-dates', {
        body: params,
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data as DateSuggestionResponse
    },
  })
}

export function useSuggestIrUrl() {
  return useMutation<IrUrlResponse, Error, {
    company_id: string
    company_name: string
  }>({
    mutationFn: async (params) => {
      const { data, error } = await supabase.functions.invoke('suggest-ir-url', {
        body: params,
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data as IrUrlResponse
    },
  })
}
