import { useNavigate } from 'react-router-dom';
import { Settings, Sun, Moon, LogOut, Trash2, Crown, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import type { Profile } from '../../lib/types';

interface ProfileAccountSettingsProps {
  profile: Profile;
}

export default function ProfileAccountSettings({ profile }: ProfileAccountSettingsProps) {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/explore');
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Supprimer ton compte ? Cette action est irreversible.')) return;
    if (!user) return;
    await supabase.from('profiles').delete().eq('id', user.id);
    await signOut();
    toast.success('Compte supprime.');
    navigate('/');
  };

  return (
    <section>
      <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Settings size={18} className="text-primary" />
        Parametres
      </h2>

      <div className="card p-4 space-y-4">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 w-full text-left"
        >
          <div className={`w-10 h-6 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-primary' : 'bg-gray-300'}`}>
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${theme === 'dark' ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
            {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
            {theme === 'dark' ? 'Mode sombre' : 'Mode clair'}
          </span>
        </button>

        <div className="border-t border-light-border dark:border-dark-border" />

        <button
          onClick={() => navigate('/pricing')}
          className="flex items-center gap-3 w-full text-left py-1"
        >
          <Crown size={16} className={profile.is_premium ? 'text-amber-500' : 'text-gray-400'} />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {profile.is_premium ? "Gerer mon abonnement Premium" : "Passer Premium"}
          </span>
        </button>

        <div className="border-t border-light-border dark:border-dark-border" />

        <button
          onClick={() => navigate('/pros')}
          className="flex items-center gap-3 w-full text-left py-1"
        >
          <Building2 size={16} className="text-gray-400" />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Tu as un etablissement ? Espace partenaire
          </span>
        </button>

        <div className="border-t border-light-border dark:border-dark-border" />

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full text-left py-1 text-alert"
        >
          <LogOut size={16} />
          <span className="text-sm font-medium">Se deconnecter</span>
        </button>

        <button
          onClick={handleDeleteAccount}
          className="flex items-center gap-3 w-full text-left py-1 text-gray-400 hover:text-alert transition-colors"
        >
          <Trash2 size={14} />
          <span className="text-xs">Supprimer mon compte</span>
        </button>
      </div>
    </section>
  );
}
