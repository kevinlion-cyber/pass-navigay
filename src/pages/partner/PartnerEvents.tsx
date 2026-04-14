import { useEffect, useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import type { Establishment, Event } from '../../lib/types';
import ProGate from '../../components/partner/ProGate';
import ConfirmModal from '../../components/admin/ConfirmModal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ImageUploadWithCrop from '../../components/admin/ImageUploadWithCrop';

interface PartnerContext {
  establishment: Establishment;
  reload: () => void;
}

interface EventForm {
  title: string;
  description: string;
  theme: string;
  start_datetime: string;
  end_datetime: string;
  same_address: boolean;
  custom_address: string;
  is_free: boolean;
  price: number;
  request_featured: boolean;
  image_url: string;
}

const EMPTY_FORM: EventForm = {
  title: '',
  description: '',
  theme: '',
  start_datetime: '',
  end_datetime: '',
  same_address: true,
  custom_address: '',
  is_free: true,
  price: 0,
  request_featured: false,
  image_url: '',
};

export default function PartnerEvents() {
  const { establishment } = useOutletContext<PartnerContext>();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (!establishment.is_pro) return <ProGate feature="créer des événements" />;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('events').select('*')
        .eq('establishment_id', establishment.id)
        .order('event_date', { ascending: false });
      setEvents((data as Event[]) || []);
    } catch {
      toast.error('Erreur lors du chargement des événements');
    }
    setLoading(false);
  }, [establishment.id]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setCroppedBlob(null);
    setFormOpen(true);
  };

  const openEdit = (ev: Event) => {
    setEditing(ev);
    setForm({
      title: ev.title,
      description: ev.description || '',
      theme: ev.theme || '',
      start_datetime: ev.event_date ? ev.event_date.slice(0, 16) : '',
      end_datetime: ev.end_date ? ev.end_date.slice(0, 16) : '',
      same_address: ev.address === establishment.address || !ev.address,
      custom_address: ev.address || '',
      is_free: ev.is_free,
      price: ev.price || 0,
      request_featured: false,
      image_url: ev.image_url || '',
    });
    setCroppedBlob(null);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.start_datetime) return;
    setSaving(true);
    try {
      let image_url = form.image_url || null;
      if (croppedBlob) {
        const path = `${establishment.id}/${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage.from('event-images')
          .upload(path, croppedBlob, { contentType: 'image/jpeg' });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('event-images').getPublicUrl(path);
        image_url = urlData.publicUrl;
      }

      const payload = {
        establishment_id: establishment.id,
        title: form.title.trim(),
        description: form.description.trim(),
        event_date: new Date(form.start_datetime).toISOString(),
        end_date: form.end_datetime ? new Date(form.end_datetime).toISOString() : null,
        address: form.same_address ? establishment.address : form.custom_address,
        latitude: form.same_address ? establishment.latitude : null,
        longitude: form.same_address ? establishment.longitude : null,
        theme: form.theme.trim(),
        price: form.is_free ? 0 : form.price,
        is_free: form.is_free,
        image_url,
        is_featured: false,
      };

      if (editing) {
        const { error } = await supabase.from('events').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Événement modifié !');
      } else {
        const { error } = await supabase.from('events').insert(payload);
        if (error) throw error;
        toast.success('Événement publié ! Il est maintenant visible sur l\'app.');
      }
      setFormOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la sauvegarde');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('events').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Événement supprimé.');
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression');
    }
    setDeleting(false);
  };

  const isPast = (d: string) => new Date(d) < new Date();

  const formatDateFull = (d: string) => {
    const date = new Date(d);
    const day = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `${day.charAt(0).toUpperCase() + day.slice(1)} à ${time}`;
  };

  const descCharCount = form.description.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Mes événements</h1>
        <button onClick={openCreate} className="btn-primary text-sm py-2.5 px-5 flex items-center gap-2">
          <Plus size={16} /> Créer un événement
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-52 rounded-card" />)}</div>
      ) : events.length === 0 ? (
        <EmptyState onAction={openCreate} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {events.map((ev) => (
            <EventCard key={ev.id} event={ev} isPast={isPast(ev.event_date)}
              formatDate={formatDateFull} onEdit={() => openEdit(ev)}
              onDelete={() => setDeleteTarget(ev)} />
          ))}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && setFormOpen(false)}>
          <div className="bg-dark-surface border border-dark-border rounded-card w-full max-w-[600px] max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                {editing ? 'Modifier l\'événement' : 'Nouvel événement'}
              </h2>
              <button onClick={() => setFormOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <ImageUploadWithCrop
                currentImageUrl={form.image_url || null}
                onImageCropped={(blob) => setCroppedBlob(blob)}
                aspectRatio={3 / 2}
                label="Photo de l'événement (format 3:2)"
              />

              <div>
                <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1.5">Titre de l'événement</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required placeholder="Pride Party, Drag Bingo, Brunch Spécial..."
                  className="input-field bg-dark-bg border-dark-border text-white" />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1.5">Description</label>
                <textarea value={form.description}
                  onChange={(e) => { if (e.target.value.length <= 300) setForm({ ...form, description: e.target.value }); }}
                  rows={3} placeholder="Décris l'ambiance, le programme, ce qui rend cet événement unique..."
                  className="input-field bg-dark-bg border-dark-border text-white resize-none" style={{ minHeight: 80 }} />
                <p className="text-xs text-gray-600 text-right mt-1">{descCharCount}/300</p>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1.5">Thème / Style</label>
                <input value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value })}
                  placeholder="Pride, Drag, Électro, Brunch, Concert..."
                  className="input-field bg-dark-bg border-dark-border text-white" />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1.5">Début</label>
                  <input type="datetime-local" value={form.start_datetime}
                    onChange={(e) => setForm({ ...form, start_datetime: e.target.value })}
                    required className="input-field bg-dark-bg border-dark-border text-white" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1.5">Fin (optionnel)</label>
                  <input type="datetime-local" value={form.end_datetime}
                    onChange={(e) => setForm({ ...form, end_datetime: e.target.value })}
                    className="input-field bg-dark-bg border-dark-border text-white" />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <ToggleSwitch checked={form.same_address}
                    onChange={(v) => setForm({ ...form, same_address: v })} />
                  <span className="text-sm text-gray-300">Même adresse que mon établissement</span>
                </label>
                {!form.same_address && (
                  <input value={form.custom_address}
                    onChange={(e) => setForm({ ...form, custom_address: e.target.value })}
                    placeholder="Adresse de l'événement"
                    className="input-field bg-dark-bg border-dark-border text-white mt-3" />
                )}
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <ToggleSwitch checked={form.is_free}
                    onChange={(v) => setForm({ ...form, is_free: v })} />
                  <span className="text-sm text-gray-300">Événement gratuit</span>
                </label>
                {!form.is_free && (
                  <div className="mt-3">
                    <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1.5">Prix en €</label>
                    <input type="number" min={0} step="0.01" value={form.price || ''}
                      onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                      className="input-field bg-dark-bg border-dark-border text-white" />
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <ToggleSwitch checked={form.request_featured}
                    onChange={(v) => setForm({ ...form, request_featured: v })} />
                  <span className="text-sm text-gray-300">Demander la mise en avant (featured)</span>
                </label>
                <p className="text-xs text-gray-600 mt-1 ml-12">Notre équipe examinera ta demande et te contactera.</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setFormOpen(false)}
                  className="flex-1 btn-ghost py-2.5 text-sm">
                  Annuler
                </button>
                <button type="submit" disabled={saving}
                  className="flex-[2] py-2.5 rounded-input text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: '#7B2D8B' }}>
                  {saving && <LoadingSpinner size={16} />}
                  {editing ? 'Enregistrer les modifications' : 'Publier l\'événement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Supprimer cet événement"
        message="Supprimer cet événement ? Cette action est irréversible."
        confirmLabel="Supprimer"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}

function EmptyState({ onAction }: { onAction: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-5xl mb-6">📅</span>
      <h2 className="text-lg font-semibold text-white mb-2">Tu n'as pas encore d'événements</h2>
      <p className="text-sm text-gray-400 max-w-md mb-6 leading-relaxed">
        Publie tes soirées, brunchs, concerts et expositions pour toucher
        des milliers de membres Pass Navigay qui cherchent quoi faire.
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-8 text-sm text-gray-400">
        <span className="flex items-center gap-1.5">
          <Check size={14} style={{ color: '#1a7a3a' }} /> Visible immédiatement sur l'app
        </span>
        <span className="flex items-center gap-1.5">
          <Check size={14} style={{ color: '#1a7a3a' }} /> Partageable sur les réseaux sociaux
        </span>
        <span className="flex items-center gap-1.5">
          <Check size={14} style={{ color: '#1a7a3a' }} /> Gratuit avec ton abonnement Pro
        </span>
      </div>
      <button onClick={onAction}
        className="py-3 px-8 rounded-input text-sm font-semibold text-white transition-colors hover:opacity-90"
        style={{ background: '#7B2D8B' }}>
        + Créer mon premier événement
      </button>
    </div>
  );
}

function EventCard({
  event, isPast, formatDate, onEdit, onDelete,
}: {
  event: Event;
  isPast: boolean;
  formatDate: (d: string) => string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-card overflow-hidden" style={{ background: '#16161f', border: '1px solid #2a2a35' }}>
      <div className="h-[120px] overflow-hidden relative">
        {event.image_url ? (
          <img src={event.image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #3d1550, #1a0828)' }}>
            <span className="text-white/60 font-semibold text-sm text-center px-4">{event.title}</span>
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-sm font-bold text-white">{event.title}</h3>
          <span className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-pill text-xs font-medium ${
            isPast ? 'bg-gray-700 text-gray-400' : ''
          }`} style={!isPast ? { background: 'rgba(26,122,58,0.1)', color: '#1a7a3a' } : {}}>
            {isPast ? 'Passé' : 'À venir'}
          </span>
        </div>
        <p className="text-xs text-gray-400 mb-1 capitalize">{formatDate(event.event_date)}</p>
        <div className="flex items-center gap-2 mb-2">
          {event.is_free ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-xs font-medium"
              style={{ background: 'rgba(26,122,58,0.1)', color: '#1a7a3a' }}>Gratuit</span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-xs font-medium bg-gray-700 text-gray-300">
              {event.price} €
            </span>
          )}
        </div>
        {event.description && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-3">{event.description}</p>
        )}
        <div className="flex items-center gap-2 border-t border-dark-border pt-3">
          <button onClick={onEdit}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded-input hover:bg-dark-border">
            <Pencil size={13} /> Modifier
          </button>
          <button onClick={onDelete}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-alert transition-colors px-2 py-1 rounded-input hover:bg-alert/10">
            <Trash2 size={13} /> Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0"
      style={{ background: checked ? '#7B2D8B' : '#2a2a35' }}>
      <span className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
        style={{ transform: checked ? 'translateX(24px)' : 'translateX(4px)' }} />
    </button>
  );
}
