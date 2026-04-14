import { Check } from 'lucide-react';

const FREE_FEATURES = [
  { label: 'Apparition dans l\u2019annuaire', included: true },
  { label: 'Fiche avec nom, adresse, catégorie', included: true },
  { label: 'Bannière personnalisée', included: false },
  { label: 'Galerie photos', included: false },
  { label: 'Création d\u2019événements', included: false },
  { label: 'Système de promotions', included: false },
  { label: 'Visibilité renforcée dans les résultats', included: false },
  { label: 'Support prioritaire', included: false },
];

const PRO_FEATURES = [
  'Apparition dans l\u2019annuaire',
  'Fiche avec nom, adresse, catégorie',
  'Bannière personnalisée',
  'Galerie photos illimitée',
  'Création d\u2019événements',
  'Système de promotions / couponing',
  'Visibilité renforcée dans les résultats',
  'Support prioritaire',
];

interface ProsPricingProps {
  onRegister: () => void;
}

export default function ProsPricing({ onRegister }: ProsPricingProps) {
  return (
    <section className="py-[100px] px-6" style={{ background: '#0f0f17' }}>
      <div className="max-w-[900px] mx-auto">
        <h2 className="text-[32px] md:text-[40px] font-extrabold text-white text-center">
          Choisis ta formule
        </h2>
        <p className="text-[18px] text-[#a0a0b0] text-center mt-4">
          Commence gratuitement. Passe Pro quand tu es prêt.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-[60px]">
          <div className="flex flex-col order-2 md:order-1 rounded-[20px] p-10" style={{ background: '#14141e', border: '1px solid #1e1e2e' }}>
            <span className="inline-block self-start px-3 py-1 rounded-full text-[13px] font-medium text-[#a0a0b0]" style={{ background: '#2a2a3a' }}>
              Gratuit
            </span>
            <div className="mt-5">
              <span className="text-[56px] font-bold text-white leading-none">0&euro;</span>
              <span className="text-[18px] text-[#606070] ml-1">/mois</span>
            </div>
            <p className="text-[14px] text-[#a0a0b0] mt-2">Pour démarrer et être visible sur l&rsquo;annuaire.</p>

            <ul className="mt-8 space-y-3.5 flex-1">
              {FREE_FEATURES.map((f) => (
                <li key={f.label} className="flex items-start gap-3 text-[14px]">
                  {f.included ? (
                    <Check size={16} className="text-[#7B2D8B] mt-0.5 shrink-0" strokeWidth={2.5} />
                  ) : (
                    <span className="text-[#2a2a3a] mt-0.5 shrink-0 text-[14px] leading-none">&times;</span>
                  )}
                  <span className={f.included ? 'text-[#c0c0d0] font-semibold' : 'text-[#2a2a3a]'}>{f.label}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={onRegister}
              className="mt-8 block w-full text-center py-3.5 rounded-[10px] text-[14px] font-medium text-white transition-colors hover:border-[#7B2D8B]"
              style={{ border: '1px solid rgba(255,255,255,0.3)' }}
            >
              Commencer gratuitement
            </button>
          </div>

          <div
            className="flex flex-col relative order-1 md:order-2 rounded-[20px] p-10"
            style={{ background: '#14141e', border: '2px solid #7B2D8B', boxShadow: '0 0 40px rgba(123,45,139,0.3)' }}
          >
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-4 py-1 bg-[#7B2D8B] rounded-full">
              <span className="text-[12px]">&#10024;</span>
              <span className="text-[12px] font-semibold text-white">Recommandé</span>
            </div>

            <span className="inline-block self-start px-3 py-1 rounded-full text-[13px] font-medium text-[#c084f5]" style={{ background: 'rgba(123,45,139,0.2)' }}>
              Pro
            </span>
            <div className="mt-5">
              <span className="text-[56px] font-bold text-white leading-none">69&euro;</span>
              <span className="text-[18px] text-[#606070] ml-1">/mois</span>
            </div>
            <p className="text-[14px] text-[#a0a0b0] mt-2">Tout ce qu&rsquo;il faut pour développer ta visibilité.</p>

            <ul className="mt-8 space-y-3.5 flex-1">
              {PRO_FEATURES.map((label) => (
                <li key={label} className="flex items-start gap-3 text-[14px]">
                  <Check size={16} className="text-[#c084f5] mt-0.5 shrink-0" strokeWidth={2.5} />
                  <span className="text-[#e0e0f0] font-semibold">{label}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={onRegister}
              className="mt-8 block w-full text-center py-3.5 rounded-[10px] bg-[#7B2D8B] text-white text-[14px] font-semibold transition-all hover:bg-[#9b3dab]"
            >
              Démarrer avec le Pro
            </button>
          </div>
        </div>

        <p className="text-[12px] text-[#606070] text-center mt-8">
          Paiement sécurisé par Stripe &middot; Résiliation à tout moment &middot; Sans engagement
        </p>
      </div>
    </section>
  );
}
