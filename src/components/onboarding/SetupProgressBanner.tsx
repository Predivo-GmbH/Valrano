import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { useOnboarding, resetOnboarding } from '@/hooks/useOnboarding'
import { cn } from '@/lib/utils'
import { BookOpen, Building2, Calendar, Check, X } from 'lucide-react'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DISMISS_KEY = 'benchmarksignal-setup-banner-dismissed'

const STEPS = [
  { key: 'hasFramework' as const, label: 'Accounting Framework', icon: BookOpen },
  { key: 'hasCompetitors' as const, label: 'Add Competitors', icon: Building2 },
  { key: 'hasSchedule' as const, label: 'Publication Schedule', icon: Calendar },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SetupProgressBanner() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { status, isLoading } = useOnboarding()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === 'true'
    } catch {
      return false
    }
  })

  // Reset dismissal if the user hasn't completed setup and starts a new session
  useEffect(() => {
    if (status.isComplete) {
      // Clean up localStorage when fully complete
      try {
        localStorage.removeItem(DISMISS_KEY)
      } catch {
        // ignore
      }
    }
  }, [status.isComplete])

  if (isLoading || status.isComplete || dismissed) {
    return null
  }

  const handleDismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, 'true')
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Progress indicators */}
        <div className="flex items-center gap-4">
          <p className="text-sm font-medium text-foreground">
            Setup {status.completedSteps}/{status.totalSteps} complete
          </p>
          <div className="hidden items-center gap-3 sm:flex">
            {STEPS.map((step) => {
              const StepIcon = step.icon
              const done = status[step.key]
              return (
                <div
                  key={step.key}
                  className={cn(
                    'flex items-center gap-1 text-xs',
                    done ? 'text-accent' : 'text-muted-foreground',
                  )}
                >
                  {done ? (
                    <Check className="size-3" />
                  ) : (
                    <StepIcon className="size-3" />
                  )}
                  <span>{step.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Button size="xs" onClick={async () => {
            try { await resetOnboarding() } catch { /* proceed anyway */ }
            queryClient.setQueryData(['onboarding-dismissed'], false)
            navigate('/onboarding', { replace: true })
          }}>
            Complete Setup
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleDismiss}
            aria-label="Dismiss setup banner"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
