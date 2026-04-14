import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const TABS = [
  { key: 'legal_mentions', label: 'Mentions légales' },
  { key: 'legal_cgu', label: 'CGU' },
  { key: 'legal_confidentialite', label: 'Politique de confidentialité' },
  { key: 'legal_contact_text', label: 'Contact' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function AdminLegal() {
  const [activeTab, setActiveTab] = useState<TabKey>('legal_mentions');
  const [contents, setContents] = useState<Record<TabKey, string>>({
    legal_mentions: '',
    legal_cgu: '',
    legal_confidentialite: '',
    legal_contact_text: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', TABS.map((t) => t.key));
      if (data) {
        const map = { ...contents };
        data.forEach((r: { key: string; value: string }) => {
          if (r.key in map) (map as Record<string, string>)[r.key] = r.value || '';
        });
        setContents(map);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('app_settings')
      .upsert(
        { key: activeTab, value: contents[activeTab], updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Contenu mis à jour !');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-card" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">Contenu légal</h1>

      <div className="flex items-center gap-1 border-b border-dark-border overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'text-primary border-primary'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <textarea
        value={contents[activeTab]}
        onChange={(e) => setContents({ ...contents, [activeTab]: e.target.value })}
        className="w-full rounded-lg p-4 text-[13px] leading-relaxed resize-y outline-none transition-colors focus:border-primary"
        style={{
          minHeight: '500px',
          fontFamily: 'monospace',
          background: '#0f0f17',
          color: '#c0c0d0',
          border: '1px solid #2a2a3a',
        }}
      />

      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary inline-flex items-center gap-2"
      >
        <Save size={16} />
        {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
      </button>
    </div>
  );
}
