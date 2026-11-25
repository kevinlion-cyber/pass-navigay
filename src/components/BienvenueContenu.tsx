import { useState } from 'react';
import { MapPin, Calendar, Users, Check } from 'lucide-react';
import { usePopupText } from '../lib/popups';

/**
 * Logo, titre, texte et atouts du mot de bienvenue (textes modifiables dans
 * l'administration). Partagé par le mot de bienvenue des membres (WelcomeModal)
 * et par l'invitation à créer un compte des visiteurs (InscriptionGateModal).
 */
const FEATURES = [
  { icon: MapPin, title: 'Trouvez votre lieu idéal', text: 'Des établissements inclusifs et bienveillants près de chez vous.' },
  { icon: Calendar, title: 'Suivez les événements', text: 'Soirées, brunchs, expositions : restez informé de ce qui bouge.' },
  { icon: Users, title: 'Rejoignez la communauté', text: 'Échangez avec les autres membres et partagez vos coups de cœur.' },
];

/**
 * `avantages` : liste à afficher à la place des trois atouts fixes (ex. les avantages de
 * la formule Gratuite gérés dans Admin → Tarifs). « Titre — détail » est mis en forme
 * sur deux lignes.
 */
export default function BienvenueContenu({ titreId, intro, avantages }: { titreId?: string; intro?: string; avantages?: string[] }) {
  const t = usePopupText('welcome');
  const [logoBroken, setLogoBroken] = useState(false);
  return (
    <>
        <div className="text-center space-y-3">
          {/* Logo : celui choisi dans l'administration, sinon celui du site. La
              lettre « P » ne sert plus que si aucune image ne charge : c'était un
              simple bouche-trou, et il n'y avait aucun moyen de le remplacer sans
              toucher au code. */}
          {logoBroken ? (
            <div className="w-16 h-16 rounded-full bg-primary mx-auto flex items-center justify-center">
              <span className="text-white text-2xl font-semibold">P</span>
            </div>
          ) : (
            <img
              src={t.logo_url || '/logo.png?v=2'}
              alt=""
              onError={() => setLogoBroken(true)}
              className="w-16 h-16 mx-auto object-contain"
            />
          )}
          <h1 id={titreId} className="text-2xl font-semibold text-gray-900 dark:text-white">{t.title}</h1>
          <p className="text-gray-600 dark:text-gray-400">{intro || t.body}</p>
        </div>

        {avantages && avantages.length > 0 ? (
          <ul className="space-y-3">
            {avantages.map((label) => {
              const [titre, ...reste] = label.split(' — ');
              const detail = reste.join(' — ');
              return (
                <li key={label} className="flex items-start gap-3 text-left">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Check size={15} className="text-primary" strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{titre}</p>
                    {detail && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{detail}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-start gap-3 text-left">
                <div className="w-9 h-9 rounded-card bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white text-sm">{title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{text}</p>
                </div>
              </div>
            ))}
          </div>
        )}

    </>
  );
}
