import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import type { Establishment, Event } from '../../lib/types';
import ProGate from '../../components/partner/ProGate';
import ConfirmModal from '../../components/admin/ConfirmModal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

interface PartnerContext {
  establishment: Establishment;
  reload: () => void;
}

const EMPTY: Partial<Event> = {
  title: '', description: '', event_date: '', end_date: '', address: '',
  theme: '', price: 0, is_free: true, image_url: '',
};

export default function PartnerEvents() {
  const { establishment } = useOutletContext<PartnerContext>();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [sameAddress, setSameAddress] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (!establishment.is_pro) return <ProGate feature="creer des evenements" />;

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('events').select('*').eq('establishment_id', establishment.id).order('event_date', { ascending: false });
      setEvents((data as Event[]) || []);
    } catch { /* handled */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [establishment.id]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setSameAddress(true);
    setImageFile(null);
    setFormOpen(true);
  };

  const openEdit = (ev: Event) => {
    setEditing(ev);
    setForm({
      title: ev.title,
      description: ev.description,
      event_date: ev.event_date ? ev.event_date.slice(0, 16) : '',
      end_date: ev.end_date ? ev.end_date.slice(0, 16) : '',
      address: ev.address,
      theme: ev.theme,
      price: ev.price,
      is_free: ev.is_free,
      image_url: ev.image_url,
    });
    setSameAddress(ev.address === establishment.address || !ev.address);
    setImageFile(null);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let image_url = form.image_url || null;
      if (imageFile) {
        const ext = imageFile.name.split('.').pop();
        const path = `${establishment.id}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from('establishment-photos').upload(path, imageFile);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('establishment-photos').getPublicUrl(path);
        image_url = urlData.publicUrl;
      }

      const payload = {
        establishment_id: establishment.id,
        title: form.title || '',
        description: form.description || '',
        event_date: form.event_date || new Date().toISOString(),
        end_date: form.end_date || null,
        address: sameAddress ? establishment.address : (form.address || ''),
        latitude: sameAddress ? establishment.latitude : null,
        longitude: sameAddress ? establishment.longitude : null,
        theme: form.theme || '',
        price: form.is_free ? 0 : (form.price || 0),
        is_free: form.is_free ?? true,
        image_url,
      };

      if (editing) {
        const { error } = await supabase.from('events').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Evenement modifie');
      } else {
        const { error } = await supabase.from('events').insert(payload);
        if (error) throw error;
        toast.success('Evenement cree');
      }
      setFormOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('events').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Evenement supprime');
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
    setDeleting(false);
  };

  const isPast = (d: string) => new Date(d) < new Date();
  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Evenements</h1>
        <button onClick={openCreate} className="btn-primary text-sm py-2 px-4 flex items-center gap-2">
          <Plus size={16} /> Creer
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-card" />)}</div>
      ) : events.length === 0 ? (
        <p className="text-center text-gray-500 py-12">Aucun evenement pour le moment.</p>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => (
            <div key={ev.id} className="bg-dark-surface border border-dark-border rounded-card p-4 flex items-center gap-4">
              <div className="w-14 h-14 rounded bg-dark-border overflow-hidden shrink-0">
                {ev.image_url ? <img src={ev.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{ev.title}</p>
                <p className="text-xs text-gray-500">{formatDate(ev.event_date)} · {ev.is_free ? 'Gratuit' : `${ev.price} EUR`}</p>
              </div>
              <span className={`badge text-xs shrink-0 ${isPast(ev.event_date) ? 'bg-gray-700 text-gray-400' : 'bg-success/10 text-success'}`}>
                {isPast(ev.event_date) ? 'Passe' : 'A venir'}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openEdit(ev)} className="p-1.5 text-gray-500 hover:text-white"><Pencil size={15} /></button>
                <button onClick={() => setDeleteTarget(ev)} className="p-1.5 text-gray-500 hover:text-alert"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-dark-surface border border-dark-border rounded-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">{editing ? 'Modifier' : 'Creer'} un evenement</h2>
              <button onClick={() => setFormOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Titre</label>
                <input value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="input-field bg-dark-bg border-dark-border text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                <textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="input-field bg-dark-bg border-dark-border text-white resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Date de debut</label>
                  <input type="datetime-local" value={typeof form.event_date === 'string' ? form.event_date : ''} onChange={(e) => setForm({ ...form, event_date: e.target.value })} required className="input-field bg-dark-bg border-dark-border text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Date de fin</label>
                  <input type="datetime-local" value={typeof form.end_date === 'string' ? form.end_date : ''} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="input-field bg-dark-bg border-dark-border text-white" />
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={sameAddress} onChange={(e) => setSameAddress(e.target.checked)} className="accent-primary" />
                  Meme adresse que l'etablissement
                </label>
                {!sameAddress && (
                  <input value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Adresse" className="input-field bg-dark-bg border-dark-border text-white mt-2" />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Theme</label>
                <input value={form.theme || ''} onChange={(e) => setForm({ ...form, theme: e.target.value })} placeholder="Pride, Drag, Concert..." className="input-field bg-dark-bg border-dark-border text-white" />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={form.is_free ?? true} onChange={(e) => setForm({ ...form, is_free: e.target.checked })} className="accent-primary" />
                  Gratuit
                </label>
                {!form.is_free && (
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-300 mb-1">Prix (EUR)</label>
                    <input type="number" min={0} step="0.01" value={form.price || ''} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} className="input-field bg-dark-bg border-dark-border text-white" />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Image</label>
                <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="input-field bg-dark-bg border-dark-border text-white text-sm" />
              </div>
              <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
                {saving && <LoadingSpinner size={16} />} {editing ? 'Enregistrer' : 'Creer l\'evenement'}
              </button>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Supprimer l'evenement"
        message={`Es-tu sur de vouloir supprimer "${deleteTarget?.title}" ?`}
        confirmLabel="Supprimer"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
