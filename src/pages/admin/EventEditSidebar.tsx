import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import AdminEditSidebar, {
  SidebarField,
  SidebarInput,
  SidebarTextarea,
  SidebarSelect,
  SidebarToggle,
} from '../../components/admin/AdminEditSidebar';

interface Props {
  eventId: string | null;
  onClose: () => void;
  onRefresh: () => void;
}

interface FormData {
  title: string;
  description: string;
  theme: string;
  establishment_id: string;
  event_date: string;
  end_date: string;
  is_free: boolean;
  price: number;
  is_featured: boolean;
}

const initialForm: FormData = {
  title: '',
  description: '',
  theme: '',
  establishment_id: '',
  event_date: '',
  end_date: '',
  is_free: true,
  price: 0,
  is_featured: false,
};

function toLocalDatetime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export default function EventEditSidebar({ eventId, onClose, onRefresh }: Props) {
  const [form, setForm] = useState<FormData>(initialForm);
  const [establishments, setEstablishments] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const loadData = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setErrors({});
    try {
      const [eventRes, estRes] = await Promise.all([
        supabase.from('events').select('*').eq('id', eventId).single(),
        supabase.from('establishments').select('id, name').order('name'),
      ]);
      if (eventRes.error) throw eventRes.error;
      const ev = eventRes.data;
      setForm({
        title: ev.title || '',
        description: ev.description || '',
        theme: ev.theme || '',
        establishment_id: ev.establishment_id || '',
        event_date: toLocalDatetime(ev.event_date),
        end_date: toLocalDatetime(ev.end_date),
        is_free: ev.is_free ?? true,
        price: ev.price || 0,
        is_featured: ev.is_featured ?? false,
      });
      setEstablishments(
        (estRes.data || []).map((e: any) => ({ value: e.id, label: e.name }))
      );
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du chargement');
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    if (eventId) loadData();
  }, [eventId, loadData]);

  const set = (key: keyof FormData, val: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<Record<string, string>> = {};
    if (!form.title.trim()) e.title = 'Le titre est requis';
    if (!form.event_date) e.event_date = 'La date de debut est requise';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !eventId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('events')
        .update({
          title: form.title,
          description: form.description,
          theme: form.theme,
          establishment_id: form.establishment_id,
          event_date: new Date(form.event_date).toISOString(),
          end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
          is_free: form.is_free,
          price: form.is_free ? 0 : form.price,
          is_featured: form.is_featured,
        })
        .eq('id', eventId);
      if (error) throw error;
      toast.success('Evenement mis a jour !');
      onClose();
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
    setSaving(false);
  };

  return (
    <AdminEditSidebar
      open={!!eventId}
      title="Modifier l'evenement"
      loading={loading}
      saving={saving}
      onClose={onClose}
      onSave={handleSave}
    >
      <SidebarField label="Titre" error={errors.title}>
        <SidebarInput value={form.title} onChange={(v) => set('title', v)} required error={!!errors.title} />
      </SidebarField>

      <SidebarField label="Description">
        <SidebarTextarea value={form.description} onChange={(v) => set('description', v)} />
      </SidebarField>

      <SidebarField label="Theme">
        <SidebarInput value={form.theme} onChange={(v) => set('theme', v)} placeholder="Pride, Drag, Concert..." />
      </SidebarField>

      <SidebarField label="Etablissement">
        <SidebarSelect
          value={form.establishment_id}
          onChange={(v) => set('establishment_id', v)}
          options={[{ value: '', label: 'Selectionner...' }, ...establishments]}
        />
      </SidebarField>

      <div className="mb-2 mt-6">
        <p className="text-[12px] uppercase tracking-[0.5px] text-[#606070] font-medium">Dates</p>
      </div>

      <SidebarField label="Date de debut" error={errors.event_date}>
        <SidebarInput
          value={form.event_date}
          onChange={(v) => set('event_date', v)}
          type="datetime-local"
          required
          error={!!errors.event_date}
        />
      </SidebarField>

      <SidebarField label="Date de fin">
        <SidebarInput
          value={form.end_date}
          onChange={(v) => set('end_date', v)}
          type="datetime-local"
        />
      </SidebarField>

      <div className="mb-2 mt-6">
        <p className="text-[12px] uppercase tracking-[0.5px] text-[#606070] font-medium">Tarification</p>
      </div>

      <SidebarToggle checked={form.is_free} onChange={(v) => set('is_free', v)} label="Gratuit" />

      {!form.is_free && (
        <SidebarField label="Prix (EUR)">
          <SidebarInput
            value={form.price}
            onChange={(v) => set('price', parseFloat(v) || 0)}
            type="number"
            min={0}
            step={0.01}
          />
        </SidebarField>
      )}

      <div className="mb-2 mt-6">
        <p className="text-[12px] uppercase tracking-[0.5px] text-[#606070] font-medium">Mise en avant</p>
      </div>

      <SidebarToggle
        checked={form.is_featured}
        onChange={(v) => set('is_featured', v)}
        label="Evenement mis en avant (featured)"
        description="Les evenements featured apparaissent dans le bandeau en haut de l'app."
      />
    </AdminEditSidebar>
  );
}
