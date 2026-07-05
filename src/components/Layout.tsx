import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { LayoutDashboard, Users, LogOut, CreditCard } from 'lucide-react'
import type { ReactNode } from 'react'
import { getSubscription, isPro, type Subscription } from '@/lib/subscription'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/abonnement', label: 'Abonnement', icon: CreditCard },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const [sub, setSub] = useState<Subscription | null>(null)

  useEffect(() => {
    if (!user) return
    getSubscription(user.id)
      .then(setSub)
      .catch(() => {/* ignore */})
  }, [user])

  const isProPlan = isPro(sub)

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r hidden md:flex flex-col">
        <div className="p-6 border-b">
          <Link to="/dashboard" className="text-xl font-bold text-gray-900">CapClient</Link>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = location.pathname === item.href
            const isAbonnement = item.href === '/abonnement'
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
                {isAbonnement && isProPlan && (
                  <span className="ml-auto inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                    Pro
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t space-y-3">
          <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          <Button variant="outline" size="sm" className="w-full" onClick={signOut}>
            <LogOut className="h-3.5 w-3.5 mr-2" />
            Déconnexion
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="md:hidden bg-white border-b px-4 py-3 flex items-center justify-between">
          <Link to="/dashboard" className="text-lg font-bold text-gray-900">CapClient</Link>
          <div className="flex items-center gap-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const active = location.pathname === item.href
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  aria-label={item.label}
                  className={`p-2 rounded-lg ${active ? 'bg-gray-100' : ''}`}
                >
                  <Icon className="h-5 w-5 text-gray-600" />
                </Link>
              )
            })}
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-5 w-5 text-gray-600" />
            </Button>
          </div>
        </header>

        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
