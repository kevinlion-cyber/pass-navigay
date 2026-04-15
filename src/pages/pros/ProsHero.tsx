import { ArrowRight, ChevronDown } from 'lucide-react';

const PILLS = [
  { emoji: '\uD83C\uDF7D', label: 'Restaurants' },
  { emoji: '\uD83C\uDF89', label: 'Soirées' },
  { emoji: '\uD83D\uDECD', label: 'Shopping' },
  { emoji: '\uD83D\uDC86', label: 'Bien-être' },
  { emoji: '\uD83C\uDFE8', label: 'Hébergement' },
  { emoji: '\uD83C\uDFAD', label: 'Culture' },
];

interface ProsHeroProps {
  onRegister: () => void;
  onLogin: () => void;
}

export default function ProsHero({ onRegister, onLogin }: ProsHeroProps) {
  return (
    <section className="pros-hero relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1920&q=80')" }}
      />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(10,10,15,0.92) 0%, rgba(60,10,80,0.85) 100%)' }} />

      <div className="relative z-10 max-w-[800px] mx-auto px-6 text-center pros-fade-in">
        <div className="flex items-center justify-center gap-2 mb-10" style={{ letterSpacing: '2px' }}>
          <span className="text-[32px] font-bold">
            <span className="text-white">Pass</span>{' '}
            <span className="text-[#7B2D8B]">Navigay</span>
          </span>
        </div>

        <h1 className="text-[36px] md:text-[56px] font-black text-white leading-[1.15]">
          Rejoignez le réseau des lieux{'\n'}
          <br className="hidden md:block" />
          LGBT-friendly de <span className="text-[#c084f5]">France</span>
        </h1>

        <p className="mt-5 text-[16px] md:text-[18px] text-[#a0a0b0] max-w-[600px] mx-auto leading-relaxed">
          Référencez votre établissement, publiez vos événements et touchez des milliers d'utilisateurs qui cherchent des lieux sûrs et bienveillants près de chez eux.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-[10px] mt-8">
          {PILLS.map((p) => (
            <span
              key={p.label}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[20px] text-[13px] text-[#e0e0f0]"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              <span>{p.emoji}</span> {p.label}
            </span>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
          <button
            onClick={onRegister}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#7B2D8B] text-white rounded-xl text-base font-semibold transition-all duration-200 hover:bg-[#9b3dab] hover:-translate-y-0.5"
          >
            Créer mon profil gratuit <ArrowRight size={18} />
          </button>
          <button
            onClick={onLogin}
            className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-xl text-base font-semibold text-white transition-all duration-200 hover:border-white"
            style={{ border: '1px solid rgba(255,255,255,0.3)' }}
          >
            Déjà partenaire ? Se connecter
          </button>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 pros-bounce">
        <ChevronDown size={28} className="text-[#7B2D8B]" />
      </div>
    </section>
  );
}
