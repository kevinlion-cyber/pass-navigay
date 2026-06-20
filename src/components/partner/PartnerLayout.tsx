import { useEffect, useState, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Menu, LogOut, BarChart3, Store, CalendarDays, Tag,
  CreditCard, User, MessageSquare, Sun, Moon,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../contexts/ThemeContext';
import type { Establishment } from '../../lib/types';
import LoadingSpinner from '../ui/LoadingSpinner';

interface NavBadges {
  events: number;
  promos: number;
  photos: number;
}

const NAV_ITEMS = [
  { to: '/pros/tableau-de-bord', label: 'Dashboard', icon: BarChart3, group: 'main' },
  { to: '/pros/mon-etablissement', label: 'Mon établissement', icon: Store, group: 'main' },
  { to: '/pros/evenements', label: 'Événements', icon: CalendarDays, group: 'main' },
  { to: '/pros/promotions', label: 'Promotions', icon: Tag, group: 'main' },
  { to: '/pros/avis', label: 'Avis', icon: MessageSquare, group: 'main' },
  { to: '/pros/abonnement', label: 'Abonnement', icon: CreditCard, group: 'sub' },
];

export default function PartnerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [badges, setBadges] = useState<NavBadges>({ events: 0, promos: 0, photos: 0 });
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/pros/connexion', { replace: true });
        return;
      }

      const { data } = await supabase
        .from('establishments')
        .select('*')
        .eq('owner_id', session.user.id)
        .maybeSingle();

      if (!data) {
        navigate('/pros/inscription', { replace: true });
        return;
      }
      setEstablishment(data as Establishment);
      setLoading(false);
    };
    check();
  }, []);

  useEffect(() => {
    if (!establishment) return;
    const loadBadges = async () => {
      const now = new Date().toISOString();
      const [evRes, prRes, phRes] = await Promise.all([
        supabase.from('events').select('*', { count: 'exact', head: true })
          .eq('establishment_id', establishment.id).gte('event_date', now),
        supabase.from('promotions').select('*', { count: 'exact', head: true })
          .eq('establishment_id', establishment.id).gte('valid_until', now),
        supabase.from('establishment_photos').select('*', { count: 'exact', head: true })
          .eq('establishment_id', establishment.id),
      ]);
      setBadges({
        events: evRes.count ?? 0,
        promos: prRes.count ?? 0,
        photos: phRes.count ?? 0,
      });
    };
    loadBadges();
  }, [establishment, location.pathname]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/pros');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex items-center justify-center">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  const est = establishment!;
  const initials = est.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const getBadge = (to: string): { value: string; color: string } | null => {
    if (to === '/pros/evenements' && badges.events > 0) {
      return { value: badges.events > 9 ? '9+' : String(badges.events), color: '#7B2D8B' };
    }
    if (to === '/pros/promotions' && badges.promos > 0) {
      return { value: badges.promos > 9 ? '9+' : String(badges.promos), color: '#7B2D8B' };
    }
    return null;
  };

  const mainItems = NAV_ITEMS.filter(i => i.group === 'main');
  const subItems = NAV_ITEMS.filter(i => i.group === 'sub');

  return (
    <div className="min-h-screen partner-scope" style={{ background: 'var(--pn-bg)' }}>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-[100] h-14 flex items-center justify-between px-4"
        style={{ background: 'var(--pn-bg2)', borderBottom: '1px solid var(--pn-border)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-400 hover:text-gray-900 dark:text-white transition-colors">
            <Menu size={24} />
          </button>
          <span className="text-[15px] font-semibold">
            <span className="text-gray-900 dark:text-white">Pass</span>
            <span style={{ color: '#7B2D8B' }}> Navigay</span>
            <span style={{ color: '#606070' }}> · Espace Partenaire</span>
          </span>
        </div>
        <div className="flex items-center gap-3" ref={avatarRef}>
          <span className="text-[13px] text-gray-500 hidden sm:block">{est.name}</span>
          <button onClick={toggleTheme} aria-label="Basculer le thème"
            className="text-gray-500 hover:text-primary transition-colors">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={() => setAvatarOpen(!avatarOpen)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: '#7B2D8B' }}>
            {initials}
          </button>
          {avatarOpen && (
            <div className="absolute top-12 right-4 rounded-input overflow-hidden shadow-xl z-[110]"
              style={{ background: 'var(--pn-surface)', border: '1px solid var(--pn-border2)', minWidth: 200 }}>
              <button onClick={() => { setAvatarOpen(false); navigate('/profile/settings'); }}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-300 hover:bg-gray-200 dark:bg-dark-border transition-colors text-left">
                <User size={15} /> Mon profil Pass Navigay
              </button>
              <button onClick={() => { setAvatarOpen(false); handleLogout(); }}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm transition-colors text-left"
                style={{ color: '#c0392b' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(192,57,43,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <LogOut size={15} /> Se déconnecter
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[105] bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-14 left-0 z-[106] h-[calc(100vh-56px)] overflow-y-auto transition-transform duration-[250ms] ease-in-out
          lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ width: 240, background: 'var(--pn-bg2)', borderRight: '1px solid var(--pn-border)' }}>

        {/* Sidebar header */}
        <div className="p-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--pn-border)' }}>
          {est.logo_url ? (
            <img src={est.logo_url} alt="" className="w-10 h-10 rounded-[8px] object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-[8px] flex items-center justify-center text-sm font-bold text-gray-900 dark:text-white shrink-0"
              style={{ background: '#7B2D8B' }}>
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-white truncate leading-tight">{est.name}</p>
            {est.is_pro ? (
              <span className="text-[11px] font-semibold" style={{ color: '#7B2D8B' }}>Pro</span>
            ) : (
              <span className="text-[11px] font-medium text-gray-500">Gratuit</span>
            )}
          </div>
        </div>

        {/* Nav items */}
        <nav className="p-2 flex flex-col" style={{ minHeight: 'calc(100% - 80px - 56px)' }}>
          <div className="space-y-0.5">
            {mainItems.map(({ to, label, icon: Icon }) => {
              const badge = getBadge(to);
              return (
                <NavLink key={to} to={to} className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-[8px] text-sm font-medium transition-all duration-150 relative ${
                    isActive
                      ? 'text-gray-900 dark:text-white border-l-[3px] pl-[9px] pr-3 py-2.5'
                      : 'text-[#a0a0b0] hover:text-gray-900 dark:text-white hover:bg-[var(--pn-surface2)] px-3 py-2.5'
                  }`
                } style={({ isActive }) => isActive ? { background: 'rgba(123,45,139,0.15)', borderLeftColor: '#7B2D8B' } : {}}>
                  <span className="relative">
                    <Icon size={18} />
                    {badge && (
                      <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold text-gray-900 dark:text-white px-1"
                        style={{ background: badge.color }}>
                        {badge.value}
                      </span>
                    )}
                  </span>
                  <span>{label}</span>
                </NavLink>
              );
            })}
          </div>

          <div className="mx-3 my-2" style={{ borderTop: '1px solid var(--pn-border)' }} />

          <div className="space-y-0.5">
            {subItems.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-[8px] text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'text-gray-900 dark:text-white border-l-[3px] pl-[9px] pr-3 py-2.5'
                    : 'text-[#a0a0b0] hover:text-gray-900 dark:text-white hover:bg-[var(--pn-surface2)] px-3 py-2.5'
                }`
              } style={({ isActive }) => isActive ? { background: 'rgba(123,45,139,0.15)', borderLeftColor: '#7B2D8B' } : {}}>
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>

          <div className="flex-1" />
        </nav>

        {/* Sidebar bottom */}
        <div className="p-2" style={{ borderTop: '1px solid var(--pn-border)' }}>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-sm font-medium transition-colors"
            style={{ color: '#c0392b' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(192,57,43,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <LogOut size={18} />
            <span>Se déconnecter</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="mt-14 lg:ml-[240px] min-h-[calc(100vh-56px)] p-4 lg:p-8">
        <Outlet context={{ establishment: est, reload: () => window.location.reload() }} />
      </main>
    </div>
  );
}
