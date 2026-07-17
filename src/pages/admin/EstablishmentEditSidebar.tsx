import { useEffect, useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { Camera, Trash2, X, Loader2, Gift } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { geocodeFirst } from '../../lib/geocode';
import { useCategories } from '../../contexts/CategoriesContext';
import type { CategoryKey, OpeningHours } from '../../lib/types';
import AdminEditSidebar, {
  SidebarField,
  SidebarInput,
  SidebarTextarea,
  SidebarSelect,
} from '../../components/admin/AdminEditSidebar';
import ImageUploadWithCrop from '../../components/admin/ImageUploadWithCrop';
import ConfirmModal from '../../components/admin/ConfirmModal';
import GiftPeriodModal from '../../components/admin/GiftPeriodModal';

const DAYS_ORDER = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const DAYS_LABELS: Record<string, string> = {
  lundi: 'Lundi', mardi: 'Mardi', mercredi: 'Mercredi',
  jeudi: 'Jeudi', vendredi: 'Vendredi', samedi: 'Samedi', dimanche: 'Dimanche',
};

interface Props {
  establishmentId: string | null;
  onClose: () => void;
  onRefresh: () => void;
}

interface FormData {
  name: string;
  description: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  postal_code: string;
  category: string;
  subcategory: string;
}

interface GalleryPhoto {
  id: string;
  url: string;
  order_index: number;
}

const initialForm: FormData = {
  name: '',
  description: '',
  phone: '',
  website: '',
  address: '',
  city: '',
  postal_code: '',
  category: 'manger',
  subcategory: '',
};

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await createImageBitmap(await fetch(imageSrc).then((r) => r.blob()));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(pixelCrop.width);
  canvas.height = Math.round(pixelCrop.height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, -pixelCrop.x, -pixelCrop.y);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.9);
  });
}

export default function EstablishmentEditSidebar({ establishmentId, onClose, onRefresh }: Props) {
  const isNew = establishmentId === 'new';
  const { categories, categoryKeys } = useCategories();
  const categoryOptions = categoryKeys.map((k) => ({ value: k, label: categories[k as CategoryKey].label }));
  const [form, setForm] = useState<FormData>(initialForm);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [croppedBanner, setCroppedBanner] = useState<Blob | null>(null);
  const [croppedLogo, setCroppedLogo] = useState<Blob | null>(null);
  const [openingHours, setOpeningHours] = useState<Record<string, { open: string; close: string } | null>>(() => {
    const h: Record<string, { open: string; close: string } | null> = {};
    DAYS_ORDER.forEach((day) => { h[day] = null; });
    return h;
  });

  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<{ blob: Blob; preview: string }[]>([]);
  const [galleryCropQueue, setGalleryCropQueue] = useState<string[]>([]);
  const [galleryCropSrc, setGalleryCropSrc] = useState<string | null>(null);
  const [galleryCrop, setGalleryCrop] = useState({ x: 0, y: 0 });
  const [galleryZoom, setGalleryZoom] = useState(1);
  const [galleryCroppedArea, setGalleryCroppedArea] = useState<Area | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [deletePhotoId, setDeletePhotoId] = useState<string | null>(null);
  const [deletePhotoUrl, setDeletePhotoUrl] = useState<string | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [proExpiresAt, setProExpiresAt] = useState<string | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const totalPhotos = galleryPhotos.length + pendingPhotos.length;

  const loadData = useCallback(async () => {
    if (!establishmentId) return;
    setLoading(true);
    setErrors({});
    setCroppedBanner(null);
    setCroppedLogo(null);
    setPendingPhotos([]);
    setGalleryCropQueue([]);
    setGalleryCropSrc(null);

    if (isNew) {
      setForm(initialForm);
      setBannerUrl(null);
      setLogoUrl(null);
      setIsPro(false);
      setProExpiresAt(null);
      setGalleryPhotos([]);
      setLoading(false);
      return;
    }

    try {
      const [estRes, photosRes] = await Promise.all([
        supabase.from('establishments').select('*').eq('id', establishmentId).single(),
        supabase.from('establishment_photos').select('*').eq('establishment_id', establishmentId).order('order_index', { ascending: true }),
      ]);
      if (estRes.error) throw estRes.error;
      const d = estRes.data;
      setForm({
        name: d.name || '',
        description: d.description || '',
        phone: d.phone || '',
        website: d.website || '',
        address: d.address || '',
        city: d.city || '',
        postal_code: d.postal_code || '',
        category: d.category || 'manger',
        subcategory: d.subcategory || '',
      });
      setBannerUrl(d.banner_url || null);
      setLogoUrl(d.logo_url || null);
      setIsPro(d.is_pro ?? false);
      setProExpiresAt(d.pro_expires_at ?? null);
      const loadedHours = (d.opening_hours as OpeningHours) || {};
      const h: Record<string, { open: string; close: string } | null> = {};
      DAYS_ORDER.forEach((day) => { h[day] = loadedHours[day] ?? null; });
      setOpeningHours(h);
      setGalleryPhotos((photosRes.data || []).map((p) => ({ id: p.id, url: p.url, order_index: p.order_index })));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du chargement');
    }
    setLoading(false);
  }, [establishmentId]);

  useEffect(() => {
    if (establishmentId) loadData();
  }, [establishmentId, loadData]);

  const set = (key: keyof FormData, val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.name.trim()) e.name = 'Le nom est requis';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleGalleryFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const remaining = 20 - totalPhotos;
    if (remaining <= 0) {
      toast('Limite de 20 photos atteinte.', { icon: '!', style: { background: '#7f5539', color: '#fff' } });
      e.target.value = '';
      return;
    }
    const batch = Array.from(files).slice(0, Math.min(files.length, remaining, 10));
    const srcs: string[] = [];
    let loaded = 0;
    batch.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        srcs.push(reader.result as string);
        loaded++;
        if (loaded === batch.length) {
          setGalleryCropQueue(srcs.slice(1));
          setGalleryCropSrc(srcs[0]);
          setGalleryCrop({ x: 0, y: 0 });
          setGalleryZoom(1);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const onGalleryCropComplete = useCallback((_: Area, pixels: Area) => {
    setGalleryCroppedArea(pixels);
  }, []);

  const handleGalleryCropValidate = async () => {
    if (!galleryCropSrc || !galleryCroppedArea) return;
    try {
      const blob = await getCroppedImg(galleryCropSrc, galleryCroppedArea);
      const url = URL.createObjectURL(blob);
      setPendingPhotos((prev) => [...prev, { blob, preview: url }]);
    } catch {
      // ignore
    }
    if (galleryCropQueue.length > 0) {
      const [next, ...rest] = galleryCropQueue;
      setGalleryCropSrc(next);
      setGalleryCropQueue(rest);
      setGalleryCrop({ x: 0, y: 0 });
      setGalleryZoom(1);
    } else {
      setGalleryCropSrc(null);
    }
  };

  const removePending = (index: number) => {
    setPendingPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const confirmDeletePhoto = async () => {
    if (!deletePhotoId || !deletePhotoUrl || !establishmentId) return;
    setDeletingPhoto(true);
    try {
      const parts = deletePhotoUrl.split('/');
      const filename = parts[parts.length - 1];
      await supabase.storage.from('establishment-photos').remove([`${establishmentId}/${filename}`]);
      const { error } = await supabase.from('establishment_photos').delete().eq('id', deletePhotoId);
      if (error) throw error;
      setGalleryPhotos((prev) => prev.filter((p) => p.id !== deletePhotoId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
    setDeletingPhoto(false);
    setDeletePhotoId(null);
    setDeletePhotoUrl(null);
  };

  const handleSave = async () => {
    if (!validate() || !establishmentId) return;
    setSaving(true);
    try {
      let targetId = establishmentId;

      // Coordonnées GPS depuis l'adresse (colonnes latitude/longitude NOT NULL en base).
      let coords: [number, number] | null = null;
      const geoQuery = `${form.address} ${form.postal_code} ${form.city}`.trim();
      if (geoQuery) coords = await geocodeFirst(geoQuery);

      if (isNew) {
        const { data: created, error } = await supabase.from('establishments').insert({
          name: form.name,
          description: form.description,
          phone: form.phone,
          website: form.website,
          address: form.address,
          city: form.city,
          postal_code: form.postal_code,
          category: form.category,
          subcategory: form.subcategory,
          latitude: coords ? coords[1] : 0,
          longitude: coords ? coords[0] : 0,
          opening_hours: openingHours,
        }).select('id').single();
        if (error) throw error;
        targetId = created.id;
      }

      let newBannerUrl = bannerUrl;
      let newLogoUrl = logoUrl;

      if (croppedBanner) {
        setUploadProgress('Upload banniere...');
        const filename = `${Date.now()}.jpg`;
        const { error } = await supabase.storage.from('establishment-banners').upload(`${targetId}/${filename}`, croppedBanner, { contentType: 'image/jpeg', upsert: true });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('establishment-banners').getPublicUrl(`${targetId}/${filename}`);
        newBannerUrl = urlData.publicUrl;
      }

      if (croppedLogo) {
        setUploadProgress('Upload logo...');
        const filename = `${Date.now()}.jpg`;
        const { error } = await supabase.storage.from('establishment-logos').upload(`${targetId}/${filename}`, croppedLogo, { contentType: 'image/jpeg', upsert: true });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('establishment-logos').getPublicUrl(`${targetId}/${filename}`);
        newLogoUrl = urlData.publicUrl;
      }

      if (pendingPhotos.length > 0) {
        for (let i = 0; i < pendingPhotos.length; i++) {
          setUploadProgress(`Upload galerie... (${i + 1}/${pendingPhotos.length})`);
          const filename = `${Date.now()}_${i}.jpg`;
          const { error: upErr } = await supabase.storage.from('establishment-photos').upload(`${targetId}/${filename}`, pendingPhotos[i].blob, { contentType: 'image/jpeg', upsert: false });
          if (upErr) throw upErr;
          const { data: urlData } = supabase.storage.from('establishment-photos').getPublicUrl(`${targetId}/${filename}`);
          const nextIndex = galleryPhotos.length + i;
          const { error: insErr } = await supabase.from('establishment_photos').insert({ establishment_id: targetId, url: urlData.publicUrl, order_index: nextIndex });
          if (insErr) throw insErr;
        }
      }

      setUploadProgress(null);

      if (!isNew) {
        const { error } = await supabase
          .from('establishments')
          .update({
            name: form.name,
            description: form.description,
            phone: form.phone,
            website: form.website,
            address: form.address,
            city: form.city,
            postal_code: form.postal_code,
            category: form.category,
            subcategory: form.subcategory,
            banner_url: newBannerUrl,
            logo_url: newLogoUrl,
            opening_hours: openingHours,
            ...(coords ? { latitude: coords[1], longitude: coords[0] } : {}),
          })
          .eq('id', targetId);
        if (error) throw error;
      } else if (newBannerUrl || newLogoUrl) {
        await supabase.from('establishments').update({ banner_url: newBannerUrl, logo_url: newLogoUrl }).eq('id', targetId);
      }

      toast.success(isNew ? 'Etablissement cree !' : 'Etablissement mis a jour !');
      onClose();
      onRefresh();
    } catch (err) {
      setUploadProgress(null);
      toast.error((err instanceof Error ? err.message : 'Erreur') || "Erreur lors de l'upload de l'image.");
    }
    setSaving(false);
  };

  return (
    <>
      <AdminEditSidebar
        open={!!establishmentId}
        title={isNew ? "Creer un etablissement" : "Modifier l'etablissement"}
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
          currentImageUrl={bannerUrl}
          onImageCropped={(blob) => setCroppedBanner(blob)}
          aspectRatio={16 / 9}
          label="BANNIERE (format 16:9)"
          hint="Cette image apparait en haut de la fiche etablissement."
        />

        <ImageUploadWithCrop
          currentImageUrl={logoUrl}
          onImageCropped={(blob) => setCroppedLogo(blob)}
          aspectRatio={1}
          label="LOGO (format carre 1:1)"
          hint="Affiche en vignette dans les listes et sur la carte."
        />

        <div className="mb-2 mt-6">
          <p className="text-[12px] uppercase tracking-[0.5px] text-[#606070] font-medium">Informations generales</p>
        </div>

        <SidebarField label="Nom" error={errors.name}>
          <SidebarInput value={form.name} onChange={(v) => set('name', v)} required error={!!errors.name} />
        </SidebarField>

        <SidebarField label="Description">
          <div className="relative">
            <SidebarTextarea value={form.description} onChange={(v) => { if (v.length <= 500) set('description', v); }} />
            <span className="absolute bottom-2 right-3 text-[11px] text-[#606070]">{form.description.length}/500</span>
          </div>
        </SidebarField>

        <SidebarField label="Telephone">
          <SidebarInput value={form.phone} onChange={(v) => set('phone', v)} type="tel" />
        </SidebarField>

        <SidebarField label="Site web">
          <SidebarInput value={form.website} onChange={(v) => set('website', v)} type="url" placeholder="https://..." />
        </SidebarField>

        <div className="mb-2 mt-6">
          <p className="text-[12px] uppercase tracking-[0.5px] text-[#606070] font-medium">Localisation</p>
        </div>

        <SidebarField label="Adresse">
          <SidebarInput value={form.address} onChange={(v) => set('address', v)} />
        </SidebarField>

        <SidebarField label="Ville">
          <SidebarInput value={form.city} onChange={(v) => set('city', v)} />
        </SidebarField>

        <SidebarField label="Code postal">
          <SidebarInput value={form.postal_code} onChange={(v) => set('postal_code', v)} />
        </SidebarField>

        <p className="text-[11px] text-[#606070] italic mb-5">Les coordonnees GPS seront recalculees automatiquement.</p>

        <div className="mb-2 mt-6">
          <p className="text-[12px] uppercase tracking-[0.5px] text-[#606070] font-medium">Categorisation</p>
        </div>

        <SidebarField label="Categorie">
          <SidebarSelect value={form.category} onChange={(v) => set('category', v)} options={categoryOptions} />
        </SidebarField>

        <SidebarField label="Sous-categorie">
          <SidebarInput value={form.subcategory} onChange={(v) => set('subcategory', v)} />
        </SidebarField>

        <div className="mb-2 mt-6">
          <p className="text-[12px] uppercase tracking-[0.5px] text-[#606070] font-medium">Galerie photos</p>
          <p className="text-[11px] text-[#606070] mt-1">Photos supplementaires affichees sur la fiche. Maximum 20 photos.</p>
        </div>

        {galleryPhotos.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {galleryPhotos.map((photo) => (
              <div key={photo.id} className="relative group">
                <img src={photo.url} alt="" className="w-full rounded-md object-cover" style={{ aspectRatio: '4/3' }} />
                <div
                  onClick={() => { setDeletePhotoId(photo.id); setDeletePhotoUrl(photo.url); }}
                  className="absolute inset-0 rounded-md bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                >
                  <Trash2 size={18} className="text-white" />
                </div>
              </div>
            ))}
          </div>
        )}

        {pendingPhotos.length > 0 && (
          <div className="mb-3">
            <p className="text-[11px] text-[#a0a0b0] mb-2">En attente d'upload :</p>
            <div className="grid grid-cols-3 gap-2">
              {pendingPhotos.map((p, i) => (
                <div key={i} className="relative">
                  <img src={p.preview} alt="" className="w-full rounded-md object-cover" style={{ aspectRatio: '4/3' }} />
                  <button
                    type="button"
                    onClick={() => removePending(i)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center"
                  >
                    <X size={12} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {totalPhotos < 20 ? (
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-2 rounded-lg transition-colors hover:border-[#3a3a4a] mb-5"
            style={{ border: '2px dashed #2a2a3a', padding: 20 }}
          >
            <Camera size={22} className="text-[#606070]" />
            <span className="text-[13px] text-[#606070]">Ajouter des photos (max 10 a la fois)</span>
          </button>
        ) : (
          <p className="text-[12px] text-[#c0392b] mb-5">Limite de 20 photos atteinte.</p>
        )}

        <input
          ref={galleryInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={handleGalleryFiles}
        />

        <div className="mb-2 mt-6">
          <p className="text-[12px] uppercase tracking-[0.5px] text-[#606070] font-medium">Horaires d'ouverture</p>
        </div>

        <div className="space-y-2.5 mb-5">
          {DAYS_ORDER.map((day) => {
            const isOpen = openingHours[day] !== null;
            return (
              <div key={day} className="flex items-center gap-2">
                <label className="flex items-center gap-2 w-24 shrink-0">
                  <input
                    type="checkbox"
                    checked={isOpen}
                    onChange={(e) => {
                      setOpeningHours((prev) => ({
                        ...prev,
                        [day]: e.target.checked ? { open: '09:00', close: '18:00' } : null,
                      }));
                    }}
                    className="rounded border-[#2a2a3a] bg-[#0a0a0f] text-[#7B2D8B] focus:ring-[#7B2D8B]"
                  />
                  <span className="text-[13px] text-[#a0a0b0]">{DAYS_LABELS[day]}</span>
                </label>
                {isOpen && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="time"
                      value={openingHours[day]?.open || '09:00'}
                      onChange={(e) => {
                        setOpeningHours((prev) => ({
                          ...prev,
                          [day]: { open: e.target.value, close: prev[day]?.close || '18:00' },
                        }));
                      }}
                      className="px-2 py-1 rounded text-[12px] bg-[#0a0a0f] border border-[#2a2a3a] text-white w-[90px]"
                    />
                    <span className="text-[#606070] text-[11px]">-</span>
                    <input
                      type="time"
                      value={openingHours[day]?.close || '18:00'}
                      onChange={(e) => {
                        setOpeningHours((prev) => ({
                          ...prev,
                          [day]: { open: prev[day]?.open || '09:00', close: e.target.value },
                        }));
                      }}
                      className="px-2 py-1 rounded text-[12px] bg-[#0a0a0f] border border-[#2a2a3a] text-white w-[90px]"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mb-2 mt-6">
          <p className="text-[12px] uppercase tracking-[0.5px] text-[#606070] font-medium">Cadeau Pro</p>
        </div>

        <button
          type="button"
          onClick={() => setGiftOpen(true)}
          className="w-full py-3 rounded-lg text-[14px] font-semibold transition-colors hover:opacity-90 flex items-center justify-center gap-2 mb-4"
          style={{ background: '#7B2D8B', color: '#fff' }}
        >
          <Gift size={16} />
          Offrir une periode Pro
        </button>
      </AdminEditSidebar>

      {galleryCropSrc && (
        <div className="fixed inset-0 z-[2000] flex flex-col" style={{ background: '#0a0a0f' }}>
          <div className="shrink-0 flex items-center justify-between px-5 py-4" style={{ background: '#14141e', borderBottom: '1px solid #1e1e2e' }}>
            <span className="text-[15px] font-semibold text-white">Recadrer l'image</span>
            <button onClick={() => { setGalleryCropSrc(null); setGalleryCropQueue([]); }} className="text-[#606070] hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 relative" style={{ minHeight: 300, background: '#000' }}>
            <Cropper
              image={galleryCropSrc}
              crop={galleryCrop}
              zoom={galleryZoom}
              minZoom={0.4}
              aspect={4 / 3}
              restrictPosition={false}
              onCropChange={setGalleryCrop}
              onZoomChange={setGalleryZoom}
              onCropComplete={onGalleryCropComplete}
              cropShape="rect"
              showGrid={false}
            />
          </div>
          <div className="shrink-0 px-5 py-4 space-y-4" style={{ background: '#14141e', borderTop: '1px solid #1e1e2e' }}>
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-[#a0a0b0] shrink-0">Zoom</span>
              <input type="range" min={0.4} max={3} step={0.01} value={galleryZoom} onChange={(e) => setGalleryZoom(Number(e.target.value))} className="flex-1" style={{ accentColor: '#7B2D8B' }} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setGalleryCropSrc(null); setGalleryCropQueue([]); }} className="flex-1 py-2.5 rounded-lg text-[14px] transition-colors hover:opacity-90" style={{ background: 'transparent', border: '1px solid #2a2a3a', color: '#a0a0b0' }}>
                Annuler
              </button>
              <button onClick={handleGalleryCropValidate} className="flex-[2] py-2.5 rounded-lg text-[14px] font-semibold text-white transition-colors hover:opacity-90" style={{ background: '#7B2D8B' }}>
                Valider le crop {galleryCropQueue.length > 0 && `(${galleryCropQueue.length} restant${galleryCropQueue.length > 1 ? 's' : ''})`}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deletePhotoId}
        title="Supprimer cette photo ?"
        message="Cette photo sera definitivement supprimee de la galerie."
        confirmLabel="Supprimer"
        onCancel={() => { setDeletePhotoId(null); setDeletePhotoUrl(null); }}
        onConfirm={confirmDeletePhoto}
        loading={deletingPhoto}
      />

      {establishmentId && (
        <GiftPeriodModal
          open={giftOpen}
          onClose={() => setGiftOpen(false)}
          onSuccess={() => { loadData(); onRefresh(); }}
          recipientId={establishmentId}
          recipientName={form.name || 'cet etablissement'}
          recipientType="establishment"
          giftType="pro"
          currentlyActive={isPro}
          currentExpiry={proExpiresAt}
        />
      )}
    </>
  );
}
