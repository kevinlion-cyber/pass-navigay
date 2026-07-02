import { ArrowRight } from 'lucide-react';
import { ProsContent } from './prosContent';

interface ProsCtaProps {
  content: ProsContent['cta'];
  onRegister: () => void;
}

export default function ProsCta({ content, onRegister }: ProsCtaProps) {
  return (
    <section
      className="relative py-[120px] px-6 text-center overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #1a0028 0%, #3d0a4f 50%, #1a0028 100%)',
        borderTop: '1px solid rgba(123,45,139,0.4)',
        borderBottom: '1px solid rgba(123,45,139,0.4)',
      }}
    >
      <div className="absolute top-[-80px] left-[-80px] w-[300px] h-[300px] rounded-full bg-[#7B2D8B] opacity-30 blur-[60px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-[#7B2D8B] opacity-30 blur-[60px] pointer-events-none" />
      <div className="absolute bottom-[-80px] right-[-80px] w-[300px] h-[300px] rounded-full bg-[#7B2D8B] opacity-30 blur-[60px] pointer-events-none" />

      <div className="relative z-10 max-w-2xl mx-auto">
        <h2 className="text-[36px] md:text-[48px] font-black text-white leading-[1.2]">
          {content.title}
        </h2>
        <p className="text-[16px] text-[#a0a0b0] mt-4">
          {content.subtitle}
        </p>
        <button
          onClick={onRegister}
          className="mt-8 inline-flex items-center gap-2 px-10 py-[18px] bg-white text-[#7B2D8B] rounded-xl text-[17px] font-bold transition-all duration-200 hover:bg-[#f0e8ff] hover:-translate-y-0.5"
        >
          {content.button} <ArrowRight size={18} />
        </button>
        <p className="text-[12px] text-[#606070] mt-5">
          &#128274; Paiement sécurisé par Stripe &middot; SSL &middot; Données protégées
        </p>
      </div>
    </section>
  );
}
