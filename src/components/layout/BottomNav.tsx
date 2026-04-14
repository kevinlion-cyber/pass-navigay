import { useLocation, useNavigate } from 'react-router-dom';
import { MapPin, Calendar, Tag, Users } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/explore', icon: MapPin, label: 'Lieux' },
  { path: '/events', icon: Calendar, label: 'Evenements' },
  { path: '/promos', icon: Tag, label: 'Promos' },
  { path: '/members', icon: Users, label: 'Membres' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-light-surface dark:bg-dark-surface border-t border-light-border dark:border-dark-border">
      <div className="flex items-center justify-around h-16">
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname.startsWith(path);
          const handleClick = () => {
            navigate(path);
          };

          return (
            <button
              key={path}
              onClick={handleClick}
              aria-label={label}
              className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
