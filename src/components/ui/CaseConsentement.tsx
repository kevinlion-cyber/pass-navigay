import { Link } from 'react-router-dom';

/**
 * Cases à cocher légales (27/11/2026, validées par Kévin).
 * - Inscription : âge + CGU + confidentialité.
 * - Paiement Premium (particuliers) : demande expresse d'exécution immédiate. Le Premium
 *   est un service : le droit de rétractation de 14 jours reste ouvert, le membre ne paie
 *   alors que la période utilisée (art. L221-25 du Code de la consommation). On ne lui fait
 *   donc pas « renoncer » à ce droit (formulation corrigée le 27/11/2026).
 * - Paiement Pro (professionnels) : acceptation des conditions de vente.
 * Les liens s'ouvrent dans un nouvel onglet pour ne pas perdre la saisie en cours.
 * Paiements : information sous la case (28/11/2026) sur les e-mails de bons plans envoyés aux
 * clients (offres similaires, art. L34-5 du CPCE), avec désinscription possible à tout moment.
 */

export type TypeConsentement = 'inscription' | 'paiement_premium' | 'paiement_pro';

function LienLegal({ to, children, sombre }: { to: string; children: React.ReactNode; sombre: boolean }) {
  return (
    <Link
      to={to}
      target="_blank"
      rel="noopener"
      onClick={(e) => e.stopPropagation()}
      className={`underline underline-offset-2 ${sombre ? 'text-[#c084f5]' : 'text-primary'}`}
    >
      {children}
    </Link>
  );
}

export default function CaseConsentement({
  type,
  coche,
  onChange,
  sombre = false,
  className = '',
}: {
  type: TypeConsentement;
  coche: boolean;
  onChange: (v: boolean) => void;
  /** Fenêtres à fond sombre fixe (espace Pros, fenêtre Premium). */
  sombre?: boolean;
  className?: string;
}) {
  const texte = sombre ? 'text-[#a0a0b0]' : 'text-gray-600 dark:text-gray-300';
  let contenu: React.ReactNode;
  if (type === 'inscription') {
    contenu = (
      <>
        J'ai 18 ans ou plus et j'accepte les{' '}
        <LienLegal to="/legal/cgu" sombre={sombre}>Conditions d'utilisation</LienLegal> et la{' '}
        <LienLegal to="/legal/confidentialite" sombre={sombre}>Politique de confidentialité</LienLegal>.
      </>
    );
  } else if (type === 'paiement_premium') {
    contenu = (
      <>
        Je demande à profiter du Premium tout de suite. Si je me rétracte dans les 14 jours, je
        paierai seulement la période déjà utilisée. J'ai lu les <LienLegal to="/legal/cgu" sombre={sombre}>Conditions de vente</LienLegal>.
      </>
    );
  } else {
    contenu = (
      <>
        J'accepte les <LienLegal to="/legal/cgu" sombre={sombre}>Conditions de vente</LienLegal>.
      </>
    );
  }

  const case_ = (
    <label className={`flex items-start gap-2.5 text-left text-[12.5px] leading-snug cursor-pointer ${texte} ${type === 'inscription' ? className : ''}`}>
      <input
        type="checkbox"
        checked={coche}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-[#7B2D8B]"
      />
      <span>{contenu}</span>
    </label>
  );
  if (type === 'inscription') return case_;
  return (
    <div className={className}>
      {case_}
      <p className={`mt-1.5 pl-[26px] text-left text-[11px] leading-snug ${sombre ? 'text-[#808090]' : 'text-gray-500'}`}>
        {type === 'paiement_pro'
          ? 'En tant que client, vous pourrez recevoir nos actualités et offres par e-mail. Désinscription en un clic dans chaque e-mail.'
          : 'En tant que client, tu pourras recevoir nos bons plans par e-mail. Désinscription en un clic dans chaque e-mail.'}
      </p>
    </div>
  );
}
