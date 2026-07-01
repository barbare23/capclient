import { useState, useEffect } from 'react'
import { createClient, updateClient, STATUT_LABELS, type Client, type ClientInput, type ClientStatut } from '@/lib/clients'
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

  // Populate form when editing a client or reset when opening for creation
  // Deps: client?.id (pas client) pour éviter les re-renders inutiles + open
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id, open])

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

    // Validation SIRET : exactement 14 chiffres si renseigné
    const siretClean = siret.replace(/\s/g, '')
    if (siretClean && !/^\d{14}$/.test(siretClean)) {
      setError('Le SIRET doit contenir exactement 14 chiffres')
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
        siret: siretClean || null,
        adresse: adresse.trim() || null,
        statut,
        montant_du: Math.max(0, parseFloat(montantDu) || 0),
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
              <Input
                id="siret"
                inputMode="numeric"
                value={siret}
                onChange={(e) => setSiret(e.target.value)}
                placeholder="12345678900012"
              />
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
                  {(Object.keys(STATUT_LABELS) as ClientStatut[]).map((value) => (
                    <SelectItem key={value} value={value}>{STATUT_LABELS[value]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="montant">Montant dû (€)</Label>
              <Input
                id="montant"
                type="number"
                step="0.01"
                min="0"
                value={montantDu}
                onChange={(e) => setMontantDu(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes supplémentaires…"
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
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
