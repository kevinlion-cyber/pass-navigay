import { useState } from 'react';
import { Crown } from 'lucide-react';
import PremiumUpgradeModal from '../../components/ui/PremiumUpgradeModal';

export default function PremiumBanner() {
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  return (
    <>
      <div
        className="rounded-xl p-5 space-y-3"
        style={{
          background: 'rgba(123,45,139,0.1)',
          border: '1px solid rgba(123,45,139,0.4)',
        }}
      >
        <p className="text-[15px] font-semibold text-white">
          Passe Premium pour debloquer :
        </p>
        <ul className="space-y-1.5 text-[13px]" style={{ color: '#c0c0d0' }}>
          <li className="flex items-center gap-2">
            <span style={{ color: '#c084f5' }}>&#183;</span>
            La messagerie avec les membres
          </li>
          <li className="flex items-center gap-2">
            <span style={{ color: '#c084f5' }}>&#183;</span>
            Ton profil enrichi et visible
          </li>
          <li className="flex items-center gap-2">
            <span style={{ color: '#c084f5' }}>&#183;</span>
            L'acces aux promotions exclusives
          </li>
        </ul>
        <button
          onClick={() => setUpgradeOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-[14px] font-semibold text-white transition-all hover:opacity-90 mt-1"
          style={{ background: '#7B2D8B' }}
        >
          <Crown size={16} />
          Passer Premium &mdash; 6,69&euro;/mois
        </button>
      </div>

      <PremiumUpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </>
  );
}
