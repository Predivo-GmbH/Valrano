import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Subscription, SubscriptionTier } from '@/types/database'

const DEV_EMAILS = ['roger@mueller.ro', 'dev@benchmarksignal.predivo.ch']
const DEV_TIER_KEY = 'benchmarksignal-dev-tier'

export function useSubscription() {
  const { user } = useAuth()

  const { data: subscription, isLoading } = useQuery<Subscription | null>({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user) return null
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!user,
  })

  // Dev tier override — for admin users
  const devOverride = DEV_EMAILS.includes(user?.email ?? '')
    ? (localStorage.getItem(DEV_TIER_KEY) as SubscriptionTier | null)
    : null

  const tier = devOverride ?? subscription?.tier ?? 'starter'

  return {
    subscription,
    tier,
    status: subscription?.status ?? 'active',
    isLoading,
    isActive: subscription?.status === 'active' || subscription?.status === 'trialing',
    isDevOverride: !!devOverride,
  }
}

export { DEV_EMAILS, DEV_TIER_KEY }
