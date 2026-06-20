import { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Sun, Moon, Shield, ChevronLeft, Bell } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';

const NAV_TABS = [
  { path: '/explore', label: 'Lieux' },
  { path: '/events', label: 'Evenements' },
  { path: '/promos', label: 'Promos' },
  { path: '/members', label: 'Membres' },
  { path: '/messages', label: 'Messages', authOnly: true },
];

const MAIN_PATHS = ['/explore', '/events', '/promos', '/members', '/messages'];

export default function Header() {
  const { user, profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  const isMainPage = MAIN_PATHS.some((p) => location.pathname === p);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const fetchUnread = async () => {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false);
      setUnreadCount(count ?? 0);
    };

    fetchUnread();

    const channel = supabase
      .channel('header-unread')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        () => { fetchUnread(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const initials = profile?.username
    ? profile.username.charAt(0).toUpperCase()
    : '?';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-light-surface/95 dark:bg-dark-surface/95 backdrop-blur-sm border-b border-light-border dark:border-dark-border">
      <div className="max-w-7xl mx-auto h-full px-4 flex items-center justify-between">
        <div className="flex items-center shrink-0 gap-1">
          {!isMainPage && (
            <button
              onClick={() => navigate(-1)}
              aria-label="Retour"
              className="p-1 -ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
          )}
          <Link to="/explore" className="flex items-center">
            <img src="/logo-pass-navigay.png" alt="Pass Navigay" className="h-12" />
          </Link>
        </div>

        {isMainPage && (
          <nav className="hidden md:flex items-center gap-1 mx-6">
            {NAV_TABS.filter((t) => !t.authOnly || user).map(({ path, label }) => {
              const isActive = location.pathname.startsWith(path);
              return (
                <Link
                  key={path}
                  to={path}
                  className={`relative px-4 py-4 text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-primary'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {label}
                    {path === '/messages' && unreadCount > 0 && (
                      <span className="min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </span>
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleTheme}
            aria-label="Changer de theme"
            className="btn-ghost p-2"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              {profile?.is_admin && (
                <button
                  onClick={() => navigate('/admin')}
                  aria-label="Administration"
                  className="btn-ghost p-2"
                >
                  <Shield size={18} />
                </button>
              )}
              <button
                onClick={() => navigate('/messages')}
                aria-label="Messages"
                className="btn-ghost p-2 relative"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => navigate('/profile/settings')}
                className="w-8 h-8 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center transition-transform hover:scale-105"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-primary text-sm font-medium">
                    {initials}
                  </span>
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/auth/login')}
              className="btn-primary text-sm py-2 px-4"
            >
              Connexion
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
