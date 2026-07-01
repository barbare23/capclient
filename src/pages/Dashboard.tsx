import { useState, useEffect } from 'react'
import { getClients, type Client } from '@/lib/clients'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from 'react-router-dom'
import { Users, Euro, AlertCircle } from 'lucide-react'

export default function Dashboard() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getClients()
      .then(setClients)
      .finally(() => setLoading(false))
  }, [])

  const montantTotal = clients.reduce((sum, c) => sum + c.montant_du, 0)
  const relancesEnAttente = clients.filter((c) => c.statut === 'a_relancer' || c.statut === 'devis_envoye').length

  const cards = [
    {
      title: 'Clients',
      value: loading ? '…' : clients.length.toString(),
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'À encaisser',
      value: loading ? '…' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(montantTotal),
      icon: Euro,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      title: 'Relances en attente',
      value: loading ? '…' : relancesEnAttente.toString(),
      icon: AlertCircle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Tableau de bord</h2>
        <p className="text-sm text-gray-500 mt-1">Vue d'ensemble de votre activité</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title}>
              <CardContent className="flex items-center gap-4 p-6">
                <div className={`rounded-lg p-3 ${card.bg}`}>
                  <Icon className={`h-6 w-6 ${card.color}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Clients récents</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-500 text-sm">Chargement…</p>
          ) : clients.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">Aucun client pour le moment</p>
              <Link
                to="/clients"
                className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                Ajouter mes premiers clients →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {clients.slice(0, 5).map((client) => (
                <div key={client.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{client.nom}</p>
                    {client.entreprise && (
                      <p className="text-xs text-gray-500">{client.entreprise}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(client.montant_du)}
                    </p>
                    <p className="text-xs text-gray-500">{client.statut.replace('_', ' ')}</p>
                  </div>
                </div>
              ))}
              {clients.length > 5 && (
                <Link
                  to="/clients"
                  className="block text-center text-sm text-blue-600 hover:text-blue-800 pt-2"
                >
                  Voir tous les clients ({clients.length})
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
