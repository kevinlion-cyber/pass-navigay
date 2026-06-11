import { useState } from 'react';
import { X, Check, Loader2, Crown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface PremiumUpgradeModalProps {
  open: boolean;
  onClose: () => void;
}

const PREMIUM_FEATURES = [
  'Profil avec nom, prenom, photo',
  'Visualisation des evenements',
  "Acces a l'annuaire des lieux",
  'Acces aux promotions exclusives',
  'Messagerie entre membres Premium',
  'Profil enrichi et questionnaire',
  'Filtres avances',
  'Support prioritaire',
];

export default function PremiumUpgradeModal({ open, onClose }: PremiumUpgradeModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleUpgrade = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-premium-checkout`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      });
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
    } catch {
      // Stripe not configured yet
    }

    setLoading(false);
  };

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
        <p className="text-[14px] text-center mt-2 mb-1" style={{ color: '#a0a0b0' }}>
          Debloque toutes les fonctionnalites
        </p>

        <div className="text-center my-4">
          <span className="text-[36px] font-bold text-white">69&euro;</span>
          <span className="text-[14px] ml-1" style={{ color: '#606070' }}>/an</span>
        </div>
        <p className="text-[11px] text-center mb-5" style={{ color: '#606070' }}>
          Engagement annuel &middot; Paiement securise
        </p>

        <ul className="space-y-2.5 mb-6">
          {PREMIUM_FEATURES.map((label) => (
            <li key={label} className="flex items-start gap-2 text-[13px]">
              <Check size={14} className="mt-0.5 shrink-0" style={{ color: '#c084f5' }} strokeWidth={2.5} />
              <span className="font-medium" style={{ color: '#c084f5' }}>{label}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="w-full py-3.5 rounded-[10px] text-[15px] font-semibold text-white transition-all flex items-center justify-center gap-2"
          style={{ background: '#7B2D8B' }}
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          Passer Premium &mdash; 69&euro;/an
        </button>

        <button
          onClick={onClose}
          className="w-full mt-3 py-2.5 rounded-[10px] text-[13px] font-medium transition-colors"
          style={{ color: '#606070' }}
        >
          Peut-etre plus tard
        </button>
      </div>
    </div>
  );
}
