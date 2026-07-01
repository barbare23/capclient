import { useState, useEffect } from 'react'
import { getClients, deleteClient, STATUT_LABELS, type Client, type ClientStatut } from '@/lib/clients'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import ClientFormDialog from '@/components/ClientFormDialog'
import { MoreHorizontal, Edit, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { formatEUR } from '@/lib/format'

const PIPELINE_COLUMNS: { statut: ClientStatut; label: string; color: string }[] = [
  { statut: 'prospect', label: STATUT_LABELS.prospect, color: 'bg-blue-100 text-blue-800' },
  { statut: 'devis_envoye', label: STATUT_LABELS.devis_envoye, color: 'bg-amber-100 text-amber-800' },
  { statut: 'en_cours', label: STATUT_LABELS.en_cours, color: 'bg-green-100 text-green-800' },
  { statut: 'a_relancer', label: STATUT_LABELS.a_relancer, color: 'bg-red-100 text-red-800' },
  { statut: 'paye', label: STATUT_LABELS.paye, color: 'bg-gray-100 text-gray-800' },
]

function StatutBadge({ statut }: { statut: ClientStatut }) {
  const col = PIPELINE_COLUMNS.find((c) => c.statut === statut)
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${col?.color ?? 'bg-gray-100'}`}>
      {col?.label ?? statut}
    </span>
  )
}

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editClient, setEditClient] = useState<Client | null>(null)
  const [viewMode, setViewMode] = useState<'pipeline' | 'table'>('pipeline')

  const loadClients = async () => {
    try {
      const data = await getClients()
      setClients(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClients()
  }, [])

  const handleDelete = async (client: Client) => {
    if (!confirm(`Supprimer ${client.nom} ? Cette action est irréversible.`)) return
    try {
      await deleteClient(client.id)
      setClients((prev) => prev.filter((c) => c.id !== client.id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression')
    }
  }

  const openEdit = (client: Client) => {
    setEditClient(client)
    setDialogOpen(true)
  }

  const openAdd = () => {
    setEditClient(null)
    setDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Chargement des clients…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  // === Pipeline view ===
  const renderPipeline = () => (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      {PIPELINE_COLUMNS.map((col) => {
        const columnClients = clients.filter((c) => c.statut === col.statut)
        return (
          <div key={col.statut} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">{col.label}</h3>
              <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                {columnClients.length}
              </span>
            </div>
            <div className="space-y-2 min-h-[200px]">
              {columnClients.map((client) => (
                <Card key={client.id} className="shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{client.nom}</p>
                        {client.entreprise && (
                          <p className="text-xs text-gray-500 truncate">{client.entreprise}</p>
                        )}
                        {client.montant_du > 0 && (
                          <p className="text-sm font-semibold text-gray-700 mt-1">
                            {formatEUR.format(client.montant_du)}
                          </p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={`Actions pour ${client.nom}`}
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground h-7 w-7 shrink-0"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="text-sm">
                          <DropdownMenuItem onClick={() => openEdit(client)}>
                            <Edit className="h-3.5 w-3.5 mr-2" /> Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDelete(client)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {columnClients.length === 0 && (
                <div className="border border-dashed border-gray-200 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-400">Aucun client</p>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )

  // === Table view ===
  const renderTable = () => (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Nom</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Entreprise</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Statut</th>
            <th className="text-right px-4 py-3 font-medium text-gray-600">Montant dû</th>
            <th className="w-12 px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {clients.map((client) => (
            <tr key={client.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-900">{client.nom}</td>
              <td className="px-4 py-3 text-gray-600">{client.entreprise ?? '—'}</td>
              <td className="px-4 py-3 text-gray-600">{client.email ?? '—'}</td>
              <td className="px-4 py-3"><StatutBadge statut={client.statut} /></td>
              <td className="px-4 py-3 text-right font-medium">{formatEUR.format(client.montant_du)}</td>
              <td className="px-4 py-3">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`Actions pour ${client.nom}`}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground h-7 w-7"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="text-sm">
                    <DropdownMenuItem onClick={() => openEdit(client)}>
                      <Edit className="h-3.5 w-3.5 mr-2" /> Modifier
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(client)}>
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
          {clients.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                Aucun client pour le moment. Cliquez sur "Nouveau client" pour commencer.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Clients</h2>
          <p className="text-sm text-gray-500 mt-1">{clients.length} client{clients.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('pipeline')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'pipeline' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Pipeline
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'table' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Tableau
            </button>
          </div>
          <Button onClick={openAdd}>
            <UserPlus className="h-4 w-4 mr-2" />
            Nouveau client
          </Button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'pipeline' ? renderPipeline() : renderTable()}

      {/* Dialog */}
      <ClientFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditClient(null)
        }}
        client={editClient}
        onSaved={loadClients}
      />
    </div>
  )
}
