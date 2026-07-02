import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  DEFAULT_PROS_CONTENT,
  PROS_SETTINGS_KEY,
  ProsContent,
  ProsStatSource,
  mergeProsContent,
  monthsFree,
  yearlySavings,
} from '../pros/prosContent';

const card = 'bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-5 space-y-4';
const field = 'input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white';
const lbl = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';
const h2 = 'text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide';

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${on ? 'bg-primary' : 'bg-dark-border'}`}
    >
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${on ? 'left-7' : 'left-1'}`} />
    </button>
  );
}

const STAT_SOURCES: { value: ProsStatSource; label: string }[] = [
  { value: 'establishments', label: 'Établissements (live)' },
  { value: 'events', label: 'Événements (live)' },
  { value: 'members', label: 'Membres (live)' },
  { value: 'reviews', label: 'Avis (live)' },
  { value: 'custom', label: 'Valeur libre' },
];

export default function AdminProsLanding() {
  const [c, setC] = useState<ProsContent>(DEFAULT_PROS_CONTENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', PROS_SETTINGS_KEY).maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          try { setC(mergeProsContent(JSON.parse(data.value))); } catch { /* défauts */ }
        }
        setLoading(false);
      });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: PROS_SETTINGS_KEY, value: JSON.stringify(c), updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
      toast.success('Landing Pros enregistrée');
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-40 rounded-card" />)}</div>;
  }

  const nbFree = monthsFree(c.pricing.proMonthly, c.pricing.proYearly);
  const annualSave = yearlySavings(c.pricing.proMonthly, c.pricing.proYearly);

  return (
    <div className="space-y-6 max-w-3xl pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Landing Pros</h1>
        <a href="/pros" target="_blank" rel="noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
          Voir la page <ExternalLink size={13} />
        </a>
      </div>

      {/* HERO */}
      <div className={card}>
        <p className={h2}>En-tête (hero)</p>
        <div>
          <label className={lbl}>Titre</label>
          <input className={field} value={c.hero.title} onChange={(e) => setC({ ...c, hero: { ...c.hero, title: e.target.value } })} />
        </div>
        <div>
          <label className={lbl}>Mot mis en avant (couleur accent, à la fin du titre)</label>
          <input className={field} value={c.hero.highlight} onChange={(e) => setC({ ...c, hero: { ...c.hero, highlight: e.target.value } })} />
        </div>
        <div>
          <label className={lbl}>Sous-titre</label>
          <textarea rows={3} className={`${field} resize-none`} value={c.hero.subtitle} onChange={(e) => setC({ ...c, hero: { ...c.hero, subtitle: e.target.value } })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Bouton principal</label>
            <input className={field} value={c.hero.ctaPrimary} onChange={(e) => setC({ ...c, hero: { ...c.hero, ctaPrimary: e.target.value } })} />
          </div>
          <div>
            <label className={lbl}>Bouton secondaire</label>
            <input className={field} value={c.hero.ctaSecondary} onChange={(e) => setC({ ...c, hero: { ...c.hero, ctaSecondary: e.target.value } })} />
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className={card}>
        <div className="flex items-center justify-between">
          <p className={h2}>Chiffres clés</p>
          <Toggle on={c.stats.show} onChange={(v) => setC({ ...c, stats: { ...c.stats, show: v } })} />
        </div>
        <div className="flex items-center gap-3">
          <label className={lbl + ' !mb-0'}>Mode</label>
          <select
            className={`${field} !w-auto py-1.5`}
            value={c.stats.mode}
            onChange={(e) => setC({ ...c, stats: { ...c.stats, mode: e.target.value as 'auto' | 'manual' } })}
          >
            <option value="auto">Automatique (compteurs réels du site)</option>
            <option value="manual">Manuel (je saisis les valeurs)</option>
          </select>
        </div>
        {c.stats.items.map((s, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end border-t border-light-border dark:border-dark-border pt-3">
            <div>
              <label className={lbl}>Source</label>
              <select
                className={`${field} py-1.5`}
                value={s.source}
                onChange={(e) => {
                  const items = [...c.stats.items];
                  items[i] = { ...items[i], source: e.target.value as ProsStatSource };
                  setC({ ...c, stats: { ...c.stats, items } });
                }}
              >
                {STAT_SOURCES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Libellé</label>
              <input className={`${field} py-1.5`} value={s.label} onChange={(e) => {
                const items = [...c.stats.items]; items[i] = { ...items[i], label: e.target.value }; setC({ ...c, stats: { ...c.stats, items } });
              }} />
            </div>
            <button type="button" onClick={() => setC({ ...c, stats: { ...c.stats, items: c.stats.items.filter((_, j) => j !== i) } })} className="p-2 text-gray-400 hover:text-red-500 mb-0.5">
              <Trash2 size={16} />
            </button>
            <div className="sm:col-span-3">
              <label className={lbl}>Description</label>
              <input className={`${field} py-1.5`} value={s.desc} onChange={(e) => {
                const items = [...c.stats.items]; items[i] = { ...items[i], desc: e.target.value }; setC({ ...c, stats: { ...c.stats, items } });
              }} />
            </div>
            {(c.stats.mode === 'manual' || s.source === 'custom') && (
              <div className="sm:col-span-3">
                <label className={lbl}>Valeur affichée</label>
                <input className={`${field} py-1.5`} placeholder="ex. 40, 1 200+…" value={s.value} onChange={(e) => {
                  const items = [...c.stats.items]; items[i] = { ...items[i], value: e.target.value }; setC({ ...c, stats: { ...c.stats, items } });
                }} />
              </div>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setC({ ...c, stats: { ...c.stats, items: [...c.stats.items, { source: 'custom', value: '', label: '', desc: '' }] } })} className="text-xs text-primary flex items-center gap-1">
          <Plus size={14} /> Ajouter un chiffre
        </button>
      </div>

      {/* BENEFITS */}
      <div className={card}>
        <p className={h2}>Avantages</p>
        <div>
          <label className={lbl}>Titre de section</label>
          <input className={field} value={c.benefits.title} onChange={(e) => setC({ ...c, benefits: { ...c.benefits, title: e.target.value } })} />
        </div>
        <div>
          <label className={lbl}>Sous-titre</label>
          <input className={field} value={c.benefits.subtitle} onChange={(e) => setC({ ...c, benefits: { ...c.benefits, subtitle: e.target.value } })} />
        </div>
        {c.benefits.items.map((b, i) => (
          <div key={i} className="grid grid-cols-[auto_1fr_auto] gap-2 items-start border-t border-light-border dark:border-dark-border pt-3">
            <input className={`${field} w-14 text-center py-1.5`} value={b.emoji} onChange={(e) => { const items = [...c.benefits.items]; items[i] = { ...items[i], emoji: e.target.value }; setC({ ...c, benefits: { ...c.benefits, items } }); }} />
            <div className="space-y-2">
              <input className={`${field} py-1.5`} placeholder="Titre" value={b.title} onChange={(e) => { const items = [...c.benefits.items]; items[i] = { ...items[i], title: e.target.value }; setC({ ...c, benefits: { ...c.benefits, items } }); }} />
              <textarea rows={2} className={`${field} py-1.5 resize-none`} placeholder="Texte" value={b.text} onChange={(e) => { const items = [...c.benefits.items]; items[i] = { ...items[i], text: e.target.value }; setC({ ...c, benefits: { ...c.benefits, items } }); }} />
            </div>
            <button type="button" onClick={() => setC({ ...c, benefits: { ...c.benefits, items: c.benefits.items.filter((_, j) => j !== i) } })} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
          </div>
        ))}
        <button type="button" onClick={() => setC({ ...c, benefits: { ...c.benefits, items: [...c.benefits.items, { emoji: '✨', title: '', text: '' }] } })} className="text-xs text-primary flex items-center gap-1"><Plus size={14} /> Ajouter un avantage</button>
      </div>

      {/* PRICING */}
      <div className={card}>
        <div className="flex items-center justify-between">
          <p className={h2}>Tarifs</p>
          <Toggle on={c.pricing.show} onChange={(v) => setC({ ...c, pricing: { ...c.pricing, show: v } })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Pro — prix mensuel (€)</label>
            <input type="number" className={field} value={c.pricing.proMonthly} onChange={(e) => setC({ ...c, pricing: { ...c.pricing, proMonthly: Number(e.target.value) } })} />
          </div>
          <div>
            <label className={lbl}>Pro — prix annuel (€)</label>
            <input type="number" className={field} value={c.pricing.proYearly} onChange={(e) => setC({ ...c, pricing: { ...c.pricing, proYearly: Number(e.target.value) } })} />
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Calculé automatiquement : {nbFree > 0 ? `${nbFree} mois offert${nbFree > 1 ? 's' : ''}, ` : ''}économie {annualSave}€/an.
          {annualSave <= 0 && ' (aucune remise annuelle avec ces prix)'}
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className={lbl}>Formule gratuite — lignes</p>
            {c.pricing.freeFeatures.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="checkbox" checked={f.included} onChange={(e) => { const arr = [...c.pricing.freeFeatures]; arr[i] = { ...arr[i], included: e.target.checked }; setC({ ...c, pricing: { ...c.pricing, freeFeatures: arr } }); }} title="Inclus ?" />
                <input className={`${field} py-1`} value={f.label} onChange={(e) => { const arr = [...c.pricing.freeFeatures]; arr[i] = { ...arr[i], label: e.target.value }; setC({ ...c, pricing: { ...c.pricing, freeFeatures: arr } }); }} />
                <button type="button" onClick={() => setC({ ...c, pricing: { ...c.pricing, freeFeatures: c.pricing.freeFeatures.filter((_, j) => j !== i) } })} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            ))}
            <button type="button" onClick={() => setC({ ...c, pricing: { ...c.pricing, freeFeatures: [...c.pricing.freeFeatures, { label: '', included: true }] } })} className="text-xs text-primary flex items-center gap-1"><Plus size={13} /> Ligne</button>
          </div>
          <div className="space-y-2">
            <p className={lbl}>Formule Pro — lignes</p>
            {c.pricing.proFeatures.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className={`${field} py-1`} value={f} onChange={(e) => { const arr = [...c.pricing.proFeatures]; arr[i] = e.target.value; setC({ ...c, pricing: { ...c.pricing, proFeatures: arr } }); }} />
                <button type="button" onClick={() => setC({ ...c, pricing: { ...c.pricing, proFeatures: c.pricing.proFeatures.filter((_, j) => j !== i) } })} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            ))}
            <button type="button" onClick={() => setC({ ...c, pricing: { ...c.pricing, proFeatures: [...c.pricing.proFeatures, ''] } })} className="text-xs text-primary flex items-center gap-1"><Plus size={13} /> Ligne</button>
          </div>
        </div>
      </div>

      {/* TESTIMONIALS */}
      <div className={card}>
        <div className="flex items-center justify-between">
          <p className={h2}>Témoignages</p>
          <Toggle on={c.testimonials.show} onChange={(v) => setC({ ...c, testimonials: { ...c.testimonials, show: v } })} />
        </div>
        <p className="text-xs text-gray-500">Masqué tant qu’il n’y a pas de vrais témoignages. N’ajoutez que de vrais avis d’établissements.</p>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl}>Titre</label><input className={field} value={c.testimonials.title} onChange={(e) => setC({ ...c, testimonials: { ...c.testimonials, title: e.target.value } })} /></div>
          <div><label className={lbl}>Sous-titre</label><input className={field} value={c.testimonials.subtitle} onChange={(e) => setC({ ...c, testimonials: { ...c.testimonials, subtitle: e.target.value } })} /></div>
        </div>
        {c.testimonials.items.map((t, i) => (
          <div key={i} className="border-t border-light-border dark:border-dark-border pt-3 space-y-2">
            <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
              <input className={`${field} py-1.5`} placeholder="Nom" value={t.name} onChange={(e) => { const a = [...c.testimonials.items]; a[i] = { ...a[i], name: e.target.value }; setC({ ...c, testimonials: { ...c.testimonials, items: a } }); }} />
              <input className={`${field} py-1.5`} placeholder="Établissement" value={t.place} onChange={(e) => { const a = [...c.testimonials.items]; a[i] = { ...a[i], place: e.target.value }; setC({ ...c, testimonials: { ...c.testimonials, items: a } }); }} />
              <select className={`${field} py-1.5 !w-auto`} value={t.stars} onChange={(e) => { const a = [...c.testimonials.items]; a[i] = { ...a[i], stars: Number(e.target.value) }; setC({ ...c, testimonials: { ...c.testimonials, items: a } }); }}>
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
              </select>
              <button type="button" onClick={() => setC({ ...c, testimonials: { ...c.testimonials, items: c.testimonials.items.filter((_, j) => j !== i) } })} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
            </div>
            <textarea rows={2} className={`${field} py-1.5 resize-none`} placeholder="Citation" value={t.quote} onChange={(e) => { const a = [...c.testimonials.items]; a[i] = { ...a[i], quote: e.target.value }; setC({ ...c, testimonials: { ...c.testimonials, items: a } }); }} />
          </div>
        ))}
        <button type="button" onClick={() => setC({ ...c, testimonials: { ...c.testimonials, items: [...c.testimonials.items, { name: '', place: '', quote: '', stars: 5 }] } })} className="text-xs text-primary flex items-center gap-1"><Plus size={14} /> Ajouter un témoignage</button>
      </div>

      {/* CTA */}
      <div className={card}>
        <p className={h2}>Appel à l’action final</p>
        <div><label className={lbl}>Titre</label><input className={field} value={c.cta.title} onChange={(e) => setC({ ...c, cta: { ...c.cta, title: e.target.value } })} /></div>
        <div><label className={lbl}>Sous-titre</label><input className={field} value={c.cta.subtitle} onChange={(e) => setC({ ...c, cta: { ...c.cta, subtitle: e.target.value } })} /></div>
        <div><label className={lbl}>Bouton</label><input className={field} value={c.cta.button} onChange={(e) => setC({ ...c, cta: { ...c.cta, button: e.target.value } })} /></div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 md:left-60 bg-light-surface/95 dark:bg-dark-surface/95 backdrop-blur border-t border-light-border dark:border-dark-border p-3 flex justify-end z-30">
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? 'Enregistrement…' : 'Enregistrer la landing'}
        </button>
      </div>
    </div>
  );
}
