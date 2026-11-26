import { lazy, type ComponentType } from 'react';

/**
 * Chargement à la demande d'une page, avec une sécurité pour les mises à jour.
 *
 * Après une nouvelle mise en ligne, un visiteur dont l'onglet était déjà ouvert peut
 * réclamer un morceau de l'ancienne version qui n'existe plus : la page ne s'afficherait
 * pas. Dans ce cas on recharge la page une seule fois (repère en sessionStorage pour ne
 * jamais boucler), ce qui récupère la nouvelle version.
 */
const CLE = 'pn_relance_chunk';

export function lazyAvecRelance<T extends ComponentType<object>>(charger: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await charger();
      try { sessionStorage.removeItem(CLE); } catch { /* indisponible */ }
      return mod;
    } catch (err) {
      let dejaRelance = false;
      try { dejaRelance = sessionStorage.getItem(CLE) === '1'; } catch { /* indisponible */ }
      if (!dejaRelance) {
        try { sessionStorage.setItem(CLE, '1'); } catch { /* indisponible */ }
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}
