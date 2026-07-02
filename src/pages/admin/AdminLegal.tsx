import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Save, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { LEGAL_CUSTOM_KEY, LegalPage, legalSlugify, parseLegalPages } from '../legal/legalPages';

const TABS = [
  { key: 'legal_mentions', label: 'Mentions légales' },
  { key: 'legal_cgu', label: 'CGU' },
  { key: 'legal_confidentialite', label: 'Politique de confidentialité' },
  { key: 'legal_contact_text', label: 'Contact' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const editorStyle = {
  minHeight: '400px',
  fontFamily: 'monospace',
  background: '#0f0f17',
  color: '#c0c0d0',
  border: '1px solid #2a2a3a',
} as const;

export default function AdminLegal() {
  const [activeTab, setActiveTab] = useState<TabKey>('legal_mentions');
  const [contents, setContents] = useState<Record<TabKey, string>>({
    legal_mentions: '', legal_cgu: '', legal_confidentialite: '', legal_contact_text: '',
  });
  const [customPages, setCustomPages] = useState<LegalPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCustom, setSavingCustom] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', [...TABS.map((t) => t.key), LEGAL_CUSTOM_KEY]);
      if (data) {
        const map = { legal_mentions: '', legal_cgu: '', legal_confidentialite: '', legal_contact_text: '' } as Record<TabKey, string>;
        data.forEach((r: { key: string; value: string }) => {
          if (r.key in map) (map as Record<string, string>)[r.key] = r.value || '';
          if (r.key === LEGAL_CUSTOM_KEY) setCustomPages(parseLegalPages(r.value));
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
      .upsert({ key: activeTab, value: contents[activeTab], updated_at: new Date().toISOString() }, { onConflict: 'key' });
    error ? toast.error(error.message) : toast.success('Contenu mis à jour !');
    setSaving(false);
  };

  const addCustomPage = () => {
    const title = window.prompt('Titre du nouvel onglet ?')?.trim();
    if (!title) return;
    let slug = legalSlugify(title) || `page-${Date.now()}`;
    if (customPages.some((p) => p.slug === slug)) { let i = 2; while (customPages.some((p) => p.slug === `${slug}-${i}`)) i++; slug = `${slug}-${i}`; }
    setCustomPages((p) => [...p, { slug, title, content: '' }]);
  };

  const updateCustom = (i: number, patch: Partial<LegalPage>) =>
    setCustomPages((p) => p.map((page, idx) => (idx === i ? { ...page, ...patch } : page)));

  const removeCustom = (i: number) => {
    if (!window.confirm(`Supprimer l'onglet « ${customPages[i].title} » ?`)) return;
    setCustomPages((p) => p.filter((_, idx) => idx !== i));
  };

  const saveCustom = async () => {
    setSavingCustom(true);
    const clean = customPages
      .map((p) => ({ ...p, title: p.title.trim() }))
      .filter((p) => p.title);
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: LEGAL_CUSTOM_KEY, value: JSON.stringify(clean), updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) { toast.error(error.message); } else { setCustomPages(clean); toast.success('Onglets personnalisés enregistrés'); }
    setSavingCustom(false);
  };

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-card" />)}</div>;
  }

  return (
    <div className="space-y-8 max-w-3xl pb-12">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Contenu légal</h1>

      {/* Pages fixes */}
      <div className="space-y-4">
        <div className="flex items-center gap-1 border-b border-light-border dark:border-dark-border overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key ? 'text-primary border-primary' : 'text-gray-500 border-transparent hover:text-gray-300'
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
          style={editorStyle}
        />

        <button onClick={handleSave} disabled={saving} className="btn-primary inline-flex items-center gap-2">
          <Save size={16} /> {saving ? 'Enregistrement...' : 'Enregistrer cette page'}
        </button>
      </div>

      {/* Onglets personnalisés */}
      <div className="space-y-4 pt-4 border-t border-light-border dark:border-dark-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Onglets personnalisés</h2>
            <p className="text-xs text-gray-500 mt-0.5">Ajoutez vos propres pages légales. Elles apparaissent comme onglets sur /legal. Format markdown.</p>
          </div>
          <button onClick={addCustomPage} className="shrink-0 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            <Plus size={15} /> Ajouter un onglet
          </button>
        </div>

        {customPages.length === 0 && (
          <p className="text-sm text-gray-500 italic">Aucun onglet personnalisé pour l'instant.</p>
        )}

        {customPages.map((page, i) => (
          <div key={page.slug} className="rounded-card border border-light-border dark:border-dark-border p-4 space-y-2">
            <div className="flex items-center gap-2">
              <input
                value={page.title}
                onChange={(e) => updateCustom(i, { title: e.target.value })}
                placeholder="Titre de l'onglet"
                className="input-field bg-light-surface dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm font-semibold flex-1"
              />
              <span className="text-[11px] text-gray-500 shrink-0">/legal/p/{page.slug}</span>
              <button onClick={() => removeCustom(i)} className="text-gray-400 hover:text-red-500 p-1.5 shrink-0" aria-label="Supprimer"><Trash2 size={16} /></button>
            </div>
            <textarea
              value={page.content}
              onChange={(e) => updateCustom(i, { content: e.target.value })}
              placeholder="Contenu (markdown)…"
              className="w-full rounded-lg p-3 text-[13px] leading-relaxed resize-y outline-none focus:border-primary"
              style={{ ...editorStyle, minHeight: '220px' }}
            />
          </div>
        ))}

        <button onClick={saveCustom} disabled={savingCustom} className="btn-primary inline-flex items-center gap-2">
          <Save size={16} /> {savingCustom ? 'Enregistrement...' : 'Enregistrer les onglets personnalisés'}
        </button>
      </div>
    </div>
  );
}
