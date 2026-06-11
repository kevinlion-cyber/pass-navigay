import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MapPin, Calendar, Tag, Users, MessageCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const NAV_ITEMS = [
  { path: '/explore', icon: MapPin, label: 'Lieux' },
  { path: '/events', icon: Calendar, label: 'Evenements' },
  { path: '/promos', icon: Tag, label: 'Promos' },
  { path: '/members', icon: Users, label: 'Membres' },
  { path: '/messages', icon: MessageCircle, label: 'Messages', authOnly: true },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }

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
      .channel('bottomnav-unread')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        () => { fetchUnread(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const items = NAV_ITEMS.filter((t) => !t.authOnly || user);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-light-surface dark:bg-dark-surface border-t border-light-border dark:border-dark-border">
      <div className="flex items-center justify-around h-16">
        {items.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname.startsWith(path);

          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              aria-label={label}
              className={`relative flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {path === '/messages' && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
