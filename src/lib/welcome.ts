/**
 * Mémoire du mot de bienvenue pour un visiteur NON connecté.
 *
 * Sans ça, dire « pas maintenant » dans l'inscription ramenait sur l'accueil…
 * qui rouvrait aussitôt le mot de bienvenue proposant de créer un compte. On
 * tournait en rond. Un membre connecté est géré autrement (`show_onboarding`
 * sur son profil), qui lui est durable.
 *
 * Le stockage peut être indisponible (navigation privée, cookies bloqués) :
 * toute erreur est avalée, on retombe simplement sur « on affiche le message ».
 */
/** Écarté pour cette visite seulement (on ferme la fenêtre, le message revient demain). */
const KEY = 'pn_welcome_seen';
/** « Ne plus afficher » coché par un visiteur non connecté : durable, pas juste la visite. */
const NEVER = 'pn_welcome_never';

export function welcomeSeen(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1' || localStorage.getItem(NEVER) === '1';
  } catch {
    return false;
  }
}

export function markWelcomeSeen(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    /* stockage indisponible : le message se réaffichera, ce n'est pas bloquant */
  }
}

/** Coche « ne plus afficher » d'un visiteur non connecté (il n'a pas de profil où le noter). */
export function markWelcomeNever(): void {
  try {
    localStorage.setItem(NEVER, '1');
  } catch {
    /* idem */
  }
}
