import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Ouvre la fenêtre Premium d'elle-même en arrivant sur un onglet réservé (Promotions,
 * Membres, Messages), pour un visiteur ou un membre gratuit. Demande de Kévin (25/11/2026) :
 * avant, il fallait repérer et toucher le bouton du bandeau.
 *
 * Une seule fois par onglet et par visite : la refermer ne la fait pas revenir à chaque
 * passage (le bouton du bandeau reste là pour la rouvrir).
 */
export function useOuvertureAutoPremium(cle: string, actif: boolean, ouvrir: () => void) {
  const { user, profile, loading } = useAuth();
  // Le profil arrive après la session : sans l'attendre, un Premium verrait la fenêtre
  // s'ouvrir une fraction de seconde au chargement.
  const statutConnu = !loading && (!user || profile !== null);
  const premium = profile?.is_premium === true;

  useEffect(() => {
    if (!statutConnu || premium || !actif) return;
    const k = `pn_premium_auto_${cle}`;
    try {
      if (sessionStorage.getItem(k) === '1') return;
      sessionStorage.setItem(k, '1');
    } catch {
      /* stockage indisponible : on ouvre quand même, une fois par affichage */
    }
    ouvrir();
    // `ouvrir` est un setState stable côté appelant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statutConnu, premium, actif, cle]);
}
