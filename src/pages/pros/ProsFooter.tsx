import { Link } from 'react-router-dom';

export default function ProsFooter() {
  return (
    <footer className="py-10 px-6" style={{ background: '#050508' }}>
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center sm:justify-between gap-4">
        <div className="text-center sm:text-left">
          <span className="text-[16px] font-bold">
            <span className="text-white">Pass</span>{' '}
            <span className="text-[#7B2D8B]">Navigay</span>
          </span>
          <p className="text-[13px] text-[#606070] mt-1">&copy; 2026 passnavigay.fr</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-[13px] text-[#606070]">
          <Link to="/legal/mentions" className="transition-colors hover:text-[#c084f5]">Mentions légales</Link>
          <Link to="/legal/cgu" className="transition-colors hover:text-[#c084f5]">CGU</Link>
          <Link to="/legal/confidentialite" className="transition-colors hover:text-[#c084f5]">Politique de confidentialité</Link>
          <Link to="/legal/contact" className="transition-colors hover:text-[#c084f5]">Contact</Link>
          <Link to="/explore" className="transition-colors hover:text-[#c084f5]">Retour sur l&rsquo;app</Link>
        </div>
      </div>
    </footer>
  );
}
