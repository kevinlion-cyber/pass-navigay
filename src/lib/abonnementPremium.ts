import toast from 'react-hot-toast';
import { supabase } from './supabase';

/**
 * Ouvre l'espace de gestion Stripe du membre Premium (moyen de paiement, factures,
 * résiliation). Obligation légale depuis le 1er juin 2023 : un abonné doit pouvoir
 * résilier en ligne, simplement (art. L215-1-1 du Code de la consommation).
 *
 * Le serveur retrouve lui-même le client Stripe du membre connecté : rien n'est lu
 * depuis le navigateur. On remplace la page (et non un nouvel onglet), car Safari sur
 * iPhone bloque les onglets ouverts après un délai ; Stripe ramène ensuite ici.
 *
 * Renvoie false si l'espace n'a pas pu être ouvert (un message est déjà affiché).
 */
export async function ouvrirGestionAbonnementPremium(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-portal-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ returnUrl: window.location.href }),
    });
    const data = await res.json().catch(() => ({}));
    if (data?.url) {
      window.location.assign(data.url);
      return true;
    }
    if (res.status === 404) {
      // Premium offert par l'équipe (aucun paiement) : il n'y a rien à résilier.
      toast("Ton Premium t'a été offert : il n'y a pas d'abonnement payant à gérer. Il s'arrêtera tout seul à sa date de fin.", { icon: '🎁', duration: 6000 });
      return false;
    }
    toast.error("L'espace de gestion n'a pas pu s'ouvrir. Réessaie dans un instant.");
  } catch {
    toast.error('Erreur de connexion. Vérifie ta connexion et réessaie.');
  }
  return false;
}

export function dateFinPremium(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}
