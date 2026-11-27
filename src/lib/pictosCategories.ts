/**
 * Pictogrammes des catégories sur la carte (demande de Kévin, 26/11/2026) : chaque lieu
 * isolé est montré par l'icône de sa catégorie au lieu d'un simple point violet. Les
 * pastilles numérotées de regroupement ne changent pas.
 *
 * Tracés repris de la bibliothèque d'icônes déjà utilisée par le site (lucide, licence
 * ISC), copiés ici en texte pour ne pas fabriquer un composant React par lieu : la carte
 * peut en afficher jusqu'à 1000. Ce sont des constantes, jamais du texte venu de la base.
 */
const PICTOS: Record<string, string> = {
  // Se loger : lit
  se_loger: '<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/>',
  // Shopping : sac
  shopping: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  // Manger : couverts
  manger: '<path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8"/><path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7"/><path d="m2.1 21.8 6.4-6.3"/><path d="m19 5-7 7"/>',
  // Soirée : cocktail
  soiree: '<path d="M8 22h8"/><path d="M12 11v11"/><path d="m19 3-7 8-7-8Z"/>',
  // Bien-être : étincelles
  bien_etre: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>',
  // Culture : monument
  culture: '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
  // Communauté & santé : cœur (ajouté le 27/11/2026)
  communaute: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  // Pros safe : ciseaux
  services: '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
  // Sport & plein air : haltère
  sport: '<path d="M14.4 14.4 9.6 9.6"/><path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z"/><path d="m21.5 21.5-1.4-1.4"/><path d="M3.9 3.9 2.5 2.5"/><path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z"/>',
  // Coquin 18+ : flamme
  adulte: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
};
// Catégorie inconnue (ajoutée plus tard dans l'admin) : épingle.
const PICTO_DEFAUT = '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>';

export const COULEUR_LIEU = '#7B2D8B';
export const COULEUR_SPONSOR = '#d4a017';

export function svgPictoCategorie(category: string | null | undefined, taille = 16): string {
  const traces = (category && PICTOS[category]) || PICTO_DEFAUT;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${traces}</svg>`;
}

/** Pastille ronde (violette, dorée pour un sponsor) avec l'icône de la catégorie. */
export function creerPastilleLieu(category: string | null | undefined, sponsor: boolean, titre: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'cursor-pointer';
  el.title = titre;
  Object.assign(el.style, {
    width: '30px',
    height: '30px',
    borderRadius: '9999px',
    border: '2px solid #fff',
    backgroundColor: sponsor ? COULEUR_SPONSOR : COULEUR_LIEU,
    boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });
  el.innerHTML = svgPictoCategorie(category);
  return el;
}
