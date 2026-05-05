import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { usePrimaryCompany, useMyCompanyKpis } from '@/hooks/useMyCompany'
import { useCompanies } from '@/hooks/useData'

// ---------------------------------------------------------------------------
// Onboarding Status
// ---------------------------------------------------------------------------

export interface OnboardingStatus {
  hasCompany: boolean
  hasKpis: boolean
  hasPeers: boolean
  isComplete: boolean
  completedSteps: number
  totalSteps: number
}

/**
 * Checks whether the current user has completed all onboarding steps:
 * 1. Has a company profile (my_companies table)
 * 2. Has KPI data entered (my_company_kpis table)
 * 3. Has at least one active peer (companies table with is_active)
 */
export function useOnboarding() {
  const { data: primaryCompany, isLoading: companyLoading } = usePrimaryCompany()
  const { data: kpis, isLoading: kpisLoading } = useMyCompanyKpis(primaryCompany?.id)
  const { data: peers, isLoading: peersLoading } = useCompanies()

  const hasCompany = !!primaryCompany
  const hasKpis = !!(kpis && kpis.length > 0)
  const hasPeers = !!(peers && peers.length > 0)

  const completedSteps = [hasCompany, hasKpis, hasPeers].filter(Boolean).length
  const totalSteps = 3
  const isComplete = completedSteps === totalSteps

  const isLoading = companyLoading || (hasCompany && kpisLoading) || peersLoading

  const status: OnboardingStatus = {
    hasCompany,
    hasKpis,
    hasPeers,
    isComplete,
    completedSteps,
    totalSteps,
  }

  return {
    status,
    isLoading,
    primaryCompany,
  }
}

/**
 * Checks onboarding_completed flag in user metadata.
 * Used to determine whether to show the wizard on login.
 */
export function useOnboardingDismissed() {
  return useQuery({
    queryKey: ['onboarding-dismissed'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false
      return user.user_metadata?.onboarding_dismissed === true
    },
  })
}

/**
 * Marks onboarding as dismissed in user metadata so the wizard
 * won't show again on next login.
 */
export async function dismissOnboarding() {
  const { error } = await supabase.auth.updateUser({
    data: { onboarding_dismissed: true },
  })
  if (error) throw error
}
