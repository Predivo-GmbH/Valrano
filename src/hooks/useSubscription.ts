import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Subscription } from '@/types/database'

export const SUPER_ADMIN_EMAIL = 'roger@mueller.ro'

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

  const tier = subscription?.tier ?? 'starter'

  return {
    subscription,
    tier,
    status: subscription?.status ?? 'active',
    isLoading,
    isActive: subscription?.status === 'active' || subscription?.status === 'trialing',
    isSuperAdmin: user?.email === SUPER_ADMIN_EMAIL,
  }
}
