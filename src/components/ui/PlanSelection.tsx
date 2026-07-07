import { Check, X } from 'lucide-react';
import { useUserPlans } from '../../lib/userPlans';

export type PlanType = 'free' | 'premium';

export type BillingInterval = 'monthly' | 'yearly';

interface PlanSelectionProps {
  selectedPlan: PlanType | null;
  onSelect: (plan: PlanType) => void;
  onContinue: () => void;
  onSwitchToLogin: () => void;
  billingInterval: BillingInterval;
  onIntervalChange: (interval: BillingInterval) => void;
}

export default function PlanSelection({ selectedPlan, onSelect, onContinue, onSwitchToLogin, billingInterval, onIntervalChange }: PlanSelectionProps) {
  const { freeFeatures, premiumFeatures } = useUserPlans();
  return (
    <div className="px-6 py-6 space-y-6">
      <div className="text-center">
        <h2 className="text-[22px] font-bold text-white">Rejoins Pass Navigay</h2>
        <p className="text-[14px] mt-2 mb-0" style={{ color: '#a0a0b0' }}>
          Choisis la formule qui te correspond.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <button
          type="button"
          onClick={() => onSelect('free')}
          className="flex-1 text-left rounded-[14px] p-5 transition-all cursor-pointer"
          style={{
            background: '#14141e',
            border: selectedPlan === 'free' ? '2px solid #7B2D8B' : '1px solid #2a2a3a',
          }}
          onMouseEnter={(e) => {
            if (selectedPlan !== 'free') e.currentTarget.style.borderColor = '#7B2D8B';
          }}
          onMouseLeave={(e) => {
            if (selectedPlan !== 'free') e.currentTarget.style.borderColor = '#2a2a3a';
          }}
        >
          <span
            className="inline-block px-2.5 py-0.5 rounded-full text-[12px] font-medium"
            style={{ background: '#2a2a3a', color: '#a0a0b0' }}
          >
            Gratuit
          </span>
          <div className="mt-3">
            <span className="text-[36px] font-bold text-white leading-none">0&euro;</span>
            <span className="text-[14px] ml-1" style={{ color: '#606070' }}>/mois</span>
          </div>
          <ul className="mt-4 space-y-2">
            {freeFeatures.map((f) => (
              <li key={f.label} className="flex items-start gap-2 text-[13px]">
                {f.included ? (
                  <Check size={14} className="mt-0.5 shrink-0" style={{ color: '#a0a0b0' }} strokeWidth={2.5} />
                ) : (
                  <X size={14} className="mt-0.5 shrink-0" style={{ color: '#2a2a3a' }} strokeWidth={2.5} />
                )}
                <span style={{ color: f.included ? '#a0a0b0' : '#2a2a3a' }}>{f.label}</span>
              </li>
            ))}
          </ul>
        </button>

        <button
          type="button"
          onClick={() => onSelect('premium')}
          className="flex-1 text-left rounded-[14px] p-5 relative transition-all cursor-pointer"
          style={{
            background: '#14141e',
            border: selectedPlan === 'premium' ? '2px solid #7B2D8B' : '2px solid #7B2D8B',
            boxShadow: '0 0 30px rgba(123,45,139,0.2)',
          }}
        >
          <div
            className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3.5 py-0.5 rounded-full"
            style={{ background: '#7B2D8B' }}
          >
            <span className="text-[11px] font-semibold text-white">Recommande &#10024;</span>
          </div>

          <span
            className="inline-block px-2.5 py-0.5 rounded-full text-[12px] font-medium"
            style={{ background: 'rgba(123,45,139,0.2)', color: '#c084f5' }}
          >
            Premium
          </span>
          <div className="mt-3">
            {billingInterval === 'yearly' ? (
              <>
                <span className="text-[36px] font-bold text-white leading-none">69&euro;</span>
                <span className="text-[14px] ml-1" style={{ color: '#606070' }}>/an</span>
              </>
            ) : (
              <>
                <span className="text-[36px] font-bold text-white leading-none">6,69&euro;</span>
                <span className="text-[14px] ml-1" style={{ color: '#606070' }}>/mois</span>
              </>
            )}
          </div>
          <p className="text-[11px] mt-1" style={{ color: '#606070' }}>
            {billingInterval === 'yearly' ? 'Soit 5,75€/mois · ' : ''}Sans engagement &middot; Resiliation a tout moment
          </p>
          <ul className="mt-4 space-y-2">
            {premiumFeatures.map((label) => (
              <li key={label} className="flex items-start gap-2 text-[13px]">
                <Check size={14} className="mt-0.5 shrink-0" style={{ color: '#c084f5' }} strokeWidth={2.5} />
                <span className="font-medium" style={{ color: '#c084f5' }}>{label}</span>
              </li>
            ))}
          </ul>
        </button>
      </div>

      {(
        <div className="flex items-center justify-center gap-1 p-1 rounded-[10px]" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <button
            type="button"
            onClick={() => onIntervalChange('monthly')}
            className="flex-1 py-2 px-3 rounded-[8px] text-[13px] font-medium transition-all"
            style={{ background: billingInterval === 'monthly' ? '#7B2D8B' : 'transparent', color: billingInterval === 'monthly' ? '#fff' : '#808090' }}
          >
            Mensuel — 6,69&euro;/mois
          </button>
          <button
            type="button"
            onClick={() => onIntervalChange('yearly')}
            className="flex-1 py-2 px-3 rounded-[8px] text-[13px] font-medium transition-all"
            style={{ background: billingInterval === 'yearly' ? '#7B2D8B' : 'transparent', color: billingInterval === 'yearly' ? '#fff' : '#808090' }}
          >
            Annuel — 69&euro;/an <span className="text-[11px] opacity-80">-14%</span>
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onContinue}
        disabled={!selectedPlan}
        className="w-full py-3.5 rounded-[10px] text-[15px] font-semibold text-white transition-all"
        style={{
          background: selectedPlan ? '#7B2D8B' : '#2a2a3a',
          cursor: selectedPlan ? 'pointer' : 'not-allowed',
          opacity: selectedPlan ? 1 : 0.5,
        }}
      >
        {selectedPlan
          ? `Continuer avec ${selectedPlan === 'free' ? 'Gratuit' : 'Premium'} \u2192`
          : 'Selectionne un plan pour continuer'}
      </button>

      <p className="text-center text-[13px]" style={{ color: '#606070' }}>
        Déjà un compte ?{' '}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-medium hover:underline"
          style={{ color: '#7B2D8B' }}
        >
          Connecte-toi
        </button>
      </p>
    </div>
  );
}
