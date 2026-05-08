import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAccountingProfile } from '@/hooks/useAccountingProfile'
import { usePeerGroups } from '@/hooks/useData'
import { usePublicationEvents } from '@/hooks/useCalendar'

// ---------------------------------------------------------------------------
// Onboarding Status — aligned with the 4-step OnboardingWizard
// ---------------------------------------------------------------------------

export interface OnboardingStatus {
  hasFramework: boolean
  hasCompetitors: boolean
  hasSchedule: boolean
  isComplete: boolean
  completedSteps: number
  totalSteps: number
}

/**
 * Checks whether the current user has completed all onboarding steps:
 * 1. Accounting Framework — has an accounting_profiles row
 * 2. Add Competitors — has at least one peer group with members
 * 3. Publication Schedule — has at least one publication_event
 * Step 4 (Activate Pipeline) is a confirmation — complete when 1-3 are done.
 */
export function useOnboarding() {
  const { data: profile, isLoading: profileLoading } = useAccountingProfile()
  const { data: peerGroups, isLoading: peersLoading } = usePeerGroups()
  const { data: events, isLoading: eventsLoading } = usePublicationEvents()

  const hasFramework = !!profile
  const hasCompetitors = !!(peerGroups && peerGroups.some(pg => pg.peer_group_members.length > 0))
  const hasSchedule = !!(events && events.length > 0)

  const completedSteps = [hasFramework, hasCompetitors, hasSchedule].filter(Boolean).length
  const totalSteps = 3 // steps 1-3 are trackable; step 4 is just "activate"
  const isComplete = completedSteps === totalSteps

  const isLoading = profileLoading || peersLoading || eventsLoading

  const status: OnboardingStatus = {
    hasFramework,
    hasCompetitors,
    hasSchedule,
    isComplete,
    completedSteps,
    totalSteps,
  }

  return {
    status,
    isLoading,
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

/**
 * Resets onboarding_dismissed flag so user can re-enter the wizard.
 */
export async function resetOnboarding() {
  const { error } = await supabase.auth.updateUser({
    data: { onboarding_dismissed: false },
  })
  if (error) throw error
}
