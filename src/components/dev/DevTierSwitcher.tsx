import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { DEV_EMAIL, DEV_TIER_KEY } from '@/hooks/useSubscription'
import type { SubscriptionTier } from '@/types/database'
import { Settings2 } from 'lucide-react'
import { getNewsDisabledUsers, setNewsDisabledUsers } from '@/lib/dev-flags'

const TIERS: SubscriptionTier[] = ['starter', 'professional', 'enterprise']

export function DevTierSwitcher() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [disabledUsers, setDisabledUsers] = useState<Set<string>>(getNewsDisabledUsers)

  if (user?.email !== DEV_EMAIL) return null

  const current = (localStorage.getItem(DEV_TIER_KEY) as SubscriptionTier | null) ?? 'starter'

  const switchTier = (tier: SubscriptionTier) => {
    localStorage.setItem(DEV_TIER_KEY, tier)
    queryClient.invalidateQueries({ queryKey: ['subscription'] })
  }

  const clearOverride = () => {
    localStorage.removeItem(DEV_TIER_KEY)
    queryClient.invalidateQueries({ queryKey: ['subscription'] })
  }

  const toggleNewsForUser = (userId: string) => {
    setDisabledUsers((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      setNewsDisabledUsers(next)
      return next
    })
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999]">
      {open && (
        <div className="mb-2 max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-card p-3 shadow-xl w-64">
          {/* Tier section */}
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Tier Override
          </p>
          <div className="flex flex-wrap gap-1 mb-2">
            {TIERS.map((tier) => (
              <button
                key={tier}
                onClick={() => switchTier(tier)}
                className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                  current === tier
                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                    : 'text-foreground hover:bg-muted/50'
                }`}
              >
                {tier.charAt(0).toUpperCase() + tier.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={clearOverride}
            className="mb-3 block w-full rounded px-2 py-1 text-left text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear override
          </button>

          {/* News Gathering section */}
          <div className="border-t border-border pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              News Gathering
            </p>
            <UserNewsList disabledUsers={disabledUsers} onToggle={toggleNewsForUser} />
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent)] text-white shadow-lg hover:opacity-90 transition-opacity"
        title="Dev Tools"
      >
        <Settings2 className="h-4 w-4" />
      </button>
    </div>
  )
}

function UserNewsList({
  disabledUsers,
  onToggle,
}: {
  disabledUsers: Set<string>
  onToggle: (userId: string) => void
}) {
  const { data: profiles, isLoading } = useQuery({
    queryKey: ['dev-user-profiles'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, company_name')
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as { id: string; full_name: string | null; company_name: string | null }[]
    },
  })

  // Also fetch auth emails via Supabase admin (won't work without service_role, so fall back to profile data)
  if (isLoading) {
    return <p className="text-[11px] text-muted-foreground">Loading users...</p>
  }

  if (!profiles || profiles.length === 0) {
    return <p className="text-[11px] text-muted-foreground">No users found</p>
  }

  return (
    <div className="space-y-1.5">
      {profiles.map((profile) => {
        const enabled = !disabledUsers.has(profile.id)
        return (
          <div
            key={profile.id}
            className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-muted/30"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium text-foreground">
                {profile.full_name || profile.id.slice(0, 8)}
              </p>
              {profile.company_name && (
                <p className="truncate text-[10px] text-muted-foreground">{profile.company_name}</p>
              )}
            </div>
            <button
              onClick={() => onToggle(profile.id)}
              className={`ml-2 flex h-5 w-9 flex-shrink-0 items-center rounded-full px-0.5 transition-colors ${
                enabled ? 'bg-[var(--color-signal-green)]' : 'bg-muted'
              }`}
              title={enabled ? 'News enabled — click to disable' : 'News disabled — click to enable'}
            >
              <div
                className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  enabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        )
      })}
    </div>
  )
}
