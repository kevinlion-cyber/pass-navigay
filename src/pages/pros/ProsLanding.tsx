import { Link } from 'react-router-dom';
import ProsHero from './ProsHero';
import ProsStats from './ProsStats';
import ProsBenefits from './ProsBenefits';
import ProsPricing from './ProsPricing';
import ProsTestimonials from './ProsTestimonials';
import ProsCta from './ProsCta';
import ProsFooter from './ProsFooter';

export default function ProsLanding() {
  return (
    <div className="pros-page" style={{ fontFamily: "'Inter', sans-serif" }}>
      <header className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center px-6" style={{ background: '#0a0a0f', borderBottom: '1px solid #1e1e2e' }}>
        <div className="max-w-[1200px] w-full mx-auto flex items-center justify-between">
          <Link to="/explore" className="text-[20px] font-bold">
            <span className="text-white">Pass</span>{' '}
            <span className="text-[#7B2D8B]">Navigay</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/pros/login"
              className="hidden md:inline-flex items-center px-5 py-2 rounded-lg text-[14px] font-medium text-white transition-colors hover:border-[#7B2D8B]"
              style={{ border: '1px solid #2a2a3a' }}
            >
              Se connecter
            </Link>
            <Link
              to="/pros/register"
              className="inline-flex items-center px-5 py-2 rounded-lg bg-[#7B2D8B] text-white text-[14px] font-medium transition-colors hover:bg-[#9b3dab]"
            >
              Créer mon profil
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-16">
        <ProsHero />
        <ProsStats />
        <ProsBenefits />
        <ProsPricing />
        <ProsTestimonials />
        <ProsCta />
      </main>

      <ProsFooter />
    </div>
  );
}
