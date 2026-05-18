import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { SUPER_ADMIN_EMAIL } from '@/hooks/useSubscription'
import { getNewsDisabledUsers, setNewsDisabledUsers } from '@/lib/dev-flags'
import type { SubscriptionTier } from '@/types/database'
import { ShieldCheck, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'

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
        <title>Admin - Valrano</title>
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
    onError: (err: Error) => {
      toast.error(`Tier update failed: ${err.message}`)
    },
  })

  const [confirmWipe, setConfirmWipe] = useState<string | null>(null)

  const wipeAccount = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('admin_wipe_account', {
        target_user_id: userId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Account wiped successfully')
      setConfirmWipe(null)
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (err: Error) => {
      toast.error(`Wipe failed: ${err.message}`)
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
      <div className="space-y-6 animate-pulse" role="status" aria-label="Loading admin data">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-[var(--color-bg-tertiary)]" />
          <div className="h-5 w-32 rounded bg-[var(--color-bg-tertiary)]" />
        </div>
        <div className="h-4 w-72 rounded bg-[var(--color-bg-tertiary)]" />
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border bg-[var(--color-bg-tertiary)]/30 px-4 py-3">
            <div className="flex gap-16">
              <div className="h-3 w-12 rounded bg-[var(--color-bg-tertiary)]" />
              <div className="h-3 w-8 rounded bg-[var(--color-bg-tertiary)]" />
              <div className="h-3 w-10 rounded bg-[var(--color-bg-tertiary)]" />
              <div className="h-3 w-14 rounded bg-[var(--color-bg-tertiary)]" />
            </div>
          </div>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-8 border-b border-border/50 px-4 py-4">
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-40 rounded bg-[var(--color-bg-tertiary)]" />
                <div className="h-2.5 w-24 rounded bg-[var(--color-bg-tertiary)]" />
              </div>
              <div className="flex gap-1">
                <div className="h-8 w-20 rounded-md bg-[var(--color-bg-tertiary)]" />
                <div className="h-8 w-20 rounded-md bg-[var(--color-bg-tertiary)]" />
              </div>
              <div className="h-5 w-9 rounded-full bg-[var(--color-bg-tertiary)]" />
              <div className="h-8 w-16 rounded-md bg-[var(--color-bg-tertiary)]" />
            </div>
          ))}
        </div>
        <span className="sr-only">Loading admin data...</span>
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

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[600px] text-sm" aria-label="User administration">
          <thead>
            <tr className="border-b border-border bg-[var(--color-bg-tertiary)]/30">
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">User</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tier</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">News</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
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

                  {/* Erase account */}
                  <td className="px-4 py-3 text-center">
                    {confirmWipe === u.id ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => wipeAccount.mutate(u.id)}
                          disabled={wipeAccount.isPending}
                          className="rounded-md bg-red-600 px-2.5 py-1.5 min-h-[44px] text-[11px] font-medium text-white hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {wipeAccount.isPending ? 'Wiping…' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => setConfirmWipe(null)}
                          className="rounded-md bg-[var(--color-bg-tertiary)] px-2.5 py-1.5 min-h-[44px] text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmWipe(u.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-[var(--color-bg-tertiary)] px-2.5 py-1.5 min-h-[44px] text-[11px] font-medium text-muted-foreground hover:text-red-400 hover:bg-red-950/20 transition-colors cursor-pointer"
                        title="Erase all account data"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Erase
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
