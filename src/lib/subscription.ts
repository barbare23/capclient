import { supabase } from '@/lib/supabase'

export type PlanType = 'free' | 'pro'
export type SubscriptionStatus = 'inactive' | 'active' | 'past_due' | 'canceled' | 'trialing'

export interface Subscription {
  id: string
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan: PlanType
  status: SubscriptionStatus
  current_period_start: string | null
  current_period_end: string | null
  created_at: string
  updated_at: string
}

export const CLIENTS_LIMIT_FREE = 5

export async function getSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createCheckoutSession(
  userId: string,
  email: string,
  returnUrl: string,
): Promise<string> {
  const res = await fetch(
    'https://jdwvkmzwgtdwgrayktph.supabase.co/functions/v1/stripe-webhook/create-checkout-session',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, email, return_url: returnUrl }),
    },
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erreur de connexion' }))
    throw new Error(err.error || 'Erreur lors de la création de la session')
  }
  const data = await res.json()
  return data.url
}

export async function getSubscriptionWithClientCount(
  userId: string,
): Promise<{ sub: Subscription | null; clientCount: number }> {
  const [sub, { count }] = await Promise.all([
    getSubscription(userId),
    supabase.from('clients').select('*', { count: 'exact', head: true }),
  ])
  return { sub, clientCount: count ?? 0 }
}

export function isPro(sub: Subscription | null): boolean {
  return sub?.plan === 'pro' && (sub?.status === 'active' || sub?.status === 'trialing')
}
