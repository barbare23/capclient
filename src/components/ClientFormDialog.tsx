import { useState, useEffect } from 'react'
import { createClient, updateClient, type Client, type ClientInput, type ClientStatut } from '@/lib/clients'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const STATUTS: { value: ClientStatut; label: string }[] = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'devis_envoye', label: 'Devis envoyé' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'a_relancer', label: 'À relancer' },
  { value: 'paye', label: 'Payé' },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  client?: Client | null
  onSaved: () => void
}

export default function ClientFormDialog({ open, onOpenChange, client, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [telephone, setTelephone] = useState('')
  const [entreprise, setEntreprise] = useState('')
  const [siret, setSiret] = useState('')
  const [adresse, setAdresse] = useState('')
  const [statut, setStatut] = useState<ClientStatut>('prospect')
  const [montantDu, setMontantDu] = useState('')
  const [notes, setNotes] = useState('')

  const isEdit = !!client

  useEffect(() => {
    if (client) {
      setNom(client.nom)
      setEmail(client.email ?? '')
      setTelephone(client.telephone ?? '')
      setEntreprise(client.entreprise ?? '')
      setSiret(client.siret ?? '')
      setAdresse(client.adresse ?? '')
      setStatut(client.statut)
      setMontantDu(client.montant_du.toString())
      setNotes(client.notes ?? '')
    } else {
      resetForm()
    }
  }, [client, open])

  const resetForm = () => {
    setNom('')
    setEmail('')
    setTelephone('')
    setEntreprise('')
    setSiret('')
    setAdresse('')
    setStatut('prospect')
    setMontantDu('')
    setNotes('')
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nom.trim()) {
      setError('Le nom est obligatoire')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const input: ClientInput = {
        nom: nom.trim(),
        email: email.trim() || null,
        telephone: telephone.trim() || null,
        entreprise: entreprise.trim() || null,
        siret: siret.trim() || null,
        adresse: adresse.trim() || null,
        statut,
        montant_du: parseFloat(montantDu) || 0,
        notes: notes.trim() || null,
      }

      if (isEdit && client) {
        await updateClient(client.id, input)
      } else {
        await createClient(input)
      }

      onSaved()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le client' : 'Nouveau client'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Modifiez les informations du client ci-dessous.' : 'Ajoutez un nouveau client à votre suivi.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="nom">Nom *</Label>
              <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom du client" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemple.fr" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telephone">Téléphone</Label>
              <Input id="telephone" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="06 12 34 56 78" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="entreprise">Entreprise</Label>
              <Input id="entreprise" value={entreprise} onChange={(e) => setEntreprise(e.target.value)} placeholder="Nom de l'entreprise" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="siret">SIRET</Label>
              <Input id="siret" value={siret} onChange={(e) => setSiret(e.target.value)} placeholder="123 456 789 00012" />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="adresse">Adresse</Label>
              <Input id="adresse" value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Adresse complète" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="statut">Statut</Label>
              <Select value={statut} onValueChange={(v) => setStatut(v as ClientStatut)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="montant">Montant dû (€)</Label>
              <Input id="montant" type="number" step="0.01" min="0" value={montantDu} onChange={(e) => setMontantDu(e.target.value)} placeholder="0.00" />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes supplémentaires…" />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Sauvegarde…' : isEdit ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
