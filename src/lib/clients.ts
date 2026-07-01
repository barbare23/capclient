import { supabase } from '@/lib/supabase'

export type ClientStatut =
  | 'prospect'
  | 'devis_envoye'
  | 'en_cours'
  | 'a_relancer'
  | 'paye'

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

export type ClientInput = Pick<Client, 'nom'> & Partial<Omit<Client, 'id' | 'user_id' | 'created_at'>>

const TABLE = 'clients'

export async function getClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

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
  const { data, error } = await supabase
    .from(TABLE)
    .insert(input)
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
