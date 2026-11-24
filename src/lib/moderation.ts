import { supabase } from './supabase';

// Blocage et signalement entre membres (E4, 24/11/2026).
// Les règles sont appliquées par la base (migration 66) : bloquer coupe les
// messages et rend les deux membres invisibles l'un pour l'autre ; un signalement
// passe par la fonction report_member, qui capture elle-même les preuves.

export const REPORT_REASONS: { value: string; label: string }[] = [
  { value: 'harcelement', label: 'Harcèlement ou intimidation' },
  { value: 'contenu_sexuel', label: 'Contenu sexuel non sollicité' },
  { value: 'faux_profil', label: 'Faux profil ou arnaque' },
  { value: 'haine', label: 'Propos haineux ou discriminatoires' },
  { value: 'mineur', label: 'Personne qui semble mineure' },
  { value: 'autre', label: 'Autre' },
];

export async function blockMember(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase.from('user_blocks').insert({ blocker_id: blockerId, blocked_id: blockedId });
  // 23505 = déjà bloqué : pas une erreur pour la personne.
  if (error && error.code !== '23505') throw new Error("Le blocage n'a pas pu être enregistré. Réessaie.");
}

export async function unblockMember(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase.from('user_blocks').delete().eq('blocker_id', blockerId).eq('blocked_id', blockedId);
  if (error) throw new Error("Le déblocage n'a pas pu être enregistré. Réessaie.");
}

export interface BlockedMember {
  blocked_id: string;
  username: string | null;
  prenom: string | null;
  avatar_url: string | null;
  created_at: string;
}

export async function listMyBlocks(): Promise<BlockedMember[]> {
  const { data, error } = await supabase.rpc('list_my_blocks');
  if (error) throw new Error("La liste n'a pas pu être chargée.");
  return (data || []) as BlockedMember[];
}

export async function reportMember(
  reportedId: string,
  reason: string,
  details: string,
  context: 'profil' | 'conversation',
): Promise<void> {
  const { data, error } = await supabase.rpc('report_member', {
    p_reported: reportedId,
    p_reason: reason,
    p_details: details || null,
    p_context: context,
  });
  if (error) {
    throw new Error(error.message?.includes('Trop de signalements')
      ? error.message
      : "Le signalement n'a pas pu être envoyé. Réessaie.");
  }
  // Alerte email à l'équipe (au mieux : le signalement est déjà enregistré).
  if (data) supabase.functions.invoke('report-alert', { body: { reportId: data } }).catch(() => {});
}
