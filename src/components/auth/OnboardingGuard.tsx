import { useEffect, useRef } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useOnboardingDismissed, dismissOnboarding } from '@/hooks/useOnboarding'
import { useCurrentWorkspace } from '@/hooks/useWorkspace'
import { useAuth } from '@/hooks/useAuth'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Redirects first-time users to the onboarding wizard.
 * Exception: invited team members (non-owner workspace members) skip onboarding
 * because they share the admin's workspace data.
 */
export function OnboardingGuard() {
  const { data: dismissed, isLoading: dismissLoading } = useOnboardingDismissed()
  const { data: workspace, isLoading: wsLoading } = useCurrentWorkspace()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const autoDismissed = useRef(false)

  // If user is a member of someone else's workspace, auto-dismiss onboarding
  const isInvitedMember = !!workspace && !!user && workspace.owner_id !== user.id

  useEffect(() => {
    if (isInvitedMember && dismissed === false && !autoDismissed.current) {
      autoDismissed.current = true
      dismissOnboarding().then(() => {
        queryClient.invalidateQueries({ queryKey: ['onboarding-dismissed'] })
      })
    }
  }, [isInvitedMember, dismissed, queryClient])

  if (dismissLoading || wsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)]">
        <div role="status" aria-label="Loading">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    )
  }

  // Invited members skip onboarding — they use the admin's workspace data
  if (isInvitedMember) {
    return <Outlet />
  }

  if (!dismissed) {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}
