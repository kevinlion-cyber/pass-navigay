import { useState } from 'react';
import { Link } from 'react-router-dom';
import ProsHero from './ProsHero';
import ProsStats from './ProsStats';
import ProsBenefits from './ProsBenefits';
import ProsPricing from './ProsPricing';
import ProsTestimonials from './ProsTestimonials';
import ProsCta from './ProsCta';
import ProsFooter from './ProsFooter';
import ProsRegisterModal from './ProsRegisterModal';
import ProsLoginModal from './ProsLoginModal';
import { useProsContent, resolveStatValue } from './useProsContent';

export default function ProsLanding() {
  const [modal, setModal] = useState<'none' | 'register' | 'login'>('none');
  const { content, counts } = useProsContent();

  const openRegister = () => setModal('register');
  const openLogin = () => setModal('login');
  const closeModal = () => setModal('none');

  const resolvedStats = content.stats.items.map((item) => ({
    ...item,
    display: resolveStatValue(item, content.stats.mode, counts),
  }));

  return (
    <div className="pros-page" style={{ fontFamily: "'Inter', sans-serif" }}>
      <header className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center px-6" style={{ background: '#0a0a0f', borderBottom: '1px solid #1e1e2e' }}>
        <div className="max-w-[1200px] w-full mx-auto flex items-center justify-between">
          <Link to="/explore" className="flex items-center gap-2">
            <img src="/logo.png?v=2" alt="" className="h-9" />
            <span className="text-[20px] font-bold">
              <span className="text-white">Pass</span>{' '}
              <span className="text-[#7B2D8B]">Navigay</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={openLogin}
              className="hidden md:inline-flex items-center px-5 py-2 rounded-lg text-[14px] font-medium text-white transition-colors hover:border-[#7B2D8B]"
              style={{ border: '1px solid #2a2a3a' }}
            >
              Se connecter
            </button>
            <button
              onClick={openRegister}
              className="inline-flex items-center px-5 py-2 rounded-lg bg-[#7B2D8B] text-white text-[14px] font-medium transition-colors hover:bg-[#9b3dab]"
            >
              Créer mon profil pro
            </button>
          </div>
        </div>
      </header>

      <main className="pt-16">
        <ProsHero content={content.hero} onRegister={openRegister} onLogin={openLogin} />
        {content.stats.show && <ProsStats items={resolvedStats} />}
        <ProsBenefits content={content.benefits} />
        {content.pricing.show && <ProsPricing content={content.pricing} onRegister={openRegister} />}
        {content.testimonials.show && content.testimonials.items.length > 0 && (
          <ProsTestimonials content={content.testimonials} />
        )}
        <ProsCta content={content.cta} onRegister={openRegister} />
      </main>

      <ProsFooter />

      {modal === 'register' && (
        <ProsRegisterModal onClose={closeModal} onSwitchToLogin={() => setModal('login')} />
      )}
      {modal === 'login' && (
        <ProsLoginModal onClose={closeModal} onSwitchToRegister={() => setModal('register')} />
      )}
    </div>
  );
}
