import { useEffect, useState } from 'react';
import { Search, X, Trash2, Pencil, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import type { Promotion } from '../../lib/types';
import ConfirmModal from '../../components/admin/ConfirmModal';
import PromotionEditSidebar from './PromotionEditSidebar';

export default function AdminPromotions() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [establishments, setEstablishments] = useState<{ id: string; name: string; city: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [estFilter, setEstFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      let query = supabase.from('promotions').select('*, establishment:establishments(id, name)').order('valid_until', { ascending: false });
      if (typeFilter !== 'all') query = query.eq('promo_type', typeFilter);
      if (estFilter !== 'all') query = query.eq('establishment_id', estFilter);
      if (cityFilter !== 'all') {
        const ids = establishments.filter((e) => e.city === cityFilter).map((e) => e.id);
        query = query.in('establishment_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
      }
      if (search) query = query.ilike('title', `%${search}%`);

      const { data } = await query;
      setPromos((data as unknown as Promotion[]) || []);
    } catch { /* handled */ }
    setLoading(false);
  };

  useEffect(() => {
    supabase.from('establishments').select('id, name, city').order('name').then(({ data }) => {
      setEstablishments((data as any) || []);
    });
  }, []);

  useEffect(() => { load(); }, [typeFilter, estFilter, cityFilter, search, establishments]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('promotions').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Promotion supprimee');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
    setDeleting(false);
  };

  const promoLabel = (p: Promotion) => {
    if (p.promo_type === 'percentage' && p.value) return `-${p.value}%`;
    if (p.promo_type === 'fixed' && p.value) return `-${p.value} EUR`;
    return 'Offre';
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Promotions</h1>
        <button onClick={() => setEditId('new')} className="btn-primary text-sm flex items-center gap-1.5 py-2 px-4">
          <Plus size={16} /> Creer une promo
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm w-auto py-2">
          <option value="all">Tous types</option>
          <option value="percentage">Pourcentage</option>
          <option value="fixed">Montant fixe</option>
          <option value="offer">Offre speciale</option>
        </select>
        <select value={estFilter} onChange={(e) => setEstFilter(e.target.value)} className="input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm w-auto py-2">
          <option value="all">Tous les etablissements</option>
          {establishments.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        {(() => { const cs = [...new Set(establishments.map((e) => e.city).filter(Boolean))].sort(); return cs.length > 0 && (
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm w-auto py-2">
            <option value="all">Toutes les villes</option>
            {cs.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        ); })()}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm pl-9 py-2" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 dark:hover:text-white"><X size={14} /></button>}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-16 rounded-card" />)}</div>
      ) : promos.length === 0 ? (
        <p className="text-center text-gray-500 py-12">Aucune promotion trouvee.</p>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-light-border dark:border-dark-border">
                  <th className="py-3 px-3">Image</th>
                  <th className="py-3 px-3">Titre</th>
                  <th className="py-3 px-3">Etablissement</th>
                  <th className="py-3 px-3">Reduction</th>
                  <th className="py-3 px-3">Validite</th>
                  <th className="py-3 px-3">Statut</th>
                  <th className="py-3 px-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {promos.map((p) => {
                  const est = p.establishment as any;
                  return (
                    <tr key={p.id} className="border-b border-light-border dark:border-dark-border/50 hover:bg-light-surface dark:bg-dark-surface/50">
                      <td className="py-2.5 px-3">
                        <div className="w-10 h-10 rounded bg-dark-border overflow-hidden">
                          {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full" />}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-gray-900 dark:text-white font-medium">{p.title}</td>
                      <td className="py-2.5 px-3 text-gray-400">{est?.name || '-'}</td>
                      <td className="py-2.5 px-3"><span className="badge-pro text-xs">{promoLabel(p)}</span></td>
                      <td className="py-2.5 px-3 text-gray-400 text-xs">{(p as any).is_permanent ? 'Permanente' : `${formatDate(p.valid_from)} → ${formatDate(p.valid_until)}`}</td>
                      <td className="py-2.5 px-3">{(p as any).is_active !== false ? <span className="text-emerald-400 text-xs font-medium">Active</span> : <span className="text-gray-500 text-xs">Inactive</span>}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditId(p.id)} title="Modifier" className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"><Pencil size={15} /></button>
                          <button onClick={() => setDeleteTarget(p)} className="p-1.5 text-gray-500 hover:text-alert"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {promos.map((p) => {
              const est = p.establishment as any;
              return (
                <div key={p.id} className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.title}</p>
                    <span className="badge-pro text-xs shrink-0">{promoLabel(p)}</span>
                  </div>
                  <p className="text-xs text-gray-500">{est?.name} · {(p as any).is_permanent ? 'Permanente' : `${formatDate(p.valid_from)} → ${formatDate(p.valid_until)}`}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">{(p as any).is_active !== false ? <span className="text-emerald-400 font-medium">Active</span> : <span className="text-gray-500">Inactive</span>}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditId(p.id)} className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white"><Pencil size={15} /></button>
                      <button onClick={() => setDeleteTarget(p)} className="p-1.5 text-gray-500 hover:text-alert"><Trash2 size={15} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Supprimer la promotion"
        message={`Supprimer "${deleteTarget?.title}" ?`}
        confirmLabel="Supprimer"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
      />

      <PromotionEditSidebar
        promoId={editId}
        onClose={() => setEditId(null)}
        onRefresh={load}
      />
    </div>
  );
}
