/**
 * Motif de recherche sûr pour les filtres « or(...) » de la base (27/11/2026).
 *
 * Avant, le texte tapé était inséré tel quel : une virgule, un point ou une parenthèse
 * (« Bar, Sète », « L'Origine (Sète) ») cassait la requête et la recherche affichait une
 * erreur. La documentation de PostgREST demande d'entourer de guillemets une valeur qui
 * contient ces caractères réservés. On retire seulement les guillemets et barres obliques
 * inverses (ils servent à cette mise entre guillemets) et on limite la longueur.
 * Renvoie null si la recherche est vide.
 */
export function motifRecherche(texte: string): string | null {
  const v = texte.replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  return v ? `"%${v}%"` : null;
}
