import { supabase } from './supabase';

// RGPD — consentement explicite aux données sensibles (article 9), migration 69.
// Décisions de Kévin du 24/11/2026, texte à faire relire par un juriste.
// Changer CONSENT_VERSION si le texte change de façon importante : on saura ainsi
// quelle version chaque membre a acceptée.

export const CONSENT_VERSION = 'v1-2026-11';

// Champs concernés : ils ne sont enregistrés et montrés qu'avec le consentement.
export const SENSITIVE_FIELDS = ['gender_identity', 'pronouns', 'attracted_to', 'orientation', 'looking_for'] as const;

export const CONSENT_TITLE = 'Tes informations sensibles';
export const CONSENT_POINTS = [
  'Les questions qui suivent portent sur ton identité de genre, tes pronoms, ton orientation, qui t’attire et ce que tu recherches. La loi les considère comme des données sensibles.',
  'Elles servent uniquement à enrichir ton profil et à te faire découvrir des membres qui te correspondent sur Pass Navigay. Elles ne sont jamais vendues ni utilisées pour de la publicité.',
  'Seuls les membres Premium peuvent les voir, et seulement celles que tu choisis de rendre visibles. Tu restes libre de ne pas répondre.',
  'Tu peux retirer ton accord à tout moment dans Paramètres : tes réponses sont alors effacées immédiatement.',
];
export const CONSENT_CHECKBOX = 'J’accepte que Pass Navigay enregistre ces informations sensibles pour mon profil, dans les conditions ci-dessus.';

export function hasSensitiveData(p: Record<string, unknown> | null | undefined): boolean {
  if (!p) return false;
  return SENSITIVE_FIELDS.some((f) => {
    const v = p[f];
    return Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== '';
  });
}

export async function giveSensitiveConsent(): Promise<void> {
  const { error } = await supabase.rpc('give_sensitive_consent', { p_version: CONSENT_VERSION });
  if (error) throw new Error("Ton accord n'a pas pu être enregistré. Réessaie.");
}

export async function withdrawSensitiveConsent(): Promise<void> {
  const { error } = await supabase.rpc('withdraw_sensitive_consent');
  if (error) throw new Error("Le retrait n'a pas pu être enregistré. Réessaie.");
}
