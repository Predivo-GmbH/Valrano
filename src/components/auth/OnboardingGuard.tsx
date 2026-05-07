import { Navigate, Outlet } from 'react-router-dom'
import { useOnboardingDismissed } from '@/hooks/useOnboarding'

/**
 * Redirects first-time users to the onboarding wizard.
 * Wraps protected routes that require onboarding to be completed.
 */
export function OnboardingGuard() {
  const { data: dismissed, isLoading } = useOnboardingDismissed()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)]">
        <div role="status" aria-label="Loading">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    )
  }

  if (!dismissed) {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}
