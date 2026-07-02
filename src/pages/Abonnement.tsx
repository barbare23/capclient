import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import {
  getSubscriptionWithClientCount,
  createCheckoutSession,
  isPro,
  CLIENTS_LIMIT_FREE,
  type Subscription,
} from '@/lib/subscription'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, Sparkles, CreditCard, Users, Zap, Mail, Loader2, BadgeCheck, AlertCircle } from 'lucide-react'

export default function Abonnement() {
  const { user } = useAuth()
  const [sub, setSub] = useState<Subscription | null>(null)
  const [clientCount, setClientCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    getSubscriptionWithClientCount(user.id)
      .then(({ sub, clientCount }) => {
        setSub(sub)
        setClientCount(clientCount)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur de chargement'))
      .finally(() => setLoading(false))
  }, [user])

  const handleUpgrade = async () => {
    if (!user) return
    setCheckoutLoading(true)
    setError(null)
    try {
      const returnUrl = `${window.location.origin}/abonnement`
      const url = await createCheckoutSession(user.id, user.email ?? '', returnUrl)
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du paiement')
      setCheckoutLoading(false)
    }
  }

  const isProPlan = isPro(sub)
  const planLabel = isProPlan ? 'CapClient Pro' : 'Gratuit'
  const periodEnd = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Abonnement</h2>
        <p className="text-sm text-gray-500 mt-1">Gérez votre plan CapClient</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Plan actuel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-gray-500" />
            Plan actuel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`rounded-full px-3 py-1 text-sm font-semibold ${
                isProPlan
                  ? 'bg-violet-100 text-violet-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {planLabel}
              </div>
              {isProPlan && sub?.status && (
                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {sub.status === 'active' ? 'Actif' : sub.status === 'trialing' ? 'Essai' : sub.status}
                </span>
              )}
            </div>
            {isProPlan ? (
              <span className="text-sm font-semibold text-gray-900">9 € / mois</span>
            ) : (
              <span className="text-sm text-gray-500">Gratuit</span>
            )}
          </div>

          {/* Utilisation clients */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="h-3.5 w-3.5" />
                Clients
              </div>
              <span className="text-sm font-medium text-gray-900">
                {clientCount}
                {!isProPlan && ` / ${CLIENTS_LIMIT_FREE}`}
              </span>
            </div>
            {!isProPlan && (
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    clientCount >= CLIENTS_LIMIT_FREE ? 'bg-red-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min((clientCount / CLIENTS_LIMIT_FREE) * 100, 100)}%` }}
                />
              </div>
            )}
            {!isProPlan && clientCount >= CLIENTS_LIMIT_FREE && (
              <p className="text-xs text-red-600 mt-1">Limite atteinte — passez à Pro pour continuer</p>
            )}
          </div>

          {/* Prochaine facturation si Pro */}
          {isProPlan && periodEnd && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
              Prochaine facturation le <span className="font-medium text-gray-900">{periodEnd}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Carte upgrade si Free, ou confirmation si Pro */}
      {isProPlan ? (
        <Card className="border-violet-200 bg-violet-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-violet-100 p-3">
                <Sparkles className="h-6 w-6 text-violet-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Vous êtes sur CapClient Pro 🎉</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Clients illimités, relances automatiques par email, et toutes les fonctionnalités à venir.
                </p>
                <p className="text-xs text-gray-500">
                  Pour gérer votre abonnement, mettre à jour votre moyen de paiement ou annuler,
                  contactez-nous à{' '}
                  <a href="mailto:support@capclient.fr" className="text-violet-600 hover:underline">
                    support@capclient.fr
                  </a>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-violet-200 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-violet-600 text-white text-xs font-semibold px-3 py-1 rounded-bl-lg">
            Recommandé
          </div>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-violet-100 p-2.5">
                <Sparkles className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <CardTitle className="text-lg">CapClient Pro</CardTitle>
                <CardDescription className="text-2xl font-bold text-gray-900 mt-0.5">
                  9 €
                  <span className="text-sm font-normal text-gray-500"> / mois</span>
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <ul className="space-y-2.5">
              {[
                { icon: Users, text: 'Clients illimités' },
                { icon: Mail, text: 'Relances automatiques par email' },
                { icon: Zap, text: 'Pipeline Kanban complet' },
                { icon: Check, text: 'Toutes les fonctionnalités futures incluses' },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm text-gray-700">
                  <div className="rounded-full bg-green-100 p-1">
                    <Icon className="h-3 w-3 text-green-600" />
                  </div>
                  {text}
                </li>
              ))}
            </ul>

            <Button
              className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold"
              size="lg"
              onClick={handleUpgrade}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Redirection…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Passer à CapClient Pro
                </>
              )}
            </Button>

            <p className="text-xs text-center text-gray-500">
              Paiement sécurisé par Stripe · Résiliable à tout moment
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
