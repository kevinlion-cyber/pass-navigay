import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

interface SettingsMap {
  disclaimer_text: string;
  onboarding_title: string;
  onboarding_text: string;
  maintenance_mode: string;
}

const DEFAULTS: SettingsMap = {
  disclaimer_text: '',
  onboarding_title: '',
  onboarding_text: '',
  maintenance_mode: 'false',
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
      <h1 className="text-xl font-bold text-white">Parametres</h1>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Texte du disclaimer</label>
          <textarea
            value={settings.disclaimer_text}
            onChange={(e) => setSettings({ ...settings, disclaimer_text: e.target.value })}
            rows={4}
            className="input-field bg-dark-surface border-dark-border text-white resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Titre de l'onboarding</label>
          <input
            value={settings.onboarding_title}
            onChange={(e) => setSettings({ ...settings, onboarding_title: e.target.value })}
            className="input-field bg-dark-surface border-dark-border text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Texte de l'onboarding</label>
          <textarea
            value={settings.onboarding_text}
            onChange={(e) => setSettings({ ...settings, onboarding_text: e.target.value })}
            rows={3}
            className="input-field bg-dark-surface border-dark-border text-white resize-none"
          />
        </div>

        <div className="flex items-center justify-between bg-dark-surface border border-dark-border rounded-card p-4">
          <div>
            <p className="text-sm font-medium text-white">Mode maintenance</p>
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
