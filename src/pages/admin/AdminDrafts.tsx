import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Check, X, ExternalLink, Star, Pencil, RefreshCw, Plus, Eye, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useCategories } from '../../contexts/CategoriesContext';
import type { CategoryKey } from '../../lib/types';
import ConfirmModal from '../../components/admin/ConfirmModal';
import EstablishmentEditSidebar from './EstablishmentEditSidebar';
import AddPlacesModal from './AddPlacesModal';
import FichePreviewModal from './FichePreviewModal';

interface Draft {
  id: string;
  place_id: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  website: string;
  google_rating: number | null;
  google_rating_count: number | null;
  google_primary_type: string;
  category: CategoryKey;
  discovery_query: string;
  ai_description: string | null;
  ai_subcategory: string | null;
  ai_tags: string[] | null;
  price_level: number | null;
  amenities: string[] | null;
  opening_hours: Record<string, { open: string; close: string } | null> | null;
  thumb_url: string | null;
  photo_urls: string[] | null;
  status: 'pending' | 'enriched' | 'approved' | 'rejected';
  published_establishment_id: string | null;
  created_at: string;
}

type StatusFilter = 'enriched' | 'approved' | 'rejected' | 'all';

const PHOTO_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fiches-photo`;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
const thumbUrl = (placeId: string, w = 120) => `${PHOTO_BASE}?place_id=${encodeURIComponent(placeId)}&i=0&w=${w}&apikey=${ANON}`;

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  enriched: { label: 'À valider', bg: 'rgba(210,153,34,0.15)', color: '#e3b341' },
  approved: { label: 'Publiée', bg: 'rgba(46,160,67,0.15)', color: '#3fb950' },
  rejected: { label: 'Rejetée', bg: 'rgba(192,57,43,0.12)', color: '#e06c5e' },
  pending: { label: 'À enrichir', bg: 'rgba(255,255,255,0.05)', color: '#808090' },
};

export default function AdminDrafts() {
  const { categories, categoryKeys } = useCategories();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('enriched');
  const [cityFilter, setCityFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [publishTarget, setPublishTarget] = useState<Draft | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [previewDraft, setPreviewDraft] = useState<Draft | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      let q = supabase.from('establishment_drafts').select('*', { count: 'exact' });
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      else q = q.neq('status', 'pending');
      if (cityFilter !== 'all') q = q.eq('city', cityFilter);
      if (catFilter !== 'all') q = q.eq('category', catFilter);
      if (search.trim()) q = q.ilike('name', `%${search.trim()}%`);
      q = q.order('created_at', { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1);
      const { data, count } = await q;
      setDrafts((data as Draft[]) || []);
      setTotal(count ?? 0);
    } catch { /* handled */ }
    setLoading(false);
  };

  const loadMeta = async () => {
    const { data } = await supabase.from('establishment_drafts').select('city,status');
    const rows = (data as { city: string; status: string }[]) || [];
    setCities([...new Set(rows.map((r) => r.city).filter(Boolean))].sort());
    setCounts(rows.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {} as Record<string, number>));
  };

  useEffect(() => { load(); }, [statusFilter, cityFilter, catFilter, search, page, pageSize]);
  useEffect(() => { loadMeta(); }, []);
  useEffect(() => { setPage(0); }, [statusFilter, cityFilter, catFilter, search, pageSize]);

  const publish = async () => {
    if (!publishTarget) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('fiches-publish', { body: { draftId: publishTarget.id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data.banner ? 'Fiche publiée avec ses photos' : 'Fiche publiée');
      setPublishTarget(null);
      setEditId(data.establishment_id);
      load(); loadMeta();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur à la publication');
    }
    setBusy(false);
  };

  const reject = async () => {
    if (!rejectTarget) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('establishment_drafts').update({ status: 'rejected' }).eq('id', rejectTarget.id);
      if (error) throw error;
      toast.success('Brouillon rejeté');
      setRejectTarget(null);
      load(); loadMeta();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
    setBusy(false);
  };

  const restore = async (d: Draft) => {
    await supabase.from('establishment_drafts').update({ status: 'enriched' }).eq('id', d.id);
    toast.success('Remis à valider');
    load(); loadMeta();
  };

  const allCount = (counts.enriched || 0) + (counts.approved || 0) + (counts.rejected || 0);
  const tabs: { key: StatusFilter; label: string; n: number }[] = [
    { key: 'enriched', label: 'À valider', n: counts.enriched || 0 },
    { key: 'approved', label: 'Publiées', n: counts.approved || 0 },
    { key: 'rejected', label: 'Rejetées', n: counts.rejected || 0 },
    { key: 'all', label: 'Toutes', n: allCount },
  ];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageNumbers = useMemo(() => {
    const arr: number[] = [];
    const from = Math.max(0, page - 2), to = Math.min(totalPages - 1, page + 2);
    for (let i = from; i <= to; i++) arr.push(i);
    return arr;
  }, [page, totalPages]);

  const Thumb = ({ d }: { d: Draft }) => {
    const small = d.thumb_url || thumbUrl(d.place_id, 120); // stockée si dispo, sinon proxy Google
    const big = d.thumb_url || thumbUrl(d.place_id, 1200);
    return (
      <button onClick={() => setLightbox(big)} className="relative w-11 h-11 rounded-lg overflow-hidden bg-primary/10 shrink-0" title="Agrandir la photo">
        <span className="absolute inset-0 flex items-center justify-center text-primary text-sm font-semibold">{d.name.charAt(0)}</span>
        <img src={small} alt="" className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      </button>
    );
  };

  const rowActions = (d: Draft) => (
    <div className="flex items-center justify-end gap-1">
      {(d.status === 'enriched') && (
        <>
          <button onClick={() => setPreviewDraft(d)} title="Prévisualiser" className="p-1.5 text-gray-500 hover:text-primary transition-colors"><Eye size={16} /></button>
          <button onClick={() => setPublishTarget(d)} title="Publier" className="p-1.5 text-green-500 hover:text-green-400 transition-colors"><Check size={16} /></button>
          <button onClick={() => setRejectTarget(d)} title="Rejeter" className="p-1.5 text-gray-500 hover:text-alert transition-colors"><X size={16} /></button>
        </>
      )}
      {d.status === 'approved' && d.published_establishment_id && (
        <>
          <a href={`/establishment/${d.published_establishment_id}`} target="_blank" rel="noopener noreferrer" title="Voir la fiche en ligne" className="p-1.5 text-gray-500 hover:text-primary transition-colors"><ExternalLink size={16} /></a>
          <button onClick={() => setEditId(d.published_establishment_id!)} title="Éditer" className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"><Pencil size={16} /></button>
        </>
      )}
      {d.status === 'rejected' && (
        <>
          <button onClick={() => setPreviewDraft(d)} title="Prévisualiser" className="p-1.5 text-gray-500 hover:text-primary transition-colors"><Eye size={16} /></button>
          <button onClick={() => restore(d)} title="Remettre à valider" className="p-1.5 text-gray-500 hover:text-green-500 transition-colors"><RefreshCw size={16} /></button>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={20} style={{ color: '#7B2D8B' }} />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Fiches auto</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAddOpen(true)} className="btn-primary text-sm flex items-center gap-1.5 py-2 px-4"><Plus size={16} /> Ajouter des lieux</button>
          <button onClick={() => { load(); loadMeta(); }} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"><RefreshCw size={15} /> Rafraîchir</button>
        </div>
      </div>
      <p className="text-sm text-gray-500 -mt-2">Candidats découverts automatiquement puis décrits par l'IA. Rien n'est public tant que vous n'avez pas publié.</p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 bg-light-surface dark:bg-dark-surface p-1 rounded-input border border-light-border dark:border-dark-border">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setStatusFilter(t.key)} className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${statusFilter === t.key ? 'bg-primary/15 text-primary' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>
              {t.label} <span className="opacity-60">{t.n}</span>
            </button>
          ))}
        </div>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm w-auto py-2">
          <option value="all">Toutes catégories</option>
          {categoryKeys.map((k) => <option key={k} value={k}>{categories[k as CategoryKey].label}</option>)}
        </select>
        {cities.length > 0 && (
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm w-auto py-2">
            <option value="all">Toutes les villes</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un nom…" className="input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm pl-9 py-2 w-full" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 dark:hover:text-white"><X size={14} /></button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-14 rounded-card" />)}</div>
      ) : drafts.length === 0 ? (
        <p className="text-center text-gray-500 py-12">Aucune fiche dans cet onglet.</p>
      ) : (
        <div className="overflow-x-auto border border-light-border dark:border-dark-border rounded-card">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-light-border dark:border-dark-border">
                <th className="py-2.5 px-3 w-14"></th>
                <th className="py-2.5 px-3">Nom</th>
                <th className="py-2.5 px-3 hidden md:table-cell">Catégorie</th>
                <th className="py-2.5 px-3 hidden sm:table-cell">Ville</th>
                <th className="py-2.5 px-3 hidden sm:table-cell">Note</th>
                <th className="py-2.5 px-3">Statut</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((d) => {
                const st = STATUS_BADGE[d.status] || STATUS_BADGE.pending;
                return (
                  <tr key={d.id} className="border-b border-light-border dark:border-dark-border/50 hover:bg-light-surface dark:hover:bg-dark-surface/40 align-middle">
                    <td className="py-2 px-3"><Thumb d={d} /></td>
                    <td className="py-2 px-3">
                      <button onClick={() => (d.status === 'approved' ? setEditId(d.published_establishment_id) : setPreviewDraft(d))} className="text-left">
                        <span className="text-gray-900 dark:text-white font-medium">{d.name}</span>
                        {d.ai_subcategory && <span className="block text-xs text-gray-500">{d.ai_subcategory}{typeof d.price_level === 'number' && d.price_level > 0 ? ` · ${'€'.repeat(d.price_level)}` : ''}</span>}
                      </button>
                    </td>
                    <td className="py-2 px-3 hidden md:table-cell text-gray-500">{categories[d.category as CategoryKey]?.label || d.category}</td>
                    <td className="py-2 px-3 hidden sm:table-cell text-gray-500">{d.city}</td>
                    <td className="py-2 px-3 hidden sm:table-cell text-gray-500">
                      {typeof d.google_rating === 'number' && <span className="inline-flex items-center gap-1"><Star size={12} style={{ color: '#d4a017' }} /> {d.google_rating} <span className="text-gray-400">({d.google_rating_count ?? 0})</span></span>}
                    </td>
                    <td className="py-2 px-3"><span className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                    <td className="py-2 px-3">{rowActions(d)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Lignes par page</span>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white text-xs w-auto py-1">
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span>· {total} fiche(s)</span>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-2 py-1 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white disabled:opacity-40">‹</button>
              {pageNumbers[0] > 0 && <span className="text-gray-400 px-1">…</span>}
              {pageNumbers.map((i) => (
                <button key={i} onClick={() => setPage(i)} className={`w-8 h-8 rounded text-sm font-medium transition-colors ${page === i ? 'bg-primary text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>{i + 1}</button>
              ))}
              {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && <span className="text-gray-400 px-1">…</span>}
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-2 py-1 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white disabled:opacity-40">›</button>
            </div>
          )}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-[70] bg-black/85 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}

      <ConfirmModal open={!!publishTarget} title="Publier cette fiche" message={`Créer l'établissement public "${publishTarget?.name}" ? Les photos seront récupérées automatiquement.`} confirmLabel="Publier" onCancel={() => setPublishTarget(null)} onConfirm={publish} loading={busy} />
      <ConfirmModal open={!!rejectTarget} title="Rejeter ce brouillon" message={`Rejeter "${rejectTarget?.name}" ? Il reste en base (non public).`} confirmLabel="Rejeter" onCancel={() => setRejectTarget(null)} onConfirm={reject} loading={busy} />
      <EstablishmentEditSidebar establishmentId={editId} onClose={() => setEditId(null)} onRefresh={() => { load(); loadMeta(); }} />
      <AddPlacesModal open={addOpen} onClose={() => setAddOpen(false)} onDone={() => { setStatusFilter('enriched'); load(); loadMeta(); }} />
      <FichePreviewModal open={!!previewDraft} onClose={() => setPreviewDraft(null)} data={previewDraft} />
    </div>
  );
}
