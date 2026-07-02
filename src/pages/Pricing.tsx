import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

const PRO_FEATURES = [
  'Bandeau personnalise dans l\'annuaire',
  'Galerie photos',
  'Description complete',
  'Creation d\'evenements',
  'Systeme de promotions / couponing',
  'Boutons de partage',
  'Visibilite renforcee',
];

const PREMIUM_FEATURES = [
  'Badge Premium sur le profil',
  'Laisse des avis (qualite & Safe place) sur les etablissements',
];

// Prix reels (doivent correspondre a create-premium-checkout : mensuel 669, annuel 69 EUR).
const PREMIUM_MONTHLY = 6.69;
const PREMIUM_YEARLY = 69;
// Reduction annuelle calculee (jamais fausse) : vs 12 mois au tarif mensuel.
const PREMIUM_YEARLY_DISCOUNT = Math.round((1 - PREMIUM_YEARLY / (PREMIUM_MONTHLY * 12)) * 100);
const PREMIUM_YEARLY_PER_MONTH = (PREMIUM_YEARLY / 12).toLocaleString('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function Pricing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<'pro' | 'premium' | null>(null);
  const [premiumInterval, setPremiumInterval] = useState<'monthly' | 'yearly'>('yearly');

  const handleSubscribe = async (type: 'pro' | 'premium') => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    if (type === 'pro') {
      navigate('/pros');
      return;
    }

    setLoading(type);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-premium-checkout`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ billingInterval: premiumInterval }),
      });
      const data = await res.json();
      if (data?.url) {
        window.open(data.url, '_blank');
        return;
      }
      toast.error(data?.error || 'Erreur lors de la creation du paiement');
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setLoading(null);
    }
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
              <span className="text-3xl font-semibold text-gray-900 dark:text-white">690</span>
              <span className="text-gray-500 dark:text-gray-400"> EUR/an</span>
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

            {/* Billing toggle */}
            <div className="flex items-center gap-1 mt-3 p-1 rounded-lg bg-gray-100 dark:bg-white/5">
              <button
                onClick={() => setPremiumInterval('monthly')}
                className={`flex-1 py-1.5 px-3 rounded-md text-[13px] font-medium transition-all ${
                  premiumInterval === 'monthly'
                    ? 'bg-white dark:bg-purple-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                Mensuel
              </button>
              <button
                onClick={() => setPremiumInterval('yearly')}
                className={`flex-1 py-1.5 px-3 rounded-md text-[13px] font-medium transition-all ${
                  premiumInterval === 'yearly'
                    ? 'bg-white dark:bg-purple-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                Annuel <span className="text-[11px] opacity-70">-{PREMIUM_YEARLY_DISCOUNT}%</span>
              </button>
            </div>

            <div className="mt-3">
              {premiumInterval === 'yearly' ? (
                <>
                  <span className="text-3xl font-semibold text-gray-900 dark:text-white">{PREMIUM_YEARLY}</span>
                  <span className="text-gray-500 dark:text-gray-400"> EUR/an</span>
                  <p className="text-xs text-gray-400 mt-0.5">soit {PREMIUM_YEARLY_PER_MONTH} EUR/mois</p>
                </>
              ) : (
                <>
                  <span className="text-3xl font-semibold text-gray-900 dark:text-white">6,69</span>
                  <span className="text-gray-500 dark:text-gray-400"> EUR/mois</span>
                  <p className="text-xs text-gray-400 mt-0.5">Sans engagement, resiliable a tout moment</p>
                </>
              )}
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

          <button onClick={() => handleSubscribe('premium')} disabled={loading === 'premium'} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading === 'premium' && <Loader2 size={16} className="animate-spin" />}
            Souscrire Premium
          </button>
        </div>
      </div>
    </div>
  );
}
