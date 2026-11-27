import { Link } from 'react-router-dom';
import { openAnalyticsConsent } from '../../lib/analytics';

/**
 * Ligne discrète de liens légaux, visible par tous (visiteurs compris).
 * - Mentions légales « facilement accessibles » (LCEN, art. 6).
 * - « Gérer mes cookies » rouvre le bandeau : retirer son accord doit être aussi
 *   simple que le donner (CNIL). Ajouté le 27/11/2026 à la demande de Kévin.
 */
export default function LiensLegaux({ sombre = false, className = '' }: { sombre?: boolean; className?: string }) {
  const couleur = sombre
    ? 'text-[#606070] hover:text-[#c084f5]'
    : 'text-gray-500 dark:text-gray-400 hover:text-primary';
  const lien = `${couleur} transition-colors whitespace-nowrap`;
  const sep = <span aria-hidden="true" className={sombre ? 'text-[#2a2a35]' : 'text-gray-300 dark:text-gray-600'}>·</span>;

  return (
    <nav aria-label="Informations légales" className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] ${className}`}>
      <Link to="/legal/mentions" className={lien}>Mentions légales</Link>
      {sep}
      <Link to="/legal/cgu" className={lien}>CGU</Link>
      {sep}
      <Link to="/legal/confidentialite" className={lien}>Confidentialité</Link>
      {sep}
      <Link to="/legal/contact" className={lien}>Contact</Link>
      {sep}
      <button type="button" onClick={openAnalyticsConsent} className={lien}>Gérer mes cookies</button>
    </nav>
  );
}
