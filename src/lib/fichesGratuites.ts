/**
 * Fiches d'établissement ouvertes par un visiteur SANS compte depuis la carte ou la liste.
 *
 * Règle décidée par Kévin (25/11/2026) : 3 fiches librement, puis l'invitation à créer
 * un compte (gratuit) s'ouvre et la fiche suivante reste fermée. Rouvrir une fiche déjà
 * vue ne compte pas. Une fiche ouverte directement (depuis Google, un lien partagé)
 * n'est pas concernée : elle reste visible, pour le référencement.
 *
 * Simple confort de navigation retenu dans le navigateur (aucune donnée envoyée) ; ce
 * n'est pas une protection : les fiches sont publiques de toute façon.
 */
const CLE = 'pn_fiches_vues';
export const FICHES_GRATUITES = 3;

function lire(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLE) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Vrai si le visiteur peut ouvrir cette fiche ; la note comme vue le cas échéant. */
export function ouvrirFicheGratuite(id: string): boolean {
  const vues = lire();
  if (vues.includes(id)) return true;
  if (vues.length >= FICHES_GRATUITES) return false;
  try {
    localStorage.setItem(CLE, JSON.stringify([...vues, id]));
  } catch {
    /* stockage indisponible (navigation privée stricte) : on laisse passer */
  }
  return true;
}
