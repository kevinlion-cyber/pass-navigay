/**
 * Préchargement en arrière-plan des onglets courants (27/11/2026).
 *
 * Ces pages ne font plus partie du premier téléchargement : l'annuaire s'affiche plus
 * vite. Une fois la page affichée et le navigateur au repos, on télécharge quand même
 * leur code, pour qu'ouvrir l'Agenda, les Promos ou une fiche reste instantané.
 * Pas de préchargement si le visiteur a activé l'économiseur de données.
 * (Les mêmes import() que dans App.tsx : le navigateur ne télécharge qu'une fois.)
 */
const PAGES: Array<() => Promise<unknown>> = [
  () => import('../pages/EstablishmentDetail'),
  () => import('../pages/Events'),
  () => import('../pages/Promos'),
  () => import('../pages/Members'),
  () => import('../pages/EventDetail'),
  () => import('../pages/PromoDetail'),
  () => import('../pages/auth/Register'),
  () => import('../pages/auth/Login'),
];

let fait = false;

export function prechargerPagesCourantes(): void {
  if (fait || typeof window === 'undefined') return;
  fait = true;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return;

  const lancer = () => {
    // Une page après l'autre, pour ne pas concurrencer la carte et les images.
    PAGES.reduce<Promise<unknown>>((p, charger) => p.then(() => charger().catch(() => undefined)), Promise.resolve());
  };
  const auRepos = () => {
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(lancer, { timeout: 4000 }); else setTimeout(lancer, 2500);
  };
  if (document.readyState === 'complete') auRepos();
  else window.addEventListener('load', auRepos, { once: true });
}
