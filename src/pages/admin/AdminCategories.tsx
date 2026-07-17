import { useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useCategories, type CategoriesMap } from '../../contexts/CategoriesContext';

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export default function AdminCategories() {
  const { categories, reload } = useCategories();
  const [config, setConfig] = useState<CategoriesMap>(() => JSON.parse(JSON.stringify(categories)));
  const [saving, setSaving] = useState(false);

  const keys = Object.keys(config);

  const setLabel = (k: string, label: string) =>
    setConfig((c) => ({ ...c, [k]: { ...c[k], label } }));

  const setSub = (k: string, i: number, value: string) =>
    setConfig((c) => ({ ...c, [k]: { ...c[k], subcategories: c[k].subcategories.map((s, idx) => idx === i ? value : s) } }));

  const addSub = (k: string) =>
    setConfig((c) => ({ ...c, [k]: { ...c[k], subcategories: [...c[k].subcategories, ''] } }));

  const removeSub = (k: string, i: number) =>
    setConfig((c) => ({ ...c, [k]: { ...c[k], subcategories: c[k].subcategories.filter((_, idx) => idx !== i) } }));

  const addCategory = () => {
    const label = window.prompt('Nom de la nouvelle catégorie ?')?.trim();
    if (!label) return;
    let key = slugify(label) || `cat_${Date.now()}`;
    if (config[key]) { let i = 2; while (config[`${key}_${i}`]) i++; key = `${key}_${i}`; }
    setConfig((c) => ({ ...c, [key]: { label, subcategories: [] } }));
  };

  const deleteCategory = (k: string) => {
    if (!window.confirm(`Supprimer la catégorie « ${config[k].label} » ?\nLes établissements déjà classés dedans resteront, mais cette catégorie ne sera plus proposée.`)) return;
    setConfig((c) => { const n = { ...c }; delete n[k]; return n; });
  };

  const handleSave = async () => {
    setSaving(true);
    // nettoyage : labels non vides, sous-catégories non vides, au moins 1 catégorie
    const clean: CategoriesMap = {};
    for (const k of Object.keys(config)) {
      const label = (config[k].label || '').trim();
      if (!label) continue;
      clean[k] = {
        label,
        subcategories: config[k].subcategories.map((s) => s.trim()).filter(Boolean),
      };
    }
    if (Object.keys(clean).length === 0) {
      toast.error('Il faut au moins une catégorie.');
      setSaving(false);
      return;
    }
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'categories_config', value: JSON.stringify(clean), updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
      await reload();
      setConfig(clean);
      toast.success('Catégories enregistrées');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-3xl pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Catégories & types</h1>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
          <Save size={16} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
      <p className="text-sm text-gray-500">
        Ajoutez, renommez ou supprimez des catégories et gérez leurs sous-catégories (types). Les changements s'appliquent sur l'app et les formulaires.
      </p>

      <div className="space-y-5">
        {keys.map((k) => (
          <div key={k} className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-5 space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Nom de la catégorie</label>
                <input
                  value={config[k].label}
                  onChange={(e) => setLabel(k, e.target.value)}
                  className="input-field bg-light-surface dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm font-semibold"
                />
              </div>
              <button
                onClick={() => deleteCategory(k)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-input text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors"
                aria-label="Supprimer la catégorie"
              >
                <Trash2 size={15} /> Supprimer
              </button>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Sous-catégories (types)</label>
              <div className="space-y-2">
                {config[k].subcategories.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={s}
                      onChange={(e) => setSub(k, i, e.target.value)}
                      className="input-field bg-light-surface dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm flex-1 py-1.5"
                    />
                    <button onClick={() => removeSub(k, i)} className="text-gray-400 hover:text-alert p-1.5" aria-label="Supprimer">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => addSub(k)} className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                <Plus size={14} /> Ajouter un type
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addCategory}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-card border border-dashed border-primary/50 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
      >
        <Plus size={16} /> Ajouter une catégorie
      </button>

      <div className="fixed bottom-0 left-0 right-0 md:left-60 bg-light-surface/95 dark:bg-dark-surface/95 backdrop-blur border-t border-light-border dark:border-dark-border p-3 flex justify-end z-30">
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
          <Save size={16} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
