import { useEffect, useState } from 'react';
import { Search, X, ExternalLink, Trash2, Pencil, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import type { Event } from '../../lib/types';
import ConfirmModal from '../../components/admin/ConfirmModal';
import EventEditSidebar from './EventEditSidebar';

export default function AdminEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [establishments, setEstablishments] = useState<{ id: string; name: string; city: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estFilter, setEstFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      let query = supabase.from('events').select('*, establishment:establishments(id, name)').order('event_date', { ascending: false });
      if (estFilter !== 'all') query = query.eq('establishment_id', estFilter);
      if (cityFilter !== 'all') {
        const ids = establishments.filter((e) => e.city === cityFilter).map((e) => e.id);
        query = query.in('establishment_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
      }
      if (priceFilter === 'free') query = query.eq('is_free', true);
      if (priceFilter === 'paid') query = query.eq('is_free', false);
      if (search) query = query.ilike('title', `%${search}%`);

      const { data } = await query;
      setEvents((data as unknown as Event[]) || []);
    } catch { /* handled */ }
    setLoading(false);
  };

  useEffect(() => {
    supabase.from('establishments').select('id, name, city').order('name').then(({ data }) => {
      setEstablishments((data as any) || []);
    });
  }, []);

  useEffect(() => { load(); }, [estFilter, cityFilter, priceFilter, search, establishments]);


  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('events').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Événement supprimé');
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
    setDeleting(false);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Evenements</h1>
        <button onClick={() => setEditId('new')} className="btn-primary text-sm flex items-center gap-1.5 py-2 px-4">
          <Plus size={16} /> Creer un evenement
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={estFilter} onChange={(e) => setEstFilter(e.target.value)} className="input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm w-auto py-2">
          <option value="all">Tous les etablissements</option>
          {establishments.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select value={priceFilter} onChange={(e) => setPriceFilter(e.target.value)} className="input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm w-auto py-2">
          <option value="all">Tous les prix</option>
          <option value="free">Gratuit</option>
          <option value="paid">Payant</option>
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
      ) : events.length === 0 ? (
        <p className="text-center text-gray-500 py-12">Aucun evenement trouve.</p>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-light-border dark:border-dark-border">
                  <th className="py-3 px-3">Image</th>
                  <th className="py-3 px-3">Titre</th>
                  <th className="py-3 px-3">Etablissement</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Prix</th>
                  <th className="py-3 px-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => {
                  const est = ev.establishment as any;
                  return (
                    <tr key={ev.id} className="border-b border-light-border dark:border-dark-border/50 hover:bg-light-surface dark:bg-dark-surface/50">
                      <td className="py-2.5 px-3">
                        <div className="w-10 h-10 rounded bg-dark-border overflow-hidden">
                          {ev.image_url ? <img src={ev.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full" />}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-gray-900 dark:text-white font-medium">{ev.title}</td>
                      <td className="py-2.5 px-3">
                        {est?.name ? (
                          <a href={`/establishment/${est.id}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">{est.name}</a>
                        ) : <span className="text-gray-500">-</span>}
                      </td>
                      <td className="py-2.5 px-3 text-gray-400 text-xs">{formatDate(ev.event_date)}</td>
                      <td className="py-2.5 px-3 text-gray-400">{ev.is_free ? <span className="badge-free text-xs">Gratuit</span> : `${ev.price} EUR`}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditId(ev.id)} title="Modifier" className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"><Pencil size={15} /></button>
                          <a href={`/events/${ev.id}`} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white"><ExternalLink size={15} /></a>
                          <button onClick={() => setDeleteTarget(ev)} className="p-1.5 text-gray-500 hover:text-alert"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {events.map((ev) => {
              const est = ev.establishment as any;
              return (
                <div key={ev.id} className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded bg-dark-border overflow-hidden shrink-0">
                      {ev.image_url ? <img src={ev.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{ev.title}</p>
                      <p className="text-xs text-gray-500">{est?.name} · {formatDate(ev.event_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {ev.is_free ? <span className="badge-free text-xs">Gratuit</span> : <span className="text-xs text-gray-400">{ev.price} EUR</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditId(ev.id)} className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white"><Pencil size={15} /></button>
                      <a href={`/events/${ev.id}`} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white"><ExternalLink size={15} /></a>
                      <button onClick={() => setDeleteTarget(ev)} className="p-1.5 text-gray-500 hover:text-alert"><Trash2 size={15} /></button>
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
        title="Supprimer l'evenement"
        message={`Supprimer "${deleteTarget?.title}" ?`}
        confirmLabel="Supprimer"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
      />

      <EventEditSidebar
        eventId={editId}
        onClose={() => setEditId(null)}
        onRefresh={load}
      />
    </div>
  );
}
