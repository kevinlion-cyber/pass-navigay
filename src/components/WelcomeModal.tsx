import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Calendar, Users, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

/**
 * Mot de bienvenue affiché PAR-DESSUS le site, sur la page d'accueil.
 *
 * Avant, c'était une page à part (`Landing`) : on arrivait sur un écran vide de
 * contenu, et un visiteur non connecté n'avait aucun moyen d'entrer quand le
 * réglage « inscription obligatoire » était actif. Google ne voyait donc jamais
 * l'annuaire. Ici, le site est déjà chargé derrière : on ferme, on est dedans.
 *
 * Le réglage `require_signup` reste respecté, mais comme MISE EN AVANT de
 * l'inscription (bouton principal) et non plus comme un mur : « Explorer le
 * site » reste toujours possible.
 */

const FEATURES = [
  { icon: MapPin, title: 'Trouvez votre lieu idéal', text: 'Des établissements inclusifs et bienveillants près de chez vous.' },
  { icon: Calendar, title: 'Suivez les événements', text: 'Soirées, brunchs, expositions : restez informé de ce qui bouge.' },
  { icon: Users, title: 'Rejoignez la communauté', text: 'Échangez avec les autres membres et partagez vos coups de cœur.' },
];

export default function WelcomeModal() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [requireSignup, setRequireSignup] = useState(true);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Un membre qui a demandé à ne plus voir ce message ne le revoit jamais.
  useEffect(() => {
    if (user && profile && !profile.show_onboarding) { setOpen(false); return; }
    setOpen(true);
  }, [user, profile]);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'require_signup').maybeSingle()
      .then(({ data }) => setRequireSignup(data ? data.value === 'true' : true));
  }, []);

  const close = async () => {
    setOpen(false);
    if (dontShowAgain && user) {
      await supabase.from('profiles').update({ show_onboarding: false }).eq('id', user.id);
    }
  };

  // Fermeture au clavier : une modale qui ne se ferme pas à Échap est une impasse.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!open) return null;

  const signupFirst = !user && requireSignup;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      onClick={close}
    >
      <div
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-card bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border p-6 sm:p-7 space-y-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          aria-label="Fermer et découvrir le site"
          className="absolute right-3 top-3 w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-light-bg dark:hover:bg-dark-bg transition-colors"
        >
          <X size={18} />
        </button>

        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-primary mx-auto flex items-center justify-center">
            <span className="text-white text-2xl font-semibold">P</span>
          </div>
          <h1 id="welcome-title" className="text-2xl font-semibold text-gray-900 dark:text-white">Pass Navigay</h1>
          <p className="text-gray-600 dark:text-gray-400">Découvrez les lieux LGBT-friendly près de chez vous.</p>
        </div>

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

        <div className="space-y-3">
          {signupFirst ? (
            <>
              <button onClick={() => navigate('/auth/register')} className="btn-primary w-full py-3">
                Créer mon compte
              </button>
              <button
                onClick={close}
                className="w-full py-3 rounded-input border border-light-border dark:border-dark-border text-gray-700 dark:text-gray-300 hover:border-primary hover:text-primary transition-colors"
              >
                Explorer le site
              </button>
            </>
          ) : (
            <button onClick={close} className="btn-primary w-full py-3">
              Explorer le site
            </button>
          )}

          {user && (
            <label className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              Ne plus afficher ce message
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
