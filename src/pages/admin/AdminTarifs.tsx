import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DEFAULT_USER_PLANS, USER_PLANS_KEY, UserPlans, mergeUserPlans } from '../../lib/userPlans';
import { DEFAULT_PROS_CONTENT, PROS_SETTINGS_KEY, ProsContent, mergeProsContent } from '../pros/prosContent';

const card = 'bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-5 space-y-3';
const field = 'input-field bg-light-surface dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm py-1.5';
const h = 'text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide';

// Éditeur de liste de features "inclus/pas inclus"
function FreeList({ items, onChange }: { items: { label: string; included: boolean }[]; onChange: (v: { label: string; included: boolean }[]) => void }) {
  return (
    <>
      {items.map((f, i) => (
        <div key={i} className="flex items-center gap-2">
          <input type="checkbox" checked={f.included} title="Inclus ?"
            onChange={(e) => { const a = [...items]; a[i] = { ...a[i], included: e.target.checked }; onChange(a); }} />
          <input className={field + ' flex-1'} value={f.label}
            onChange={(e) => { const a = [...items]; a[i] = { ...a[i], label: e.target.value }; onChange(a); }} />
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
        </div>
      ))}
      <button onClick={() => onChange([...items, { label: '', included: true }])} className="text-xs text-primary flex items-center gap-1"><Plus size={14} /> Ajouter un avantage</button>
    </>
  );
}

// Éditeur de liste de features simples (labels)
function LabelList({ items, onChange }: { items: string[]; onChange: (v: string[]) => void }) {
  return (
    <>
      {items.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <input className={field + ' flex-1'} value={label} onChange={(e) => { const a = [...items]; a[i] = e.target.value; onChange(a); }} />
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
        </div>
      ))}
      <button onClick={() => onChange([...items, ''])} className="text-xs text-primary flex items-center gap-1"><Plus size={14} /> Ajouter un avantage</button>
    </>
  );
}

export default function AdminTarifs() {
  const [userPlans, setUserPlans] = useState<UserPlans>(DEFAULT_USER_PLANS);
  const [pros, setPros] = useState<ProsContent>(DEFAULT_PROS_CONTENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('app_settings').select('key, value').in('key', [USER_PLANS_KEY, PROS_SETTINGS_KEY])
      .then(({ data }) => {
        for (const r of data || []) {
          if (r.key === USER_PLANS_KEY && r.value) { try { setUserPlans(mergeUserPlans(JSON.parse(r.value))); } catch { /* défauts */ } }
          if (r.key === PROS_SETTINGS_KEY && r.value) { try { setPros(mergeProsContent(JSON.parse(r.value))); } catch { /* défauts */ } }
        }
        setLoading(false);
      });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      // 1) avantages utilisateurs
      const cleanUser: UserPlans = {
        freeFeatures: userPlans.freeFeatures.map((f) => ({ label: f.label.trim(), included: f.included })).filter((f) => f.label),
        premiumFeatures: userPlans.premiumFeatures.map((s) => s.trim()).filter(Boolean),
      };
      const { error: e1 } = await supabase.from('app_settings')
        .upsert({ key: USER_PLANS_KEY, value: JSON.stringify(cleanUser), updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (e1) throw e1;

      // 2) avantages pro : on recharge la landing pros à jour et on n'écrase QUE les listes de features
      const { data: fresh } = await supabase.from('app_settings').select('value').eq('key', PROS_SETTINGS_KEY).maybeSingle();
      const base = fresh?.value ? mergeProsContent(JSON.parse(fresh.value)) : DEFAULT_PROS_CONTENT;
      const merged: ProsContent = {
        ...base,
        pricing: {
          ...base.pricing,
          freeFeatures: pros.pricing.freeFeatures.map((f) => ({ label: f.label.trim(), included: f.included })).filter((f) => f.label),
          proFeatures: pros.pricing.proFeatures.map((s) => s.trim()).filter(Boolean),
        },
      };
      const { error: e2 } = await supabase.from('app_settings')
        .upsert({ key: PROS_SETTINGS_KEY, value: JSON.stringify(merged), updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (e2) throw e2;

      setUserPlans(cleanUser);
      setPros(merged);
      toast.success('Avantages enregistrés');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
    setSaving(false);
  };

  if (loading) return <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-40 rounded-card" />)}</div>;

  return (
    <div className="space-y-6 max-w-2xl pb-24">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Tarifs — listes d'avantages</h1>
        <p className="text-sm text-gray-500 mt-1">Gère les avantages affichés pour chaque formule (page Tarifs, inscription, landing Pros). Les prix ne se gèrent pas ici.</p>
      </div>

      <div className={card}>
        <p className={h}>Utilisateur · Gratuit</p>
        <p className="text-xs text-gray-500">Coche « inclus » (sinon l'avantage s'affiche barré).</p>
        <FreeList items={userPlans.freeFeatures} onChange={(v) => setUserPlans({ ...userPlans, freeFeatures: v })} />
      </div>

      <div className={card}>
        <p className={h}>Utilisateur · Premium</p>
        <LabelList items={userPlans.premiumFeatures} onChange={(v) => setUserPlans({ ...userPlans, premiumFeatures: v })} />
      </div>

      <div className={card}>
        <p className={h}>Établissement (Pro) · Gratuit</p>
        <p className="text-xs text-gray-500">Coche « inclus » (sinon l'avantage s'affiche barré).</p>
        <FreeList items={pros.pricing.freeFeatures} onChange={(v) => setPros({ ...pros, pricing: { ...pros.pricing, freeFeatures: v } })} />
      </div>

      <div className={card}>
        <p className={h}>Établissement (Pro) · Pro</p>
        <LabelList items={pros.pricing.proFeatures} onChange={(v) => setPros({ ...pros, pricing: { ...pros.pricing, proFeatures: v } })} />
      </div>

      <div className="fixed bottom-0 left-0 right-0 md:left-60 bg-light-surface/95 dark:bg-dark-surface/95 backdrop-blur border-t border-light-border dark:border-dark-border p-3 flex justify-end z-30">
        <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2"><Save size={16} /> {saving ? 'Enregistrement…' : 'Enregistrer'}</button>
      </div>
    </div>
  );
}
