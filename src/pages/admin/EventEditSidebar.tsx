import { useEffect, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import AdminEditSidebar, {
  SidebarField,
  SidebarInput,
  SidebarTextarea,
  SidebarSelect,
  SidebarToggle,
} from '../../components/admin/AdminEditSidebar';
import ImageUploadWithCrop from '../../components/admin/ImageUploadWithCrop';

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
  address: string;
  is_free: boolean;
  price: number;
  max_capacity: string;
  is_featured: boolean;
}

const initialForm: FormData = {
  title: '',
  description: '',
  theme: '',
  establishment_id: '',
  event_date: '',
  end_date: '',
  address: '',
  is_free: true,
  price: 0,
  max_capacity: '',
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
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<Blob | null>(null);
  const [establishments, setEstablishments] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const isNew = eventId === 'new';

  const loadData = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setErrors({});
    setCroppedImage(null);
    try {
      const estRes = await supabase.from('establishments').select('id, name').order('name');
      setEstablishments(
        (estRes.data || []).map((e: any) => ({ value: e.id, label: e.name }))
      );

      if (isNew) {
        setForm(initialForm);
        setImageUrl(null);
        setLoading(false);
        return;
      }

      const eventRes = await supabase.from('events').select('*').eq('id', eventId).single();
      if (eventRes.error) throw eventRes.error;
      const ev = eventRes.data;
      setForm({
        title: ev.title || '',
        description: ev.description || '',
        theme: ev.theme || '',
        establishment_id: ev.establishment_id || '',
        event_date: toLocalDatetime(ev.event_date),
        end_date: toLocalDatetime(ev.end_date),
        address: ev.address || '',
        is_free: ev.is_free ?? true,
        price: ev.price || 0,
        max_capacity: ev.max_capacity ? String(ev.max_capacity) : '',
        is_featured: ev.is_featured ?? false,
      });
      setImageUrl(ev.image_url || null);
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
      let newImageUrl = imageUrl;

      const payload = {
        title: form.title,
        description: form.description,
        theme: form.theme,
        establishment_id: form.establishment_id || null,
        event_date: new Date(form.event_date).toISOString(),
        end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
        address: form.address || null,
        is_free: form.is_free,
        price: form.is_free ? 0 : form.price,
        max_capacity: form.max_capacity ? parseInt(form.max_capacity) : null,
        is_featured: form.is_featured,
        image_url: newImageUrl,
      };

      if (isNew) {
        const { data: created, error } = await supabase.from('events').insert(payload).select('id').single();
        if (error) throw error;

        if (croppedImage && created) {
          setUploadProgress('Upload image...');
          const filename = `${Date.now()}.jpg`;
          const { error: upErr } = await supabase.storage.from('event-images').upload(`${created.id}/${filename}`, croppedImage, { contentType: 'image/jpeg', upsert: true });
          if (upErr) throw upErr;
          const { data: urlData } = supabase.storage.from('event-images').getPublicUrl(`${created.id}/${filename}`);
          await supabase.from('events').update({ image_url: urlData.publicUrl }).eq('id', created.id);
        }

        toast.success('Evenement cree !');
      } else {
        if (croppedImage) {
          setUploadProgress('Upload image...');
          const filename = `${Date.now()}.jpg`;
          const { error: upErr } = await supabase.storage.from('event-images').upload(`${eventId}/${filename}`, croppedImage, { contentType: 'image/jpeg', upsert: true });
          if (upErr) throw upErr;
          const { data: urlData } = supabase.storage.from('event-images').getPublicUrl(`${eventId}/${filename}`);
          newImageUrl = urlData.publicUrl;
        }

        const { error } = await supabase.from('events').update({ ...payload, image_url: newImageUrl }).eq('id', eventId);
        if (error) throw error;
        toast.success('Evenement mis a jour !');
      }

      setUploadProgress(null);
      onClose();
      onRefresh();
    } catch (err: any) {
      setUploadProgress(null);
      toast.error(err.message || 'Erreur');
    }
    setSaving(false);
  };

  return (
    <AdminEditSidebar
      open={!!eventId}
      title={isNew ? "Creer un evenement" : "Modifier l'evenement"}
      loading={loading}
      saving={saving}
      onClose={onClose}
      onSave={handleSave}
    >
      {uploadProgress && (
        <div className="mb-4 flex items-center gap-2 text-[13px] text-[#a0a0b0]">
          <Loader2 size={14} className="animate-spin" />
          {uploadProgress}
        </div>
      )}

      <ImageUploadWithCrop
        currentImageUrl={imageUrl}
        onImageCropped={(blob) => setCroppedImage(blob)}
        aspectRatio={3 / 2}
        label="PHOTO DE L'EVENEMENT (format 3:2)"
        hint="Image principale affichee dans les listes et sur la fiche evenement."
      />

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
        <p className="text-[12px] uppercase tracking-[0.5px] text-[#606070] font-medium">Lieu</p>
      </div>

      <SidebarField label="Adresse">
        <SidebarInput value={form.address} onChange={(v) => set('address', v)} placeholder="Adresse de l'evenement" />
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

      <SidebarField label="Nombre de places max">
        <SidebarInput
          value={form.max_capacity}
          onChange={(v) => set('max_capacity', v)}
          type="number"
          min={1}
          placeholder="Illimite si vide"
        />
      </SidebarField>

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
