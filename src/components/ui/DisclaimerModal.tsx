import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

export default function DisclaimerModal() {
  const { profile, user, refreshProfile } = useAuth();
  const [visible, setVisible] = useState(true);

  if (!user || !profile || !profile.show_disclaimer || !visible) return null;

  const handleDismiss = async () => {
    await supabase.from('profiles').update({ show_disclaimer: false }).eq('id', user.id);
    await refreshProfile();
    setVisible(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card p-6 max-w-md w-full space-y-4 relative">
        <button
          onClick={() => setVisible(false)}
          aria-label="Fermer"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-alert/10 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-alert" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Securite</h2>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Pour ta securite et celle des autres, ne rejoins personne dans un lieu isole et ne
          partage pas d'informations personnelles sensibles trop rapidement.
        </p>

        <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            onChange={handleDismiss}
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
          J'ai compris, ne plus afficher
        </label>
      </div>
    </div>
  );
}
