import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useOnboarding } from '@/hooks/useOnboarding'
import { cn } from '@/lib/utils'
import { Building2, BarChart3, Radio, Check, X } from 'lucide-react'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DISMISS_KEY = 'benchmarksignal-setup-banner-dismissed'

const STEPS = [
  { key: 'hasCompany' as const, label: 'Add Company', icon: Building2 },
  { key: 'hasKpis' as const, label: 'Enter KPIs', icon: BarChart3 },
  { key: 'hasPeers' as const, label: 'Add Peers', icon: Radio },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SetupProgressBanner({ onResumeSetup }: { onResumeSetup: () => void }) {
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
    <div className="relative rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
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
                    done ? 'text-primary' : 'text-muted-foreground',
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
          <Button size="xs" onClick={onResumeSetup}>
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
