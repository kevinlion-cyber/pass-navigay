import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, Check, Loader2, Crown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useUserPlans } from '../../lib/userPlans';
import toast from 'react-hot-toast';
import CaseConsentement from './CaseConsentement';
import { ouvrirGestionAbonnementPremium } from '../../lib/abonnementPremium';

interface PremiumUpgradeModalProps {
  open: boolean;
  onClose: () => void;
}


export default function PremiumUpgradeModal({ open, onClose }: PremiumUpgradeModalProps) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('yearly');
  const [demarrageImmediat, setDemarrageImmediat] = useState(false);
  // Même liste que la page Tarifs, modifiable dans Admin → Tarifs (avant : une liste
  // figée ici, sans accents, qui mélangeait des avantages gratuits).
  const { premiumFeatures } = useUserPlans();

  if (!open) return null;

  const handleUpgrade = async () => {
    // Sans compte, il n'y a rien à facturer : on l'emmène créer son compte en gardant
    // la formule choisie ici (mensuelle ou annuelle) ; le paiement suit l'inscription,
    // puis elle revient sur cette page.
    if (!user) {
      onClose();
      navigate(`/inscription?plan=premium&billing=${billingInterval}&redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }
    // Déjà Premium : jamais de second abonnement, on ouvre la gestion à la place.
    if (profile?.is_premium) {
      setLoading(true);
      if (!(await ouvrirGestionAbonnementPremium())) setLoading(false);
      return;
    }
    if (!demarrageImmediat) {
      toast.error('Coche la case pour démarrer ton Premium tout de suite.');
      return;
    }
    setLoading(true);

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
        body: JSON.stringify({ billingInterval, executionImmediate: true }),
      });
      const data = await res.json();
      if (data?.url) {
        window.open(data.url, '_blank');
        return;
      }
      if (data?.error) toast.error(data.error);
    } catch {
      // Stripe not configured yet
    }

    setLoading(false);
  };

  const yearlyPrice = 69;
  const monthlyPrice = 6.69;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-[380px] rounded-[14px] p-6 overflow-y-auto"
        style={{
          background: '#14141e',
          border: '2px solid #7B2D8B',
          boxShadow: '0 0 30px rgba(123,45,139,0.2)',
          animation: 'fadeSlideIn 0.25s ease-out',
          maxHeight: '85vh',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-4 right-4 transition-colors"
          style={{ color: '#606070' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#606070')}
        >
          <X size={20} />
        </button>

        <div className="flex justify-center mb-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(123,45,139,0.2)' }}
          >
            <Crown size={28} style={{ color: '#c084f5' }} />
          </div>
        </div>

        <h2 className="text-[20px] font-bold text-white text-center">Passe Premium</h2>
        <p className="text-[14px] text-center mt-2 mb-4" style={{ color: '#a0a0b0' }}>
          Débloque toutes les fonctionnalités
        </p>

        {/* Billing interval toggle */}
        <div className="flex items-center justify-center gap-1 mb-4 p-1 rounded-[10px]" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <button
            onClick={() => setBillingInterval('monthly')}
            className="flex-1 py-2 px-3 rounded-[8px] text-[13px] font-medium transition-all"
            style={{
              background: billingInterval === 'monthly' ? '#7B2D8B' : 'transparent',
              color: billingInterval === 'monthly' ? '#fff' : '#808090',
            }}
          >
            Mensuel
          </button>
          <button
            onClick={() => setBillingInterval('yearly')}
            className="flex-1 py-2 px-3 rounded-[8px] text-[13px] font-medium transition-all"
            style={{
              background: billingInterval === 'yearly' ? '#7B2D8B' : 'transparent',
              color: billingInterval === 'yearly' ? '#fff' : '#808090',
            }}
          >
            Annuel
            <span className="ml-1 text-[11px] opacity-80">-27%</span>
          </button>
        </div>

        <div className="text-center my-4">
          {billingInterval === 'yearly' ? (
            <>
              <span className="text-[36px] font-bold text-white">{yearlyPrice}&euro;</span>
              <span className="text-[14px] ml-1" style={{ color: '#606070' }}>/an TTC</span>
              <p className="text-[12px] mt-1" style={{ color: '#808090' }}>
                soit {(yearlyPrice / 12).toFixed(2).replace('.', ',')}&euro;/mois
              </p>
            </>
          ) : (
            <>
              <span className="text-[36px] font-bold text-white">{monthlyPrice.toFixed(2).replace('.', ',')}&euro;</span>
              <span className="text-[14px] ml-1" style={{ color: '#606070' }}>/mois TTC</span>
              <p className="text-[12px] mt-1" style={{ color: '#808090' }}>
                Sans engagement
              </p>
            </>
          )}
        </div>

        <ul className="space-y-2.5 mb-6">
          {premiumFeatures.map((label) => {
            // « Titre — détail » (Admin → Tarifs) : titre en avant, détail en dessous.
            const [titre, ...reste] = label.split(' — ');
            const detail = reste.join(' — ');
            return (
              <li key={label} className="flex items-start gap-2 text-[13px]">
                <Check size={14} className="mt-0.5 shrink-0" style={{ color: '#c084f5' }} strokeWidth={2.5} />
                <span>
                  <span className="font-medium block" style={{ color: '#c084f5' }}>{titre}</span>
                  {detail && <span className="block mt-0.5" style={{ color: '#a0a0b0' }}>{detail}</span>}
                </span>
              </li>
            );
          })}
        </ul>

        {/* Membre connecté et pas encore Premium : le paiement suit directement. Pour
            un visiteur, la même case est demandée dans le tunnel d'inscription. */}
        {user && !profile?.is_premium && (
          <CaseConsentement type="paiement_premium" sombre coche={demarrageImmediat} onChange={setDemarrageImmediat} className="mb-3" />
        )}

        <button
          onClick={handleUpgrade}
          disabled={loading || (!!user && !profile?.is_premium && !demarrageImmediat)}
          className="w-full py-3.5 rounded-[10px] text-[15px] font-semibold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: '#7B2D8B' }}
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          Passer Premium &mdash; {billingInterval === 'yearly' ? `${yearlyPrice}\u20AC TTC/an` : `${monthlyPrice.toFixed(2).replace('.', ',')}\u20AC TTC/mois`}
        </button>

        {!user && (
          <button
            onClick={() => { onClose(); navigate(`/inscription?redirect=${encodeURIComponent(location.pathname)}`); }}
            className="w-full mt-3 py-2 text-[13px] font-medium underline-offset-2 hover:underline"
            style={{ color: '#c084f5' }}
          >
            Créer d'abord mon compte, sans abonnement
          </button>
        )}

        <button
          onClick={onClose}
          className="w-full mt-3 py-2.5 rounded-[10px] text-[13px] font-medium transition-colors"
          style={{ color: '#606070' }}
        >
          Peut-être plus tard
        </button>
      </div>
    </div>
  );
}
