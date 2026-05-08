import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useQueryClient } from '@tanstack/react-query'
import { DEV_EMAIL, DEV_TIER_KEY } from '@/hooks/useSubscription'
import type { SubscriptionTier } from '@/types/database'
import { Settings2 } from 'lucide-react'

const TIERS: SubscriptionTier[] = ['starter', 'professional', 'enterprise']

export function DevTierSwitcher() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  if (user?.email !== DEV_EMAIL) return null

  const current = (localStorage.getItem(DEV_TIER_KEY) as SubscriptionTier | null) ?? 'starter'

  const switchTier = (tier: SubscriptionTier) => {
    localStorage.setItem(DEV_TIER_KEY, tier)
    queryClient.invalidateQueries({ queryKey: ['subscription'] })
    setOpen(false)
  }

  const clearOverride = () => {
    localStorage.removeItem(DEV_TIER_KEY)
    queryClient.invalidateQueries({ queryKey: ['subscription'] })
    setOpen(false)
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999]">
      {open && (
        <div className="mb-2 rounded-lg border border-border bg-card p-3 shadow-xl w-48">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Dev Tier Override
          </p>
          {TIERS.map((tier) => (
            <button
              key={tier}
              onClick={() => switchTier(tier)}
              className={`block w-full rounded px-2 py-1.5 text-left text-[12px] font-medium transition-colors ${
                current === tier
                  ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                  : 'text-foreground hover:bg-muted/50'
              }`}
            >
              {tier.charAt(0).toUpperCase() + tier.slice(1)}
            </button>
          ))}
          <button
            onClick={clearOverride}
            className="mt-1 block w-full rounded px-2 py-1.5 text-left text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear override
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent)] text-white shadow-lg hover:opacity-90 transition-opacity"
        title="Dev: Switch tier"
      >
        <Settings2 className="h-4 w-4" />
      </button>
    </div>
  )
}
