import { supabase } from '@/lib/supabase'

export type RelanceType = 'automatique' | 'manuelle'
export type RelanceStatut = 'en_attente' | 'envoyee' | 'echouee'

export interface Relance {
  id: string
  client_id: string
  user_id: string
  facture_id: string | null
  type: RelanceType
  statut: RelanceStatut
  date_envoi: string | null
  date_echeance: string
  message: string | null
  created_at: string
}

/** Récupère toutes les relances, avec filtre optionnel par client. */
export async function getRelances(clientId?: string): Promise<Relance[]> {
  let query = supabase
    .from('relances')
    .select('*')
    .order('created_at', { ascending: false })

  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/** Récupère les relances liées à une facture précise. */
export async function getRelancesParFacture(factureId: string): Promise<Relance[]> {
  const { data, error } = await supabase
    .from('relances')
    .select('*')
    .eq('facture_id', factureId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

/** Crée une nouvelle relance (manuel). */
export async function creerRelance(
  payload: Omit<Relance, 'id' | 'created_at'>
): Promise<Relance> {
  const { data, error } = await supabase
    .from('relances')
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data
}

/** Met à jour le statut d'une relance existante. */
export async function mettreAJourStatutRelance(
  id: string,
  statut: RelanceStatut,
  date_envoi?: string
): Promise<void> {
  const updates: Partial<Relance> = { statut }
  if (date_envoi) updates.date_envoi = date_envoi

  const { error } = await supabase
    .from('relances')
    .update(updates)
    .eq('id', id)

  if (error) throw error
}

/** Compte les relances automatiques envoyées pour une facture donnée. */
export async function compterRelancesAutomatiques(factureId: string): Promise<number> {
  const { count, error } = await supabase
    .from('relances')
    .select('*', { count: 'exact', head: true })
    .eq('facture_id', factureId)
    .eq('type', 'automatique')

  if (error) throw error
  return count ?? 0
}
