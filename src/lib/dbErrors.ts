/**
 * Traduit les erreurs de base de données en français compréhensible.
 *
 * Sans ça, un refus d'écriture s'affichait tel quel : « new row violates row-level
 * security policy ». Pour la personne en face, c'est du bruit : elle ne sait ni ce
 * qui s'est passé, ni quoi faire. Le cas le plus courant est une session qui n'est
 * plus valide (jeton expiré, ou connexion avec un autre compte dans un autre onglet,
 * puisque le navigateur partage la session entre les onglets du même site).
 */

interface DbErrorLike {
  code?: string;
  message?: string;
}

/** Vrai si l'erreur est un refus de droits, donc presque toujours un souci de session. */
export function isPermissionError(err: unknown): boolean {
  const e = err as DbErrorLike | null;
  if (!e) return false;
  if (e.code === '42501') return true;
  const m = (e.message || '').toLowerCase();
  return m.includes('row-level security') || m.includes('permission denied');
}

export function translateDbError(err: unknown, fallback = "L'enregistrement a échoué. Réessayez."): string {
  const e = err as DbErrorLike | null;
  if (!e) return fallback;

  if (isPermissionError(e)) {
    return "Votre session n'est plus valide. Reconnectez-vous, puis enregistrez à nouveau : votre saisie est conservée.";
  }

  switch (e.code) {
    case '23505': // doublon sur une contrainte d'unicité
      return 'Cette valeur existe déjà. Modifiez-la et réessayez.';
    case '23503': // clé étrangère
      return "Un élément lié est introuvable. Rechargez la page et réessayez.";
    case '23502': // NOT NULL
      return 'Un champ obligatoire est vide.';
    case '22001': // valeur trop longue
      return 'Un texte saisi est trop long.';
    case '23514': // CHECK
      return "Une valeur saisie n'est pas acceptée. Vérifiez le formulaire.";
    default:
      return fallback;
  }
}

/**
 * Vérifie qu'une session est bien ouverte AVANT d'enregistrer.
 * Renvoie null si tout va bien, sinon le message à afficher.
 *
 * On préfère prévenir plutôt que laisser la personne remplir un formulaire entier
 * pour rien : la vérification coûte une lecture locale du jeton.
 */
export async function sessionProblem(
  getSession: () => Promise<{ data: { session: unknown | null } }>,
): Promise<string | null> {
  try {
    const { data } = await getSession();
    if (!data.session) {
      return "Votre session a expiré. Reconnectez-vous dans un autre onglet, puis revenez enregistrer : votre saisie est conservée.";
    }
    return null;
  } catch {
    return null; // on ne bloque pas sur un souci de lecture locale
  }
}
