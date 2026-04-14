import { Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const PRO_FEATURES = [
  'Bandeau personnalise dans l\'annuaire',
  'Galerie photos illimitee',
  'Description complete',
  'Creation d\'evenements',
  'Systeme de promotions / couponing',
  'Boutons de partage',
  'Visibilite renforcee',
];

const PREMIUM_FEATURES = [
  'Acces aux filtres detailles avances',
  'Badge Premium sur le profil',
  'Support prioritaire',
];

export default function Pricing() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSubscribe = (type: 'pro' | 'premium') => {
    if (!user) {
      navigate('/auth/login');
      return;
    }
    toast('L\'integration Stripe sera activee prochainement.');
  };

  return (
    <div className="max-w-4xl mx-auto p-4 py-12 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Tarifs</h1>
        <p className="text-gray-500 dark:text-gray-400">Choisis l'offre qui te convient</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Profil Pro Etablissement</h2>
            <div className="mt-2">
              <span className="text-3xl font-semibold text-gray-900 dark:text-white">69</span>
              <span className="text-gray-500 dark:text-gray-400"> EUR/mois</span>
            </div>
          </div>

          <ul className="space-y-3">
            {PRO_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400">
                <Check size={16} className="text-success shrink-0 mt-0.5" />
                {feature}
              </li>
            ))}
          </ul>

          <button onClick={() => handleSubscribe('pro')} className="btn-primary w-full">
            Souscrire Pro
          </button>
        </div>

        <div className="card p-6 space-y-6 border-primary">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Premium Utilisateur</h2>
            <div className="mt-2">
              <span className="text-3xl font-semibold text-gray-900 dark:text-white">6,69</span>
              <span className="text-gray-500 dark:text-gray-400"> EUR/mois</span>
            </div>
          </div>

          <ul className="space-y-3">
            {PREMIUM_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400">
                <Check size={16} className="text-success shrink-0 mt-0.5" />
                {feature}
              </li>
            ))}
          </ul>

          <button onClick={() => handleSubscribe('premium')} className="btn-primary w-full">
            Souscrire Premium
          </button>
        </div>
      </div>
    </div>
  );
}
