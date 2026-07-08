import { useState, useEffect } from 'react'
import {
  getClients,
  updateClient,
  STATUT_LABELS,
  etapeSuivante,
  etapePrecedente,
  type Client,
  type ClientStatut,
} from '@/lib/clients'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import ClientFormDialog from '@/components/ClientFormDialog'
import { MoreHorizontal, Edit, UserPlus, Sparkles, ArrowLeft, ArrowRight, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { formatEUR } from '@/lib/format'
import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { getSubscription, isPro, CLIENTS_LIMIT_FREE, type Subscription } from '@/lib/subscription'

const PIPELINE_COLUMNS: { statut: ClientStatut; label: string; color: string }[] = [
  { statut: 'prospect', label: STATUT_LABELS.prospect, color: 'bg-blue-100 text-blue-800' },
  { statut: 'devis_envoye', label: STATUT_LABELS.devis_envoye, color: 'bg-amber-100 text-amber-800' },
  { statut: 'en_cours', label: STATUT_LABELS.en_cours, color: 'bg-green-100 text-green-800' },
  { statut: 'a_relancer', label: STATUT_LABELS.a_relancer, color: 'bg-red-100 text-red-800' },
  { statut: 'paye', label: STATUT_LABELS.paye, color: 'bg-gray-100 text-gray-800' },
]

const BADGE_COLORS: Record<ClientStatut, string> = {
  prospect: 'bg-blue-100 text-blue-800',
  devis_envoye: 'bg-amber-100 text-amber-800',
  en_cours: 'bg-green-100 text-green-800',
  a_relancer: 'bg-red-100 text-red-800',
  paye: 'bg-gray-100 text-gray-800',
  perdu: 'bg-red-50 text-red-500 border border-red-200',
}

function StatutBadge({ statut }: { statut: ClientStatut }) {
  const label = STATUT_LABELS[statut] ?? statut
  const color = BADGE_COLORS[statut] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  )
}

export default function Clients() {
  const { user } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editClient, setEditClient] = useState<Client | null>(null)
  const [viewMode, setViewMode] = useState<'pipeline' | 'table'>('pipeline')
  const [filterMode, setFilterMode] = useState<'actif' | 'perdu'>('actif')
  const [sub, setSub] = useState<Subscription | null>(null)

  // Perdu dialog
  const [perdreDialogOpen, setPerdreDialogOpen] = useState(false)
  const [clientAPerdu, setClientAPerdu] = useState<Client | null>(null)
  const [raisonPerdu, setRaisonPerdu] = useState('')

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

  useEffect(() => {
    if (!user) return
    getSubscription(user.id)
      .then(setSub)
      .catch(() => {/* ignore */})
  }, [user])

  const activeClients = clients.filter((c) => c.statut !== 'perdu')
  const perduClients = clients.filter((c) => c.statut === 'perdu')
  const displayedClients = filterMode === 'actif' ? activeClients : perduClients

  const atLimit = !isPro(sub) && activeClients.length >= CLIENTS_LIMIT_FREE

  // Change pipeline stage
  const changerStatut = async (client: Client, direction: 'precedente' | 'suivante') => {
    const nouveau = direction === 'suivante' ? etapeSuivante(client.statut) : etapePrecedente(client.statut)
    if (!nouveau) return
    try {
      await updateClient(client.id, { statut: nouveau })
      setClients((prev) => prev.map((c) => c.id === client.id ? { ...c, statut: nouveau } : c))
      toast.success(`Statut mis à jour : ${STATUT_LABELS[nouveau]}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du changement de statut')
    }
  }

  // Open "marquer comme perdu" dialog
  const openPerdreDialog = (client: Client) => {
    setClientAPerdu(client)
    setRaisonPerdu('')
    setPerdreDialogOpen(true)
  }

  // Confirm marking as lost
  const handleConfirmPerdu = async () => {
    if (!clientAPerdu) return
    try {
      const raisonTrimmed = raisonPerdu.trim()
      const notesUpdated = raisonTrimmed
        ? (clientAPerdu.notes
            ? `${clientAPerdu.notes}\n[Perdu] ${raisonTrimmed}`
            : `[Perdu] ${raisonTrimmed}`)
        : clientAPerdu.notes
      await updateClient(clientAPerdu.id, { statut: 'perdu', notes: notesUpdated ?? null })
      setClients((prev) =>
        prev.map((c) =>
          c.id === clientAPerdu.id
            ? { ...c, statut: 'perdu', notes: notesUpdated ?? c.notes }
            : c
        )
      )
      setPerdreDialogOpen(false)
      setClientAPerdu(null)
      toast.success(`${clientAPerdu.nom} marqué comme perdu`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la mise à jour')
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

  // Dropdown menu items shared between pipeline and table views
  const renderClientActions = (client: Client) => (
    <DropdownMenuContent align="end" className="text-sm">
      {client.statut !== 'perdu' && (
        <>
          <DropdownMenuItem
            onClick={() => changerStatut(client, 'precedente')}
            disabled={!etapePrecedente(client.statut)}
            className="flex items-center"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-2" /> Étape précédente
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => changerStatut(client, 'suivante')}
            disabled={!etapeSuivante(client.statut)}
            className="flex items-center"
          >
            <ArrowRight className="h-3.5 w-3.5 mr-2" /> Étape suivante
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </>
      )}
      <DropdownMenuItem onClick={() => openEdit(client)}>
        <Edit className="h-3.5 w-3.5 mr-2" /> Modifier
      </DropdownMenuItem>
      {client.statut !== 'perdu' && (
        <DropdownMenuItem
          className="text-red-600"
          onClick={() => openPerdreDialog(client)}
        >
          <XCircle className="h-3.5 w-3.5 mr-2" /> Marquer comme perdu
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  )

  // === Pipeline view ===
  const renderPipeline = () => (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      {PIPELINE_COLUMNS.map((col) => {
        const columnClients = displayedClients.filter((c) => c.statut === col.statut)
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
                        {renderClientActions(client)}
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
    <div className="overflow-x-auto">
      <div className="border rounded-lg overflow-hidden min-w-[600px]">
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
          {displayedClients.map((client) => (
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
                  {renderClientActions(client)}
                </DropdownMenu>
              </td>
            </tr>
          ))}
          {displayedClients.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                {filterMode === 'perdu'
                  ? 'Aucun client perdu.'
                  : 'Aucun client pour le moment. Cliquez sur "Nouveau client" pour commencer.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  )

  // === Perdu list view ===
  const renderPerduList = () => (
    <div className="space-y-3">
      {perduClients.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <XCircle className="h-8 w-8 mx-auto mb-3 text-gray-300" />
          <p>Aucun client perdu.</p>
        </div>
      ) : (
        perduClients.map((client) => (
          <Card key={client.id} className="shadow-sm opacity-75">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-700">{client.nom}</p>
                    <StatutBadge statut={client.statut} />
                  </div>
                  {client.entreprise && (
                    <p className="text-xs text-gray-500 mt-0.5">{client.entreprise}</p>
                  )}
                  {client.notes && (
                    <p className="text-xs text-gray-400 mt-1 line-clamp-1">{client.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {client.montant_du > 0 && (
                    <p className="text-sm font-semibold text-gray-500">{formatEUR.format(client.montant_du)}</p>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={`Actions pour ${client.nom}`}
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground h-7 w-7"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </DropdownMenuTrigger>
                    {renderClientActions(client)}
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Clients</h2>
          <p className="text-sm text-gray-500 mt-1">
            {filterMode === 'actif'
              ? `${activeClients.length} client${activeClients.length > 1 ? 's' : ''} actif${activeClients.length > 1 ? 's' : ''}`
              : `${perduClients.length} client${perduClients.length > 1 ? 's' : ''} perdu${perduClients.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Actifs / Perdus toggle */}
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setFilterMode('actif')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                filterMode === 'actif' ? 'bg-primary text-primary-foreground' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Actifs {activeClients.length > 0 && <span className="ml-1 opacity-70">({activeClients.length})</span>}
            </button>
            <button
              onClick={() => setFilterMode('perdu')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                filterMode === 'perdu' ? 'bg-red-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Perdus {perduClients.length > 0 && <span className="ml-1 opacity-70">({perduClients.length})</span>}
            </button>
          </div>

          {/* View toggle — only when showing active clients */}
          {filterMode === 'actif' && (
            <div className="flex border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('pipeline')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'pipeline' ? 'bg-primary text-primary-foreground' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Pipeline
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Tableau
              </button>
            </div>
          )}

          <Button onClick={openAdd} disabled={atLimit}>
            <UserPlus className="h-4 w-4 mr-2" />
            Nouveau client
          </Button>
        </div>
      </div>

      {/* Banner limite Free */}
      {atLimit && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800">
              Vous avez atteint la limite de {CLIENTS_LIMIT_FREE} clients du plan Gratuit.
              Passez à CapClient Pro pour ajouter des clients illimités.
            </p>
          </div>
          <Link
            to="/abonnement"
            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-md px-3 py-1.5 transition-colors"
          >
            <Sparkles className="h-3 w-3" />
            Passer à Pro
          </Link>
        </div>
      )}

      {/* Content */}
      {filterMode === 'perdu'
        ? renderPerduList()
        : viewMode === 'pipeline'
          ? renderPipeline()
          : renderTable()}

      {/* Dialog form */}
      <ClientFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditClient(null)
        }}
        client={editClient}
        onSaved={loadClients}
      />

      {/* Dialog marquer comme perdu */}
      <Dialog open={perdreDialogOpen} onOpenChange={(open) => { setPerdreDialogOpen(open); if (!open) setClientAPerdu(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Marquer comme perdu</DialogTitle>
            <DialogDescription>
              {clientAPerdu
                ? `Marquer "${clientAPerdu.nom}" comme client perdu. Vous pourrez le retrouver dans l'onglet "Perdus".`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-sm font-medium text-gray-700">
              Raison (optionnelle)
            </label>
            <textarea
              rows={3}
              value={raisonPerdu}
              onChange={(e) => setRaisonPerdu(e.target.value)}
              placeholder="Ex : budget insuffisant, a choisi un concurrent…"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPerdreDialogOpen(false); setClientAPerdu(null) }}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleConfirmPerdu}>
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
