import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Establishment } from '../../lib/types';
import LoadingSpinner from '../ui/LoadingSpinner';

const NAV_ITEMS = [
  { to: '/pros/dashboard', label: 'Dashboard' },
  { to: '/pros/establishment', label: 'Mon etablissement' },
  { to: '/pros/events', label: 'Evenements' },
  { to: '/pros/promotions', label: 'Promotions' },
  { to: '/pros/gallery', label: 'Galerie' },
  { to: '/pros/subscription', label: 'Abonnement' },
];

export default function PartnerLayout() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [establishment, setEstablishment] = useState<Establishment | null>(null);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/pros/login', { replace: true });
        return;
      }

      const { data } = await supabase
        .from('establishments')
        .select('*')
        .eq('owner_id', session.user.id)
        .maybeSingle();

      if (!data) {
        navigate('/pros/register', { replace: true });
        return;
      }
      setEstablishment(data as Establishment);
      setLoading(false);
    };
    check();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/pros/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-input text-sm font-medium transition-colors whitespace-nowrap ${
      isActive ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:text-white'
    }`;

  return (
    <div className="min-h-screen bg-dark-bg text-gray-100">
      <header className="fixed top-0 left-0 right-0 z-50 bg-dark-surface border-b border-dark-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-lg font-bold shrink-0">
            <span className="text-white">Pass</span>
            <span style={{ color: '#7B2D8B' }}> Navigay</span>
            <span className="text-gray-500 font-normal"> · Espace Partenaire</span>
          </span>
          <nav className="hidden md:flex items-center gap-1 ml-6">
            {NAV_ITEMS.map(({ to, label }) => (
              <NavLink key={to} to={to} className={linkClass}>{label}</NavLink>
            ))}
          </nav>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors ml-4 shrink-0">
            <LogOut size={16} />
            <span className="hidden sm:inline">Deconnexion</span>
          </button>
        </div>
        <nav className="md:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink key={to} to={to} className={linkClass}>{label}</NavLink>
          ))}
        </nav>
      </header>

      <main className="pt-14 md:pt-14">
        <div className="max-w-5xl mx-auto p-6">
          <Outlet context={{ establishment, reload: () => window.location.reload() }} />
        </div>
      </main>
    </div>
  );
}
