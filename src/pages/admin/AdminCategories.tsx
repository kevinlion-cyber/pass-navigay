import { useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useCategories, type CategoriesMap } from '../../contexts/CategoriesContext';
import type { CategoryKey } from '../../lib/types';

export default function AdminCategories() {
  const { categories, categoryKeys, reload } = useCategories();
  const [config, setConfig] = useState<CategoriesMap>(() => JSON.parse(JSON.stringify(categories)));
  const [saving, setSaving] = useState(false);

  const setLabel = (k: CategoryKey, label: string) =>
    setConfig((c) => ({ ...c, [k]: { ...c[k], label } }));

  const setSub = (k: CategoryKey, i: number, value: string) =>
    setConfig((c) => ({ ...c, [k]: { ...c[k], subcategories: c[k].subcategories.map((s, idx) => idx === i ? value : s) } }));

  const addSub = (k: CategoryKey) =>
    setConfig((c) => ({ ...c, [k]: { ...c[k], subcategories: [...c[k].subcategories, ''] } }));

  const removeSub = (k: CategoryKey, i: number) =>
    setConfig((c) => ({ ...c, [k]: { ...c[k], subcategories: c[k].subcategories.filter((_, idx) => idx !== i) } }));

  const handleSave = async () => {
    setSaving(true);
    // nettoyage : retire les sous-catégories vides
    const clean: CategoriesMap = JSON.parse(JSON.stringify(config));
    for (const k of categoryKeys) {
      clean[k].label = clean[k].label.trim() || categories[k].label;
      clean[k].subcategories = clean[k].subcategories.map((s) => s.trim()).filter(Boolean);
    }
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'categories_config', value: JSON.stringify(clean), updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
      await reload();
      setConfig(clean);
      toast.success('Catégories enregistrées');
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Catégories & types</h1>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
          <Save size={16} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
      <p className="text-sm text-gray-500">
        Renommez les catégories et gérez leurs sous-catégories (types). Les changements s'appliquent sur l'app et les formulaires.
      </p>

      <div className="space-y-5">
        {categoryKeys.map((k) => (
          <div key={k} className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-5 space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nom de la catégorie</label>
              <input
                value={config[k].label}
                onChange={(e) => setLabel(k, e.target.value)}
                className="input-field bg-light-surface dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm font-semibold"
              />
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

      <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
        <Save size={16} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </div>
  );
}
