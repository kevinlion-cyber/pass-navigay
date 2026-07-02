import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { LEGAL_CUSTOM_KEY, parseLegalPages } from './legalPages';

const BASE_TABS = [
  { to: '/legal/mentions', label: 'Mentions légales' },
  { to: '/legal/cgu', label: 'CGU' },
  { to: '/legal/confidentialite', label: 'Politique de confidentialité' },
  { to: '/legal/contact', label: 'Contact' },
];

export default function LegalLayout() {
  const [tabs, setTabs] = useState(BASE_TABS);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', LEGAL_CUSTOM_KEY).maybeSingle()
      .then(({ data }) => {
        const custom = parseLegalPages(data?.value).map((p) => ({ to: `/legal/p/${p.slug}`, label: p.title }));
        if (custom.length) setTabs([...BASE_TABS, ...custom]);
      });
  }, []);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: '#0a0a0f' }} className="min-h-screen">
      <header className="sticky top-0 z-50 h-14 flex items-center px-6" style={{ background: '#0a0a0f', borderBottom: '1px solid #1e1e2e' }}>
        <div className="max-w-[800px] w-full mx-auto flex items-center justify-between">
          <Link to="/explore" className="text-[18px] font-bold">
            <span className="text-white">Pass</span>{' '}
            <span className="text-[#7B2D8B]">Navigay</span>
          </Link>
          <Link to="/pros" className="flex items-center gap-1.5 text-[13px] text-[#a0a0b0] hover:text-white transition-colors">
            <ArrowLeft size={14} />
            Retour
          </Link>
        </div>
      </header>

      <nav className="border-b border-[#1e1e2e] overflow-x-auto">
        <div className="max-w-[800px] mx-auto px-6 flex items-center gap-6 h-11">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end
              className={({ isActive }) =>
                `whitespace-nowrap text-[13px] font-medium transition-colors pb-2.5 border-b-2 ${
                  isActive
                    ? 'text-[#c084f5] border-[#c084f5]'
                    : 'text-[#606070] border-transparent hover:text-[#a0a0b0]'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="max-w-[800px] mx-auto px-6 py-16">
        <Outlet />
      </main>
    </div>
  );
}
