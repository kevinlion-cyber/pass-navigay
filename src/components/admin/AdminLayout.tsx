import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  BarChart3, Building2, CalendarDays, Tag, Users, Handshake, Settings, FileText, Menu, X, LogOut, Gift, Sun, Moon, Layers, Megaphone, CreditCard, UserCog,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const NAV_ITEMS = [
  { to: '/admin', icon: BarChart3, label: 'Tableau de bord', end: true },
  { to: '/admin/establishments', icon: Building2, label: 'Établissements' },
  { to: '/admin/events', icon: CalendarDays, label: 'Événements' },
  { to: '/admin/promotions', icon: Tag, label: 'Promotions' },
  { to: '/admin/members', icon: Users, label: 'Membres' },
  { to: '/admin/partners', icon: Handshake, label: 'Partenaires' },
  { to: '/admin/gifts', icon: Gift, label: 'Cadeaux offerts' },
  { to: '/admin/categories', icon: Layers, label: 'Catégories' },
  { to: '/admin/pros-landing', icon: Megaphone, label: 'Landing Pros' },
  { to: '/admin/tarifs', icon: CreditCard, label: 'Tarifs' },
  { to: '/admin/settings', icon: Settings, label: 'Paramètres' },
  { to: '/admin/legal', icon: FileText, label: 'Contenu légal' },
  { to: '/admin/account', icon: UserCog, label: 'Mon compte' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const handleQuit = () => {
    navigate('/explore');
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-input text-sm font-medium transition-colors ${
      isActive
        ? 'bg-primary/10 text-primary'
        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-surface'
    }`;

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg text-gray-900 dark:text-gray-100">
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-light-surface dark:bg-dark-surface border-b border-light-border dark:border-dark-border flex items-center px-4">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mr-2"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <span className="text-lg font-bold">
          <span className="text-gray-900 dark:text-white">Pass</span>
          <span style={{ color: '#7B2D8B' }}> Navigay</span>
          <span className="text-gray-500 font-normal"> · Admin</span>
        </span>
        <div className="flex-1" />
        <button onClick={toggleTheme} className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mr-2" title={theme === 'dark' ? 'Theme clair' : 'Theme sombre'}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button onClick={handleQuit} className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
          <LogOut size={16} />
          <span className="hidden sm:inline">Quitter l'admin</span>
        </button>
      </header>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed top-14 bottom-0 left-0 z-40 w-60 bg-light-surface dark:bg-dark-surface border-r border-light-border dark:border-dark-border overflow-y-auto transition-transform md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <nav className="p-3 space-y-1">
          {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={linkClass}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="pt-14 md:pl-60">
        <div className="p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
