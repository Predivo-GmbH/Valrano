import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Smart Year Hook
// ---------------------------------------------------------------------------
// Queries kpi_values to find the most recent fiscal_year with data.
// Falls back to current year - 1 when no data exists.
// Provides an availableYears array for dropdowns.
// ---------------------------------------------------------------------------

interface SmartYearResult {
  /** The best default year (most recent with data, or currentYear - 1) */
  defaultYear: number
  /** All distinct fiscal years that have KPI data, sorted descending */
  availableYears: number[]
  /** Whether the query is still loading */
  isLoading: boolean
}

const FALLBACK_YEAR = new Date().getFullYear() - 1

export function useSmartYear(): SmartYearResult {
  const { data, isLoading } = useQuery({
    queryKey: ['smart-year-available'],
    queryFn: async () => {
      const { data: visibleIds } = await supabase.rpc('visible_company_ids')
      if (!visibleIds?.length) return []
      const { data: rows, error } = await supabase
        .from('kpi_values')
        .select('fiscal_year')
        .in('company_id', visibleIds)
        .order('fiscal_year', { ascending: false })

      if (error) throw error

      // Deduplicate and sort descending
      const yearsSet = new Set<number>()
      for (const row of rows ?? []) {
        yearsSet.add(row.fiscal_year)
      }
      return [...yearsSet].sort((a, b) => b - a)
    },
    staleTime: 5 * 60 * 1000, // 5 min — year list rarely changes
  })

  const availableYears = data && data.length > 0
    ? data
    : Array.from({ length: 5 }, (_, i) => FALLBACK_YEAR - i)

  const defaultYear = data && data.length > 0 ? data[0] : FALLBACK_YEAR

  return { defaultYear, availableYears, isLoading }
}
