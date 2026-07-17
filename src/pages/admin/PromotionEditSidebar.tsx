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
  promoId: string | null;
  onClose: () => void;
  onRefresh: () => void;
}

interface FormData {
  title: string;
  description: string;
  establishment_id: string;
  promo_type: string;
  value: number;
  offer_text: string;
  is_permanent: boolean;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
}

const initialForm: FormData = {
  title: '',
  description: '',
  establishment_id: '',
  promo_type: 'percentage',
  value: 0,
  offer_text: '',
  is_permanent: false,
  valid_from: '',
  valid_until: '',
  is_active: true,
};

const promoTypeOptions = [
  { value: 'percentage', label: 'Reduction en %' },
  { value: 'fixed', label: 'Montant fixe en EUR' },
  { value: 'offer', label: 'Offre speciale (texte libre)' },
];

function toLocalDatetime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export default function PromotionEditSidebar({ promoId, onClose, onRefresh }: Props) {
  const [form, setForm] = useState<FormData>(initialForm);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<Blob | null>(null);
  const [establishments, setEstablishments] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const isNew = promoId === 'new';

  const loadData = useCallback(async () => {
    if (!promoId) return;
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

      const promoRes = await supabase.from('promotions').select('*').eq('id', promoId).single();
      if (promoRes.error) throw promoRes.error;
      const p = promoRes.data;
      setForm({
        title: p.title || '',
        description: p.description || '',
        establishment_id: p.establishment_id || '',
        promo_type: p.promo_type || 'percentage',
        value: p.value || 0,
        offer_text: p.promo_type === 'offer' ? (p.description || '') : '',
        is_permanent: p.is_permanent ?? false,
        valid_from: toLocalDatetime(p.valid_from),
        valid_until: toLocalDatetime(p.valid_until),
        is_active: p.is_active ?? true,
      });
      setImageUrl(p.image_url || null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du chargement');
    }
    setLoading(false);
  }, [promoId]);

  useEffect(() => {
    if (promoId) loadData();
  }, [promoId, loadData]);

  const set = (key: keyof FormData, val: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<Record<string, string>> = {};
    if (!form.title.trim()) e.title = 'Le titre est requis';
    if (!form.is_permanent) {
      if (!form.valid_from) e.valid_from = 'La date de debut est requise';
      if (!form.valid_until) e.valid_until = 'La date de fin est requise';
      if (form.valid_from && form.valid_until && new Date(form.valid_until) <= new Date(form.valid_from)) {
        e.valid_until = 'La date de fin doit etre posterieure a la date de debut';
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !promoId) return;
    setSaving(true);
    try {
      let newImageUrl = imageUrl;

      const payload = {
        title: form.title,
        description: form.description,
        establishment_id: form.establishment_id || null,
        promo_type: form.promo_type,
        value: form.promo_type === 'offer' ? null : form.value,
        is_permanent: form.is_permanent,
        valid_from: form.is_permanent ? new Date().toISOString() : new Date(form.valid_from).toISOString(),
        valid_until: form.is_permanent ? '2099-12-31T23:59:59' : new Date(form.valid_until).toISOString(),
        is_recurring: false,
        recurrence_rule: '',
        max_uses: null,
        image_url: newImageUrl,
        is_active: form.is_active,
      };

      if (isNew) {
        const { data: created, error } = await supabase.from('promotions').insert({ ...payload, current_uses: 0 }).select('id').single();
        if (error) throw error;

        if (croppedImage && created) {
          setUploadProgress('Upload image...');
          const filename = `${Date.now()}.jpg`;
          const { error: upErr } = await supabase.storage.from('promo-images').upload(`${created.id}/${filename}`, croppedImage, { contentType: 'image/jpeg', upsert: true });
          if (upErr) throw upErr;
          const { data: urlData } = supabase.storage.from('promo-images').getPublicUrl(`${created.id}/${filename}`);
          await supabase.from('promotions').update({ image_url: urlData.publicUrl }).eq('id', created.id);
        }

        toast.success('Promotion creee !');
      } else {
        if (croppedImage) {
          setUploadProgress('Upload image...');
          const filename = `${Date.now()}.jpg`;
          const { error: upErr } = await supabase.storage.from('promo-images').upload(`${promoId}/${filename}`, croppedImage, { contentType: 'image/jpeg', upsert: true });
          if (upErr) throw upErr;
          const { data: urlData } = supabase.storage.from('promo-images').getPublicUrl(`${promoId}/${filename}`);
          newImageUrl = urlData.publicUrl;
        }

        const { error } = await supabase.from('promotions').update({ ...payload, image_url: newImageUrl }).eq('id', promoId);
        if (error) throw error;
        toast.success('Promotion mise a jour !');
      }

      setUploadProgress(null);
      onClose();
      onRefresh();
    } catch (err) {
      setUploadProgress(null);
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
    setSaving(false);
  };

  return (
    <AdminEditSidebar
      open={!!promoId}
      title={isNew ? "Creer une promotion" : "Modifier la promotion"}
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
        aspectRatio={4 / 3}
        label="VISUEL DE LA PROMOTION (format 4:3)"
        hint="Image affichee sur la carte de la promotion dans l'app."
      />

      <SidebarField label="Titre" error={errors.title}>
        <SidebarInput value={form.title} onChange={(v) => set('title', v)} required error={!!errors.title} />
      </SidebarField>

      <SidebarField label="Description">
        <SidebarTextarea value={form.description} onChange={(v) => set('description', v)} />
      </SidebarField>

      <SidebarField label="Etablissement">
        <SidebarSelect
          value={form.establishment_id}
          onChange={(v) => set('establishment_id', v)}
          options={[{ value: '', label: 'Selectionner...' }, ...establishments]}
        />
      </SidebarField>

      <div className="mb-2 mt-6">
        <p className="text-[12px] uppercase tracking-[0.5px] text-[#606070] font-medium">Type de reduction</p>
      </div>

      <SidebarField label="Type">
        <SidebarSelect value={form.promo_type} onChange={(v) => set('promo_type', v)} options={promoTypeOptions} />
      </SidebarField>

      {form.promo_type === 'percentage' && (
        <SidebarField label="Valeur (%)">
          <SidebarInput value={form.value} onChange={(v) => set('value', parseFloat(v) || 0)} type="number" min={1} max={100} />
        </SidebarField>
      )}

      {form.promo_type === 'fixed' && (
        <SidebarField label="Montant (EUR)">
          <SidebarInput value={form.value} onChange={(v) => set('value', parseFloat(v) || 0)} type="number" min={0.01} step={0.01} />
        </SidebarField>
      )}

      {form.promo_type === 'offer' && (
        <SidebarField label="Texte de l'offre">
          <SidebarInput value={form.offer_text} onChange={(v) => set('offer_text', v)} placeholder="Ex: 1 cocktail offert" />
        </SidebarField>
      )}

      <div className="mb-2 mt-6">
        <p className="text-[12px] uppercase tracking-[0.5px] text-[#606070] font-medium">Validite</p>
      </div>

      <SidebarToggle checked={form.is_permanent} onChange={(v) => set('is_permanent', v)} label="Promotion permanente" />

      {!form.is_permanent && (
        <>
          <SidebarField label="Date de debut" error={errors.valid_from}>
            <SidebarInput value={form.valid_from} onChange={(v) => set('valid_from', v)} type="datetime-local" required error={!!errors.valid_from} />
          </SidebarField>

          <SidebarField label="Date de fin" error={errors.valid_until}>
            <SidebarInput value={form.valid_until} onChange={(v) => set('valid_until', v)} type="datetime-local" required error={!!errors.valid_until} />
          </SidebarField>
        </>
      )}

      <div className="mb-2 mt-6">
        <p className="text-[12px] uppercase tracking-[0.5px] text-[#606070] font-medium">Statut</p>
      </div>

      <SidebarToggle
        checked={form.is_active}
        onChange={(v) => set('is_active', v)}
        label="Promotion active"
        description="Desactivez pour masquer temporairement la promotion sans la supprimer."
      />
    </AdminEditSidebar>
  );
}
