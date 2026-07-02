import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const STRIPE_PRICE_ID = 'price_1Toqu1Paj8OedYYbS3UhUMLT'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─── Stripe REST helpers ────────────────────────────────────────────────────

async function stripeRequest(path: string, method: string, body?: Record<string, unknown>) {
  const url = `https://api.stripe.com/v1${path}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  }
  const options: RequestInit = { method, headers }
  if (body) {
    options.body = new URLSearchParams(flattenStripeParams(body)).toString()
  }
  const res = await fetch(url, options)
  const json = await res.json()
  if (!res.ok) throw new Error(`Stripe error: ${json.error?.message || res.status}`)
  return json
}

// Flatten nested object into Stripe-style params (key[nested]=value)
function flattenStripeParams(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key
    if (value === null || value === undefined) continue
    if (typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenStripeParams(value as Record<string, unknown>, fullKey))
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === 'object') {
          Object.assign(result, flattenStripeParams(item as Record<string, unknown>, `${fullKey}[${i}]`))
        } else {
          result[`${fullKey}[${i}]`] = String(item)
        }
      })
    } else {
      result[fullKey] = String(value)
    }
  }
  return result
}

// ─── Stripe Webhook signature verification ─────────────────────────────────

async function verifyStripeSignature(body: string, signature: string, secret: string): Promise<boolean> {
  const parts = signature.split(',').reduce((acc, part) => {
    const [key, val] = part.split('=')
    acc[key] = val
    return acc
  }, {} as Record<string, string>)

  const timestamp = parts['t']
  const v1 = parts['v1']
  if (!timestamp || !v1) return false

  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - parseInt(timestamp)) > 300) return false

  const payload = `${timestamp}.${body}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return hex === v1
}

// ─── Main handler ───────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    // ── POST /create-checkout-session ─────────────────────────────────────
    if (url.pathname.endsWith('/create-checkout-session')) {
      if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { user_id, success_url, cancel_url } = await req.json()
      if (!user_id) {
        return new Response(JSON.stringify({ error: 'user_id is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(user_id)
      if (userError || !userData.user) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const email = userData.user.email!

      let stripeCustomerId: string | null = null
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', user_id)
        .maybeSingle()

      if (sub?.stripe_customer_id) {
        stripeCustomerId = sub.stripe_customer_id
      } else {
        const customer = await stripeRequest('/customers', 'POST', { email, metadata: { user_id } })
        stripeCustomerId = customer.id
      }

      const baseUrl = success_url || 'https://capclient.fr/dashboard'
      const session = await stripeRequest('/checkout/sessions', 'POST', {
        customer: stripeCustomerId,
        mode: 'subscription',
        line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
        success_url: success_url || `${baseUrl}?checkout=success`,
        cancel_url: cancel_url || `${baseUrl}?checkout=canceled`,
        metadata: { user_id },
        subscription_data: { metadata: { user_id } },
      })

      return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── POST / (Stripe Webhook) ───────────────────────────────────────────
    if (req.method === 'POST') {
      const rawBody = await req.text()
      const signature = req.headers.get('stripe-signature')

      if (!signature || !STRIPE_WEBHOOK_SECRET) {
        return new Response(JSON.stringify({ error: 'Missing signature' }), {
          status: 400, headers: { 'Content-Type': 'application/json' },
        })
      }

      const valid = await verifyStripeSignature(rawBody, signature, STRIPE_WEBHOOK_SECRET)
      if (!valid) {
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401, headers: { 'Content-Type': 'application/json' },
        })
      }

      const event = JSON.parse(rawBody)
      console.log('Stripe event received:', event.type)

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object
          const userId = session.metadata?.user_id
          const customerId = session.customer
          const subscriptionId = session.subscription
          if (!userId || !subscriptionId) break

          const stripeSub = await stripeRequest(`/subscriptions/${subscriptionId}`, 'GET')
          await supabase.from('subscriptions').upsert(
            {
              user_id: userId,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              plan: 'pro',
              status: stripeSub.status === 'active' ? 'active' : stripeSub.status,
              current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
              current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          )
          break
        }

        case 'customer.subscription.updated': {
          const stripeSub = event.data.object
          const userId: string | undefined = stripeSub.metadata?.user_id

          const lookupUserId = userId ?? await (async () => {
            const { data } = await supabase
              .from('subscriptions').select('user_id')
              .eq('stripe_subscription_id', stripeSub.id).maybeSingle()
            return data?.user_id as string | undefined
          })()

          if (!lookupUserId) break

          await supabase.from('subscriptions').update({
            status: stripeSub.status,
            plan: stripeSub.status === 'active' ? 'pro' : 'free',
            current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('user_id', lookupUserId)
          break
        }

        case 'customer.subscription.deleted': {
          const stripeSub = event.data.object
          await supabase.from('subscriptions').update({
            status: 'canceled',
            plan: 'free',
            stripe_subscription_id: null,
            updated_at: new Date().toISOString(),
          }).eq('stripe_subscription_id', stripeSub.id)
          break
        }

        default:
          console.log('Unhandled event type:', event.type)
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
