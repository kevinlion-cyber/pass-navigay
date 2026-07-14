// Adapter "source d'avis" pour le signal gay-friendly.
// - google5   (défaut) : les ~5 avis renvoyés par l'API officielle Google. Gratuit
//              (déjà dans placeDetails), mais rate l'historique enfoui → indice FAIBLE.
// - dataforseo (option) : TOUT l'historique d'avis via DataForSEO → indice FORT.
//              Non branché par défaut (Kevin ne veut pas de DataForSEO). Le jour où il
//              change d'avis, on pose les creds .secrets/dataforseo-* et on passe --reviews dataforseo :
//              zéro réécriture du pipeline.
import { config } from '../lib/env.mjs';
import { placeDetails } from '../lib/places.mjs';

async function google5(draft) {
  const det = await placeDetails(draft.place_id);
  return {
    provider: 'google5',
    confidence: 'low', // au plus 5 avis → signal faible par construction
    editorial_summary: det.editorial_summary,
    reviews: det.reviews,
    total_reviews_read: det.reviews.length,
  };
}

async function dataforseo() {
  if (!config.dataForSeoLogin || !config.dataForSeoPassword) {
    throw new Error('DataForSEO non configuré (.secrets/dataforseo-login + -password absents). Utilisez --reviews google5.');
  }
  // Point de branchement volontairement laissé à implémenter le jour où Kevin l'active.
  // Reprendre la recette du POC (business_data/google/reviews task_post → tasks_ready → task_get),
  // lire TOUT l'historique, renvoyer { provider:'dataforseo', confidence:'high', reviews, total_reviews_read }.
  throw new Error('Provider dataforseo pas encore implémenté (activation à la demande de Kevin).');
}

const PROVIDERS = { google5, dataforseo };

export async function getReviews(draft, provider = 'google5') {
  const fn = PROVIDERS[provider];
  if (!fn) throw new Error(`Provider avis inconnu "${provider}". Dispo : ${Object.keys(PROVIDERS).join(', ')}`);
  return fn(draft);
}
