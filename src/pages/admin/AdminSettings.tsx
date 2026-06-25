import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

interface SettingsMap {
  disclaimer_text: string;
  onboarding_title: string;
  onboarding_text: string;
  maintenance_mode: string;
  explore_empty_text: string;
  require_signup: string;
}

const DEFAULTS: SettingsMap = {
  disclaimer_text: '',
  onboarding_title: '',
  onboarding_text: '',
  maintenance_mode: 'false',
  explore_empty_text: '',
  require_signup: 'true',
};

export default function AdminSettings() {
  const [settings, setSettings] = useState<SettingsMap>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase.from('app_settings').select('key, value');
        if (data) {
          const map = { ...DEFAULTS };
          data.forEach((r: any) => {
            if (r.key in map) (map as any)[r.key] = r.value || '';
          });
          setSettings(map);
        }
      } catch { /* handled */ }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries = Object.entries(settings);
      for (const [key, value] of entries) {
        const { error } = await supabase
          .from('app_settings')
          .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
        if (error) throw error;
      }
      toast.success('Parametres enregistres');
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-20 rounded-card" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Parametres</h1>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Texte du disclaimer</label>
          <textarea
            value={settings.disclaimer_text}
            onChange={(e) => setSettings({ ...settings, disclaimer_text: e.target.value })}
            rows={4}
            className="input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Titre de l'onboarding</label>
          <input
            value={settings.onboarding_title}
            onChange={(e) => setSettings({ ...settings, onboarding_title: e.target.value })}
            className="input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Texte de l'onboarding</label>
          <textarea
            value={settings.onboarding_text}
            onChange={(e) => setSettings({ ...settings, onboarding_text: e.target.value })}
            rows={3}
            className="input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Message « liste vide » (explorer)</label>
          <textarea
            value={settings.explore_empty_text}
            onChange={(e) => setSettings({ ...settings, explore_empty_text: e.target.value })}
            rows={2}
            placeholder="Aucun établissement trouvé. Essaie de modifier tes filtres."
            className="input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white resize-none"
          />
          <p className="text-xs text-gray-500 mt-1">Affiché quand aucun établissement ne correspond aux filtres.</p>
        </div>

        <div className="flex items-center justify-between bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-4">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Inscription obligatoire</p>
            <p className="text-xs text-gray-500 mt-0.5">Si activé, l'accès au site nécessite un compte (bouton « S'inscrire »). Sinon, navigation libre (« Explorer »).</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, require_signup: settings.require_signup === 'true' ? 'false' : 'true' })}
            className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${settings.require_signup === 'true' ? 'bg-primary' : 'bg-dark-border'}`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${settings.require_signup === 'true' ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-4">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Mode maintenance</p>
            <p className="text-xs text-gray-500 mt-0.5">Les utilisateurs verront un message de maintenance.</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, maintenance_mode: settings.maintenance_mode === 'true' ? 'false' : 'true' })}
            className={`w-12 h-6 rounded-full transition-colors relative ${settings.maintenance_mode === 'true' ? 'bg-alert' : 'bg-dark-border'}`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${settings.maintenance_mode === 'true' ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-primary">
        {saving ? 'Enregistrement...' : 'Enregistrer'}
      </button>
    </div>
  );
}
