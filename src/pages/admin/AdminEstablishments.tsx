import { useEffect, useState } from 'react';
import { Search, X, Trash2, ExternalLink, Download, Pencil, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useCategories } from '../../contexts/CategoriesContext';
import type { Establishment, CategoryKey } from '../../lib/types';
import ConfirmModal from '../../components/admin/ConfirmModal';
import EstablishmentEditSidebar from './EstablishmentEditSidebar';

const PAGE_SIZE = 20;

type StatusFilter = 'all' | 'free' | 'pro';

export default function AdminEstablishments() {
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [cities, setCities] = useState<string[]>([]);
  const { categories, categoryKeys } = useCategories();
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Establishment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      let query = supabase.from('establishments').select('*', { count: 'exact' });

      if (catFilter !== 'all') query = query.eq('category', catFilter);
      if (cityFilter !== 'all') query = query.eq('city', cityFilter);
      if (statusFilter === 'free') query = query.eq('is_pro', false);
      if (statusFilter === 'pro') query = query.eq('is_pro', true);
      if (search) query = query.ilike('name', `%${search}%`);

      query = query.order('created_at', { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, count } = await query;
      setEstablishments((data as Establishment[]) || []);
      setTotal(count ?? 0);
    } catch { /* handled */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [catFilter, cityFilter, statusFilter, search, page]);

  useEffect(() => {
    supabase.from('establishments').select('city').then(({ data }) => {
      setCities([...new Set((data || []).map((r: { city: string }) => r.city).filter(Boolean))].sort());
    });
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('establishments').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Etablissement supprime');
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
    setDeleting(false);
  };

  const exportCSV = () => {
    const headers = ['Nom', 'Categorie', 'Ville', 'Adresse', 'Pro', 'Cree_le'];
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = establishments.map((e) => [
      escape(e.name || ''),
      escape(e.category || ''),
      escape(e.city || ''),
      escape(e.address || ''),
      e.is_pro ? 'Oui' : 'Non',
      new Date(e.created_at).toLocaleDateString('fr-FR'),
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'etablissements.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const statusBadge = (e: Establishment) =>
    e.is_pro ? (
      <span
        className="text-xs font-semibold"
        style={{ background: 'rgba(123,45,139,0.2)', border: '1px solid #7B2D8B', color: '#c084f5', borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}
      >
        Pro
      </span>
    ) : (
      <span
        className="text-xs"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a3a', color: '#606070', borderRadius: 6, padding: '3px 10px', fontSize: 12 }}
      >
        Gratuit
      </span>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Etablissements</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setEditId('new')} className="btn-primary text-sm flex items-center gap-1.5 py-2 px-4">
            <Plus size={16} /> Creer
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            <Download size={16} /> Exporter CSV
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={catFilter} onChange={(e) => { setCatFilter(e.target.value); setPage(0); }} className="input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm w-auto py-2">
          <option value="all">Toutes categories</option>
          {categoryKeys.map((k) => <option key={k} value={k}>{categories[k as CategoryKey].label}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(0); }} className="input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm w-auto py-2">
          <option value="all">Tous statuts</option>
          <option value="free">Gratuit</option>
          <option value="pro">Pro</option>
        </select>
        {cities.length > 0 && (
          <select value={cityFilter} onChange={(e) => { setCityFilter(e.target.value); setPage(0); }} className="input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm w-auto py-2">
            <option value="all">Toutes les villes</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Rechercher..."
            className="input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm pl-9 py-2"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 dark:hover:text-white">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-16 rounded-card" />)}</div>
      ) : establishments.length === 0 ? (
        <p className="text-center text-gray-500 py-12">Aucun etablissement trouve.</p>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-light-border dark:border-dark-border">
                  <th className="py-3 px-3">Logo</th>
                  <th className="py-3 px-3">Nom</th>
                  <th className="py-3 px-3">Categorie</th>
                  <th className="py-3 px-3">Ville</th>
                  <th className="py-3 px-3">Statut</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {establishments.map((e) => (
                  <tr key={e.id} className="border-b border-light-border dark:border-dark-border/50 hover:bg-light-surface dark:bg-dark-surface/50">
                    <td className="py-2.5 px-3">
                      <div className="w-8 h-8 rounded bg-dark-border overflow-hidden flex items-center justify-center">
                        {e.logo_url ? <img src={e.logo_url} alt="" className="w-full h-full object-cover" /> : <span className="text-gray-600 text-xs">{e.name.charAt(0)}</span>}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-gray-900 dark:text-white font-medium">{e.name}</td>
                    <td className="py-2.5 px-3 text-gray-400">{e.category} · {e.subcategory}</td>
                    <td className="py-2.5 px-3 text-gray-400">{e.city}</td>
                    <td className="py-2.5 px-3">{statusBadge(e)}</td>
                    <td className="py-2.5 px-3 text-gray-500 text-xs">{new Date(e.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditId(e.id)} title="Modifier" className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"><Pencil size={15} /></button>
                        <a href={`/establishment/${e.id}`} target="_blank" rel="noopener noreferrer" title="Voir la fiche" className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"><ExternalLink size={15} /></a>
                        <button onClick={() => setDeleteTarget(e)} title="Supprimer" className="p-1.5 text-gray-500 hover:text-alert transition-colors"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {establishments.map((e) => (
              <div key={e.id} className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-dark-border overflow-hidden flex items-center justify-center shrink-0">
                    {e.logo_url ? <img src={e.logo_url} alt="" className="w-full h-full object-cover" /> : <span className="text-gray-600 text-sm">{e.name.charAt(0)}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{e.name}</p>
                    <p className="text-xs text-gray-500">{e.city} · {e.category}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  {statusBadge(e)}
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditId(e.id)} className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white"><Pencil size={15} /></button>
                    <a href={`/establishment/${e.id}`} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white"><ExternalLink size={15} /></a>
                    <button onClick={() => setDeleteTarget(e)} className="p-1.5 text-gray-500 hover:text-alert"><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`w-8 h-8 rounded text-sm font-medium transition-colors ${page === i ? 'bg-primary text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-light-surface dark:bg-dark-surface'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Supprimer definitivement"
        message={`Supprimer definitivement "${deleteTarget?.name}" ?`}
        confirmLabel="Supprimer"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
      />

      <EstablishmentEditSidebar
        establishmentId={editId}
        onClose={() => setEditId(null)}
        onRefresh={load}
      />
    </div>
  );
}
