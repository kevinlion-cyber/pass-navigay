import { useState } from 'react';
import { X, Search, Loader2, Star, MapPin, Sparkles, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useCategories } from '../../contexts/CategoriesContext';
import type { CategoryKey } from '../../lib/types';

interface Candidate {
  place_id: string;
  name: string;
  address: string;
  city: string;
  google_rating: number | null;
  google_rating_count: number | null;
  google_primary_type: string;
  category: string;
  discovery_query: string;
  targeted: boolean;
}

interface Stats { found: number; unique: number; duplicates: number; belowGate: number; minRating: number; minReviews: number; }

export default function AddPlacesModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { categories, categoryKeys } = useCategories();
  const [mode, setMode] = useState<'city' | 'name'>('city');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState<string>('');
  const [query, setQuery] = useState('');
  const [lgbtOnly, setLgbtOnly] = useState(false);
  const [minRating, setMinRating] = useState(4.0);
  const [minReviews, setMinReviews] = useState(20);

  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (!open) return null;

  const search = async () => {
    if (mode === 'city' && !city.trim()) { toast.error('Indiquez une ville'); return; }
    if (mode === 'name' && !query.trim()) { toast.error('Indiquez un nom à chercher'); return; }
    setSearching(true);
    setCandidates([]);
    setSelected(new Set());
    setStats(null);
    try {
      const body = mode === 'city'
        ? { city: city.trim(), category: category || null, lgbtOnly, minRating, minReviews }
        : { query: query.trim(), city: city.trim() || undefined, category: category || null, minRating, minReviews };
      const { data, error } = await supabase.functions.invoke('fiches-search', { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCandidates(data.candidates || []);
      setStats(data.stats || null);
      // Pré-cocher les lieux issus des requêtes LGBT-ciblées (les plus pertinents).
      setSelected(new Set((data.candidates || []).filter((c: Candidate) => c.targeted).map((c: Candidate) => c.place_id)));
      if (!data.candidates?.length) toast('Aucun lieu au-dessus du seuil. Baissez la note/les avis si besoin.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de recherche');
    }
    setSearching(false);
  };

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setSelected((s) => s.size === candidates.length ? new Set() : new Set(candidates.map((c) => c.place_id)));

  const create = async () => {
    const items = candidates.filter((c) => selected.has(c.place_id));
    if (!items.length) { toast.error('Cochez au moins un lieu'); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('fiches-enrich', { body: { items } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data.capped) {
        toast(`Clé de dev : ${data.cap} fiches créées sur ${data.requested} demandées (garde-fou anti-mass). La clé de Kevin lèvera la limite.`, { icon: '⛔', duration: 6000 });
      } else {
        toast.success(`${data.enriched} fiche(s) créée(s) et décrite(s) par l'IA`);
      }
      onDone();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur à la création");
    }
    setCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-2xl my-8 bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-light-border dark:border-dark-border">
          <div className="flex items-center gap-2">
            <Sparkles size={18} style={{ color: '#7B2D8B' }} />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Ajouter des lieux</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Mode */}
          <div className="flex gap-1 bg-light-bg dark:bg-dark-bg p-1 rounded-input w-fit">
            {(['city', 'name'] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${mode === m ? 'bg-primary/15 text-primary' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>
                {m === 'city' ? 'Balayer une ville' : 'Chercher par nom'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mode === 'city' ? (
              <>
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ville (ex. Montpellier)" className="input-field bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm py-2" />
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm py-2">
                  <option value="">Toutes catégories</option>
                  {categoryKeys.map((k) => <option key={k} value={k}>{categories[k as CategoryKey].label}</option>)}
                </select>
              </>
            ) : (
              <>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom du lieu (ex. Café de la Mer)" className="input-field bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm py-2" />
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ville (optionnel)" className="input-field bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm py-2" />
              </>
            )}
          </div>

          {/* Gate qualité + options */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2 text-gray-500">
              Note min
              <input type="number" step="0.1" min="0" max="5" value={minRating} onChange={(e) => setMinRating(Number(e.target.value))} className="w-16 input-field bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm py-1.5" />
            </label>
            <label className="flex items-center gap-2 text-gray-500">
              Avis min
              <input type="number" min="0" value={minReviews} onChange={(e) => setMinReviews(Number(e.target.value))} className="w-20 input-field bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm py-1.5" />
            </label>
            {mode === 'city' && (
              <label className="flex items-center gap-2 text-gray-500 cursor-pointer">
                <input type="checkbox" checked={lgbtOnly} onChange={(e) => setLgbtOnly(e.target.checked)} />
                Lieux LGBT ciblés seulement
              </label>
            )}
            <button onClick={search} disabled={searching} className="btn-primary text-sm flex items-center gap-1.5 py-2 px-4 ml-auto disabled:opacity-60">
              {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Chercher
            </button>
          </div>

          {/* Résultats */}
          {stats && (
            <div className="text-xs text-gray-500 flex flex-wrap gap-3 border-t border-light-border dark:border-dark-border pt-3">
              <span><strong className="text-gray-900 dark:text-white">{stats.unique}</strong> lieux retenus</span>
              <span>{stats.duplicates} déjà en base</span>
              <span>{stats.belowGate} sous le seuil ({stats.minRating}★ / {stats.minReviews} avis)</span>
            </div>
          )}

          {candidates.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <button onClick={toggleAll} className="text-xs text-primary hover:underline">
                  {selected.size === candidates.length ? 'Tout décocher' : 'Tout cocher'}
                </button>
                <span className="text-xs text-gray-500">{selected.size} sélectionné(s)</span>
              </div>
              <div className="max-h-[45vh] overflow-y-auto space-y-1.5 -mx-1 px-1">
                {candidates.map((c) => {
                  const on = selected.has(c.place_id);
                  return (
                    <button key={c.place_id} onClick={() => toggle(c.place_id)} className={`w-full text-left flex items-start gap-3 p-2.5 rounded-input border transition-colors ${on ? 'border-primary bg-primary/5' : 'border-light-border dark:border-dark-border hover:border-gray-400'}`}>
                      <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 ${on ? 'bg-primary' : 'border border-gray-400'}`}>
                        {on && <Check size={12} className="text-white" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{c.name}</span>
                          {c.targeted && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(123,45,139,0.18)', color: '#c084f5' }}>LGBT ciblé</span>}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap mt-0.5">
                          <span>{categories[c.category as CategoryKey]?.label || c.category}</span>
                          {c.google_primary_type && <span>· {c.google_primary_type}</span>}
                          {typeof c.google_rating === 'number' && <span className="inline-flex items-center gap-0.5"><Star size={11} style={{ color: '#d4a017' }} /> {c.google_rating} ({c.google_rating_count})</span>}
                          <span className="inline-flex items-center gap-0.5"><MapPin size={11} /> {c.city}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t border-light-border dark:border-dark-border">
          <p className="text-xs text-gray-500">L'IA rédige la fiche des lieux cochés. Rien n'est publié : ils atterrissent dans « À valider ».</p>
          <button onClick={create} disabled={creating || selected.size === 0} className="btn-primary text-sm flex items-center gap-1.5 py-2 px-4 disabled:opacity-50 shrink-0">
            {creating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Créer les fiches ({selected.size})
          </button>
        </div>
      </div>
    </div>
  );
}
