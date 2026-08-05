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
const KEY = 'pn_welcome_seen';

export function welcomeSeen(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
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
