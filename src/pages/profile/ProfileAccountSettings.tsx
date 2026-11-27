import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Sun, Moon, LogOut, Trash2, Crown, Building2, Bell, Ban } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { enablePush, disablePush } from '../../lib/push';
import type { Profile } from '../../lib/types';
import DeleteAccountModal from '../../components/ui/DeleteAccountModal';
import BlockedMembersModal from '../../components/ui/BlockedMembersModal';
import RetractationPremium from '../../components/ui/RetractationPremium';
import { ouvrirGestionAbonnementPremium, dateFinPremium } from '../../lib/abonnementPremium';

interface ProfileAccountSettingsProps {
  profile: Profile;
}

export default function ProfileAccountSettings({ profile }: ProfileAccountSettingsProps) {
  const { user, signOut, refreshProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [notify, setNotify] = useState(profile.notify_messages !== false);
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [gestionBusy, setGestionBusy] = useState(false);

  // Membre Premium : espace Stripe (résiliation en ligne). Sinon : page des tarifs.
  const gererAbonnement = async () => {
    if (!profile.is_premium) { navigate('/tarifs'); return; }
    if (gestionBusy) return;
    setGestionBusy(true);
    const ouvert = await ouvrirGestionAbonnementPremium();
    if (!ouvert) setGestionBusy(false);
  };
  const finPremium = dateFinPremium(profile.premium_expires_at);

  const toggleNotify = async () => {
    if (!user || notifyBusy) return;
    setNotifyBusy(true);
    if (!notify) {
      // Activer : demander la permission + s'abonner.
      const res = await enablePush(user.id);
      if (!res.ok) {
        setNotifyBusy(false);
        if (res.reason === 'denied') toast.error('Notifications refusées dans le navigateur. Autorise-les pour les activer.');
        else if (res.reason === 'unsupported') toast.error('Ton navigateur ne supporte pas les notifications (sur iPhone, installe l’app sur l’écran d’accueil).');
        else toast.error('Impossible d’activer les notifications.');
        return;
      }
      await supabase.from('profiles').update({ notify_messages: true }).eq('id', user.id);
      setNotify(true);
      toast.success('Notifications de messages activées');
    } else {
      // Désactiver.
      await supabase.from('profiles').update({ notify_messages: false }).eq('id', user.id);
      await disablePush(user.id);
      setNotify(false);
      toast.success('Notifications de messages désactivées');
    }
    await refreshProfile();
    setNotifyBusy(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/explorer');
  };

  return (
    <section>
      <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Settings size={18} className="text-primary" />
        Paramètres
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
          onClick={toggleNotify}
          disabled={notifyBusy}
          className="flex items-center gap-3 w-full text-left"
        >
          <div className={`w-10 h-6 rounded-full relative transition-colors ${notify ? 'bg-primary' : 'bg-gray-300 dark:bg-dark-border'}`}>
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${notify ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Bell size={14} />
            Notifications de messages
          </span>
        </button>

        <div className="border-t border-light-border dark:border-dark-border" />

        <button
          onClick={gererAbonnement}
          disabled={gestionBusy}
          className="flex items-center gap-3 w-full text-left py-1 disabled:opacity-60"
        >
          <Crown size={16} className={profile.is_premium ? 'text-amber-500' : 'text-gray-400'} />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {profile.is_premium ? 'Gérer ou résilier mon abonnement Premium' : 'Passer Premium'}
            {profile.is_premium && finPremium && (
              <span className="block text-xs text-gray-500 dark:text-gray-400">Accès Premium jusqu'au {finPremium}</span>
            )}
          </span>
        </button>

        {/* « Renoncer au contrat ici » : 14 jours après la souscription (art. L221-21). */}
        <RetractationPremium />

        <div className="border-t border-light-border dark:border-dark-border" />

        <button
          onClick={() => navigate('/pros')}
          className="flex items-center gap-3 w-full text-left py-1"
        >
          <Building2 size={16} className="text-gray-400" />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Tu as un établissement ? Espace partenaire
          </span>
        </button>

        <div className="border-t border-light-border dark:border-dark-border" />

        <button
          onClick={() => setBlockedOpen(true)}
          className="flex items-center gap-3 w-full text-left py-1"
        >
          <Ban size={16} className="text-gray-400" />
          <span className="text-sm text-gray-700 dark:text-gray-300">Membres bloqués</span>
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
          onClick={() => setDeleteOpen(true)}
          className="flex items-center gap-3 w-full text-left py-1 text-gray-400 hover:text-alert transition-colors"
        >
          <Trash2 size={14} />
          <span className="text-xs">Supprimer mon compte</span>
        </button>
      </div>
      <DeleteAccountModal open={deleteOpen} tone="tu" onClose={() => setDeleteOpen(false)} />
      <BlockedMembersModal open={blockedOpen} onClose={() => setBlockedOpen(false)} />
    </section>
  );
}
