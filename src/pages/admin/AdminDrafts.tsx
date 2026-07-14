import { useEffect, useState } from 'react';
import { Sparkles, Check, X, ExternalLink, Star, MapPin, Pencil, RefreshCw, Plus, Eye } from 'lucide-react';
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
  status: 'pending' | 'enriched' | 'approved' | 'rejected';
  created_at: string;
}

type StatusFilter = 'enriched' | 'pending' | 'approved' | 'rejected' | 'all';

export default function AdminDrafts() {
  const { categories } = useCategories();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('enriched');
  const [cityFilter, setCityFilter] = useState('all');
  const [cities, setCities] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [publishTarget, setPublishTarget] = useState<Draft | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [previewDraft, setPreviewDraft] = useState<Draft | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      let q = supabase.from('establishment_drafts').select('*').order('created_at', { ascending: false });
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      if (cityFilter !== 'all') q = q.eq('city', cityFilter);
      const { data } = await q;
      setDrafts((data as Draft[]) || []);
    } catch { /* handled */ }
    setLoading(false);
  };

  const loadMeta = async () => {
    const { data } = await supabase.from('establishment_drafts').select('city,status');
    const rows = (data as { city: string; status: string }[]) || [];
    setCities([...new Set(rows.map((r) => r.city).filter(Boolean))].sort());
    setCounts(rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {} as Record<string, number>));
  };

  useEffect(() => { load(); }, [statusFilter, cityFilter]);
  useEffect(() => { loadMeta(); }, []);

  const publish = async () => {
    if (!publishTarget) return;
    const d = publishTarget;
    setBusy(true);
    try {
      // Crée l'établissement + stocke les photos Google en Storage (bannière + galerie).
      const { data, error } = await supabase.functions.invoke('fiches-publish', { body: { draftId: d.id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data.banner ? 'Fiche publiée avec ses photos' : 'Fiche publiée');
      setPublishTarget(null);
      setEditId(data.establishment_id); // ouvre le sidebar pour ajuster si besoin
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

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: 'enriched', label: `À valider${counts.enriched ? ` (${counts.enriched})` : ''}` },
    { key: 'pending', label: `À enrichir${counts.pending ? ` (${counts.pending})` : ''}` },
    { key: 'approved', label: 'Publiées' },
    { key: 'rejected', label: 'Rejetées' },
    { key: 'all', label: 'Toutes' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={20} style={{ color: '#7B2D8B' }} />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Fiches auto</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAddOpen(true)} className="btn-primary text-sm flex items-center gap-1.5 py-2 px-4">
            <Plus size={16} /> Ajouter des lieux
          </button>
          <button onClick={() => { load(); loadMeta(); }} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            <RefreshCw size={15} /> Rafraîchir
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-500 -mt-2">
        Candidats découverts automatiquement puis décrits par l'IA. Rien n'est public tant que vous n'avez pas publié.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 bg-light-surface dark:bg-dark-surface p-1 rounded-input border border-light-border dark:border-dark-border">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatusFilter(t.key)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${statusFilter === t.key ? 'bg-primary/15 text-primary' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {cities.length > 0 && (
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm w-auto py-2">
            <option value="all">Toutes les villes</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-28 rounded-card" />)}</div>
      ) : drafts.length === 0 ? (
        <p className="text-center text-gray-500 py-12">Aucun brouillon dans cet onglet.</p>
      ) : (
        <div className="space-y-3">
          {drafts.map((d) => (
            <div key={d.id} className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">{d.name}</h3>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{categories[d.category as CategoryKey]?.label || d.category}{d.ai_subcategory ? ` · ${d.ai_subcategory}` : ''}</span>
                    <span className="inline-flex items-center gap-1"><MapPin size={12} /> {d.city}</span>
                    {typeof d.google_rating === 'number' && (
                      <span className="inline-flex items-center gap-1"><Star size={12} style={{ color: '#d4a017' }} /> {d.google_rating} ({d.google_rating_count ?? 0})</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setPreviewDraft(d)} title="Prévisualiser la fiche" className="p-2 text-gray-500 hover:text-primary transition-colors border border-light-border dark:border-dark-border rounded-input">
                    <Eye size={15} />
                  </button>
                  {(d.status === 'enriched' || d.status === 'pending') && (
                    <>
                      <button onClick={() => setPublishTarget(d)} className="btn-primary text-sm flex items-center gap-1.5 py-1.5 px-3">
                        <Check size={15} /> Publier
                      </button>
                      <button onClick={() => setRejectTarget(d)} title="Rejeter" className="p-2 text-gray-500 hover:text-alert transition-colors border border-light-border dark:border-dark-border rounded-input">
                        <X size={15} />
                      </button>
                    </>
                  )}
                  {d.status === 'approved' && d.published_establishment_id && (
                    <button onClick={() => setEditId(d.published_establishment_id!)} className="text-sm flex items-center gap-1.5 py-1.5 px-3 border border-light-border dark:border-dark-border rounded-input text-gray-500 hover:text-gray-900 dark:hover:text-white">
                      <Pencil size={14} /> Éditer la fiche
                    </button>
                  )}
                </div>
              </div>

              {d.ai_description ? (
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{d.ai_description}</p>
              ) : (
                <p className="text-sm text-gray-500 italic">Pas encore décrit par l'IA.</p>
              )}

              {d.ai_tags && d.ai_tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {d.ai_tags.map((t) => (
                    <span key={t} className="text-xs text-gray-500 bg-gray-100 dark:bg-dark-bg px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3 pt-1 text-xs text-gray-500">
                <a href={`https://www.google.com/maps/place/?q=place_id:${d.place_id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-gray-900 dark:hover:text-white">
                  <ExternalLink size={12} /> Voir sur Google
                </a>
                {d.website && (
                  <a href={d.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-gray-900 dark:hover:text-white truncate max-w-[200px]">
                    <ExternalLink size={12} /> Site web
                  </a>
                )}
                <span className="text-gray-600">· {d.discovery_query}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!publishTarget}
        title="Publier cette fiche"
        message={`Créer l'établissement public "${publishTarget?.name}" à partir de ce brouillon ? Vous pourrez ensuite ajouter bannière, logo et photos.`}
        confirmLabel="Publier"
        onCancel={() => setPublishTarget(null)}
        onConfirm={publish}
        loading={busy}
      />
      <ConfirmModal
        open={!!rejectTarget}
        title="Rejeter ce brouillon"
        message={`Rejeter "${rejectTarget?.name}" ? Il ne sera plus proposé (mais reste en base, non public).`}
        confirmLabel="Rejeter"
        onCancel={() => setRejectTarget(null)}
        onConfirm={reject}
        loading={busy}
      />

      <EstablishmentEditSidebar
        establishmentId={editId}
        onClose={() => setEditId(null)}
        onRefresh={() => { load(); loadMeta(); }}
      />

      <AddPlacesModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onDone={() => { setStatusFilter('enriched'); load(); loadMeta(); }}
      />

      <FichePreviewModal
        open={!!previewDraft}
        onClose={() => setPreviewDraft(null)}
        data={previewDraft}
      />
    </div>
  );
}
