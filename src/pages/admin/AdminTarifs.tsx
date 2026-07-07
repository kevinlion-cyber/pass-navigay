import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DEFAULT_USER_PLANS, USER_PLANS_KEY, UserPlans, mergeUserPlans } from '../../lib/userPlans';

const card = 'bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-5 space-y-3';
const field = 'input-field bg-light-surface dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm py-1.5';

export default function AdminTarifs() {
  const [plans, setPlans] = useState<UserPlans>(DEFAULT_USER_PLANS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', USER_PLANS_KEY).maybeSingle()
      .then(({ data }) => {
        if (data?.value) { try { setPlans(mergeUserPlans(JSON.parse(data.value))); } catch { /* défauts */ } }
        setLoading(false);
      });
  }, []);

  const save = async () => {
    setSaving(true);
    const clean: UserPlans = {
      freeFeatures: plans.freeFeatures.map((f) => ({ label: f.label.trim(), included: f.included })).filter((f) => f.label),
      premiumFeatures: plans.premiumFeatures.map((s) => s.trim()).filter(Boolean),
    };
    const { error } = await supabase.from('app_settings')
      .upsert({ key: USER_PLANS_KEY, value: JSON.stringify(clean), updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) { toast.error(error.message); } else { setPlans(clean); toast.success('Avantages enregistrés'); }
    setSaving(false);
  };

  if (loading) return <div className="space-y-4">{[1, 2].map((i) => <div key={i} className="skeleton h-40 rounded-card" />)}</div>;

  return (
    <div className="space-y-6 max-w-2xl pb-24">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Tarifs — avantages utilisateurs</h1>
        <p className="text-sm text-gray-500 mt-1">Gère la liste des avantages des formules <strong>Gratuit</strong> et <strong>Premium</strong> (affichée sur la page Tarifs et à l'inscription). Les prix ne se gèrent pas ici.</p>
      </div>

      {/* GRATUIT */}
      <div className={card}>
        <p className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">Formule Gratuite</p>
        <p className="text-xs text-gray-500">Coche « inclus » si l'avantage est présent dans la formule gratuite (sinon il s'affiche barré).</p>
        {plans.freeFeatures.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="checkbox" checked={f.included} title="Inclus dans la formule gratuite ?"
              onChange={(e) => { const a = [...plans.freeFeatures]; a[i] = { ...a[i], included: e.target.checked }; setPlans({ ...plans, freeFeatures: a }); }} />
            <input className={field + ' flex-1'} value={f.label}
              onChange={(e) => { const a = [...plans.freeFeatures]; a[i] = { ...a[i], label: e.target.value }; setPlans({ ...plans, freeFeatures: a }); }} />
            <button onClick={() => setPlans({ ...plans, freeFeatures: plans.freeFeatures.filter((_, j) => j !== i) })} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
          </div>
        ))}
        <button onClick={() => setPlans({ ...plans, freeFeatures: [...plans.freeFeatures, { label: '', included: true }] })} className="text-xs text-primary flex items-center gap-1"><Plus size={14} /> Ajouter un avantage</button>
      </div>

      {/* PREMIUM */}
      <div className={card}>
        <p className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">Formule Premium</p>
        {plans.premiumFeatures.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <input className={field + ' flex-1'} value={label}
              onChange={(e) => { const a = [...plans.premiumFeatures]; a[i] = e.target.value; setPlans({ ...plans, premiumFeatures: a }); }} />
            <button onClick={() => setPlans({ ...plans, premiumFeatures: plans.premiumFeatures.filter((_, j) => j !== i) })} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
          </div>
        ))}
        <button onClick={() => setPlans({ ...plans, premiumFeatures: [...plans.premiumFeatures, ''] })} className="text-xs text-primary flex items-center gap-1"><Plus size={14} /> Ajouter un avantage</button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 md:left-60 bg-light-surface/95 dark:bg-dark-surface/95 backdrop-blur border-t border-light-border dark:border-dark-border p-3 flex justify-end z-30">
        <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2"><Save size={16} /> {saving ? 'Enregistrement…' : 'Enregistrer'}</button>
      </div>
    </div>
  );
}
