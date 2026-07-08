import { supabase } from '@/lib/supabase'

export type ClientStatut =
  | 'prospect'
  | 'devis_envoye'
  | 'en_cours'
  | 'a_relancer'
  | 'paye'
  | 'perdu'

export const STATUT_LABELS: Record<ClientStatut, string> = {
  prospect: 'Prospect',
  devis_envoye: 'Devis envoyé',
  en_cours: 'En cours',
  a_relancer: 'À relancer',
  paye: 'Payé',
  perdu: 'Perdu',
}

export const PIPELINE_ORDER: ClientStatut[] = ['prospect', 'devis_envoye', 'en_cours', 'a_relancer', 'paye']

export function etapeSuivante(statut: ClientStatut): ClientStatut | null {
  const idx = PIPELINE_ORDER.indexOf(statut)
  if (idx === -1 || idx >= PIPELINE_ORDER.length - 1) return null
  return PIPELINE_ORDER[idx + 1]
}

export function etapePrecedente(statut: ClientStatut): ClientStatut | null {
  const idx = PIPELINE_ORDER.indexOf(statut)
  if (idx <= 0) return null
  return PIPELINE_ORDER[idx - 1]
}

export interface Client {
  id: string
  user_id: string
  nom: string
  email: string | null
  telephone: string | null
  adresse: string | null
  entreprise: string | null
  siret: string | null
  statut: ClientStatut
  montant_du: number
  notes: string | null
  created_at: string
}

// statut est obligatoire à la création/mise à jour
export type ClientInput = Pick<Client, 'nom' | 'statut'> &
  Partial<Omit<Client, 'id' | 'user_id' | 'created_at' | 'nom' | 'statut'>>

const TABLE = 'clients'

export async function getClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

// Utilisé plus tard pour la page détail client
export async function getClient(id: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function createClient(input: ClientInput): Promise<Client> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Vous devez être connecté')

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, user_id: user.id })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateClient(id: string, input: Partial<ClientInput>): Promise<Client> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)

  if (error) throw error
}
