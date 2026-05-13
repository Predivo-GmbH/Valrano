import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { SUPER_ADMIN_EMAIL } from '@/hooks/useSubscription'
import { getNewsDisabledUsers, setNewsDisabledUsers } from '@/lib/dev-flags'
import type { SubscriptionTier } from '@/types/database'
import { ShieldCheck, Loader2 } from 'lucide-react'

const TIERS: SubscriptionTier[] = ['starter', 'professional', 'enterprise']

interface AdminUser {
  id: string
  email: string
  full_name: string | null
  company_name: string | null
  created_at: string
  tier: SubscriptionTier
}

export function AdminPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [disabledUsers, setDisabledUsersState] = useState<Set<string>>(getNewsDisabledUsers)

  if (user?.email !== SUPER_ADMIN_EMAIL) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Access denied. Super admin only.
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>Admin - BenchmarkSignal</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <AdminPanel disabledUsers={disabledUsers} setDisabledUsers={setDisabledUsersState} queryClient={queryClient} />
    </>
  )
}

function AdminPanel({
  disabledUsers,
  setDisabledUsers,
  queryClient,
}: {
  disabledUsers: Set<string>
  setDisabledUsers: React.Dispatch<React.SetStateAction<Set<string>>>
  queryClient: ReturnType<typeof useQueryClient>
}) {
  const { data: users, isLoading } = useQuery<AdminUser[]>({
    queryKey: ['admin-users'],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_users')
      if (error) throw error
      return (data ?? []).map((u: Record<string, unknown>) => ({
        id: u.id as string,
        email: u.email as string,
        full_name: u.full_name as string | null,
        company_name: u.company_name as string | null,
        created_at: u.created_at as string,
        tier: (u.tier as SubscriptionTier) ?? 'starter',
      }))
    },
  })

  const updateTier = useMutation({
    mutationFn: async ({ userId, tier }: { userId: string; tier: SubscriptionTier }) => {
      const { error } = await supabase.rpc('admin_update_tier', {
        target_user_id: userId,
        new_tier: tier,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
    },
  })

  const toggleNews = (userId: string) => {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading users...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-[var(--color-accent)]" />
        <h2 className="text-lg font-semibold text-foreground">Admin Panel</h2>
        <span className="text-xs text-muted-foreground">({users?.length ?? 0} users)</span>
      </div>

      <p className="text-sm text-muted-foreground">
        Manage subscription tiers and news gathering for all registered accounts.
      </p>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full min-w-[500px] text-sm">
          <thead>
            <tr className="border-b border-border bg-[var(--color-bg-tertiary)]/30">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">User</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tier</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">News</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => {
              const newsEnabled = !disabledUsers.has(u.id)
              return (
                <tr key={u.id} className="border-b border-border/50 last:border-0 hover:bg-[var(--color-bg-tertiary)]/20 transition-colors">
                  {/* User info */}
                  <td className="px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {u.email}
                      </p>
                      {(u.full_name || u.company_name) && (
                        <p className="text-xs text-muted-foreground truncate">
                          {[u.full_name, u.company_name].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {new Date(u.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </td>

                  {/* Tier selector */}
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {TIERS.map((tier) => (
                        <button
                          key={tier}
                          onClick={() => updateTier.mutate({ userId: u.id, tier })}
                          disabled={updateTier.isPending}
                          className={`rounded-md px-2.5 py-1.5 min-h-[44px] text-[11px] font-medium transition-colors cursor-pointer ${
                            u.tier === tier
                              ? 'bg-[var(--color-accent)] text-white'
                              : 'bg-[var(--color-bg-tertiary)] text-muted-foreground hover:text-foreground hover:bg-[var(--color-bg-tertiary)]/80'
                          }`}
                        >
                          {tier.charAt(0).toUpperCase() + tier.slice(1)}
                        </button>
                      ))}
                    </div>
                  </td>

                  {/* News toggle */}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleNews(u.id)}
                      className={`inline-flex h-5 w-9 items-center rounded-full px-0.5 transition-colors cursor-pointer ${
                        newsEnabled ? 'bg-[var(--color-signal-green)]' : 'bg-muted'
                      }`}
                      title={newsEnabled ? 'News enabled — click to disable' : 'News disabled — click to enable'}
                    >
                      <div
                        className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                          newsEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
