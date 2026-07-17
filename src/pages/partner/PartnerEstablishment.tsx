import { useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import toast from 'react-hot-toast';
import { ZoomIn, ZoomOut, X, Check, Camera, Store as StoreIcon, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { geocodeAddress, type GeoFeature } from '../../lib/geocode';
import { useCategories } from '../../contexts/CategoriesContext';
import type { CategoryKey, Establishment, OpeningHours } from '../../lib/types';
import cropImage from '../../lib/cropImage';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EstablishmentGallerySection from './EstablishmentGallerySection';

const DAYS_ORDER = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const DAYS_LABELS: Record<string, string> = {
  lundi: 'Lundi', mardi: 'Mardi', mercredi: 'Mercredi',
  jeudi: 'Jeudi', vendredi: 'Vendredi', samedi: 'Samedi', dimanche: 'Dimanche',
};

interface PartnerContext {
  establishment: Establishment;
  reload: () => void;
}

export default function PartnerEstablishment() {
  const { establishment, reload } = useOutletContext<PartnerContext>();
  const { categories, categoryKeys } = useCategories();

  const [name, setName] = useState(establishment.name);
  const [address, setAddress] = useState(establishment.address);
  const [city, setCity] = useState(establishment.city);
  const [postalCode, setPostalCode] = useState(establishment.postal_code || '');
  const [latitude, setLatitude] = useState(String(establishment.latitude));
  const [longitude, setLongitude] = useState(String(establishment.longitude));
  const [category, setCategory] = useState<CategoryKey>(establishment.category);
  const [subcategory, setSubcategory] = useState(establishment.subcategory);
  const [phone, setPhone] = useState(establishment.phone);
  const [website, setWebsite] = useState(establishment.website);
  const [description, setDescription] = useState(establishment.description);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<GeoFeature[]>([]);

  const initHours = (establishment.opening_hours as OpeningHours) || {};
  const [openingHours, setOpeningHours] = useState<Record<string, { open: string; close: string } | null>>(() => {
    const h: Record<string, { open: string; close: string } | null> = {};
    DAYS_ORDER.forEach((day) => {
      h[day] = initHours[day] ?? null;
    });
    return h;
  });

  const [logoCropSrc, setLogoCropSrc] = useState<string | null>(null);
  const [logoCrop, setLogoCrop] = useState({ x: 0, y: 0 });
  const [logoZoom, setLogoZoom] = useState(1);
  const [logoCroppedArea, setLogoCroppedArea] = useState<Area | null>(null);
  const [croppedLogoBlob, setCroppedLogoBlob] = useState<Blob | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [bannerCropSrc, setBannerCropSrc] = useState<string | null>(null);
  const [bannerCrop, setBannerCrop] = useState({ x: 0, y: 0 });
  const [bannerZoom, setBannerZoom] = useState(1);
  const [bannerCroppedArea, setBannerCroppedArea] = useState<Area | null>(null);
  const [croppedBannerBlob, setCroppedBannerBlob] = useState<Blob | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  const [pendingPhotos, setPendingPhotos] = useState<{ blob: Blob; preview: string }[]>([]);

  const searchAddress = async (query: string) => {
    setAddress(query);
    if (query.length < 3) { setAddressSuggestions([]); return; }
    try {
      setAddressSuggestions(await geocodeAddress(query));
    } catch { /* ignore */ }
  };

  const selectAddress = (feature: GeoFeature) => {
    setAddress(feature.place_name);
    setLongitude(String(feature.center[0]));
    setLatitude(String(feature.center[1]));
    const ctx = feature.context || [];
    const cityCtx = ctx.find((c: { id: string; text: string }) => c.id.startsWith('place'));
    if (cityCtx) setCity(cityCtx.text);
    const pcCtx = ctx.find((c: { id: string; text: string }) => c.id.startsWith('postcode'));
    if (pcCtx) setPostalCode(pcCtx.text);
    setAddressSuggestions([]);
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoCropSrc(URL.createObjectURL(file));
      setLogoCrop({ x: 0, y: 0 });
      setLogoZoom(1);
    }
  };

  const onLogoCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setLogoCroppedArea(croppedPixels);
  }, []);

  const handleLogoConfirm = async () => {
    if (!logoCropSrc || !logoCroppedArea) return;
    try {
      const blob = await cropImage(logoCropSrc, logoCroppedArea, 400, 400);
      setCroppedLogoBlob(blob);
      setLogoPreview(URL.createObjectURL(blob));
      setLogoCropSrc(null);
    } catch {
      toast.error('Erreur lors du recadrage du logo');
    }
  };

  const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBannerCropSrc(URL.createObjectURL(file));
      setBannerCrop({ x: 0, y: 0 });
      setBannerZoom(1);
    }
  };

  const onBannerCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setBannerCroppedArea(croppedPixels);
  }, []);

  const handleBannerConfirm = async () => {
    if (!bannerCropSrc || !bannerCroppedArea) return;
    try {
      const blob = await cropImage(bannerCropSrc, bannerCroppedArea, 1280, 720);
      setCroppedBannerBlob(blob);
      setBannerPreview(URL.createObjectURL(blob));
      setBannerCropSrc(null);
    } catch {
      toast.error('Erreur lors du recadrage de la bannière');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let logoUrl = establishment.logo_url;
      let bannerUrl = establishment.banner_url;

      if (croppedLogoBlob) {
        setUploadProgress('Upload du logo...');
        const path = `${establishment.id}/logo_${Date.now()}.jpg`;
        const { data, error } = await supabase.storage.from('establishment-logos').upload(path, croppedLogoBlob, { contentType: 'image/jpeg', upsert: true });
        if (error) throw error;
        logoUrl = supabase.storage.from('establishment-logos').getPublicUrl(data.path).data.publicUrl;
      }

      if (croppedBannerBlob) {
        setUploadProgress('Upload de la bannière...');
        const path = `${establishment.id}/banner_${Date.now()}.jpg`;
        const { data, error } = await supabase.storage.from('establishment-banners').upload(path, croppedBannerBlob, { contentType: 'image/jpeg', upsert: true });
        if (error) throw error;
        bannerUrl = supabase.storage.from('establishment-banners').getPublicUrl(data.path).data.publicUrl;
      }

      if (pendingPhotos.length > 0) {
        const { data: existingPhotos } = await supabase.from('establishment_photos').select('id').eq('establishment_id', establishment.id);
        const existingCount = existingPhotos?.length || 0;
        for (let i = 0; i < pendingPhotos.length; i++) {
          setUploadProgress(`Upload photo ${i + 1}/${pendingPhotos.length}...`);
          const filename = `${Date.now()}_${i}.jpg`;
          const { data, error } = await supabase.storage.from('establishment-photos').upload(`${establishment.id}/${filename}`, pendingPhotos[i].blob, { contentType: 'image/jpeg' });
          if (error) throw error;
          const photoUrl = supabase.storage.from('establishment-photos').getPublicUrl(data.path).data.publicUrl;
          await supabase.from('establishment_photos').insert({
            establishment_id: establishment.id,
            url: photoUrl,
            order_index: existingCount + i,
          });
        }
      }

      setUploadProgress('Sauvegarde des informations...');
      const { error } = await supabase.from('establishments').update({
        name, address, city, postal_code: postalCode,
        latitude: parseFloat(latitude), longitude: parseFloat(longitude),
        category, subcategory, phone, website, description,
        logo_url: logoUrl, banner_url: bannerUrl,
        opening_hours: openingHours,
      }).eq('id', establishment.id);
      if (error) throw error;

      toast.success('Modifications enregistrées !');
      setCroppedLogoBlob(null);
      setLogoPreview(null);
      setCroppedBannerBlob(null);
      setBannerPreview(null);
      setPendingPhotos([]);
      setUploadProgress('');
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    }
    setSaving(false);
    setUploadProgress('');
  };

  const logoDisplay = logoPreview || establishment.logo_url;
  const bannerDisplay = bannerPreview || establishment.banner_url;

  return (
    <div className="max-w-2xl pb-28 lg:pb-8">
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Mon établissement</h1>
        {establishment.is_pro ? (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(123,45,139,0.15)', color: '#7B2D8B' }}>Pro</span>
        ) : (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">Gratuit</span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-0">
        {/* SECTION 1: Informations générales */}
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">Informations générales</h2>
        <div className="space-y-4 mb-0">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Nom de l'établissement</label>
            <input value={name} onChange={e => setName(e.target.value)} required
              className="input-field bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Catégorie principale</label>
              <select value={category} onChange={e => { setCategory(e.target.value as CategoryKey); setSubcategory(''); }}
                className="input-field bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white">
                {categoryKeys.map(k => <option key={k} value={k}>{categories[k].label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Type d'établissement</label>
              <select value={subcategory} onChange={e => setSubcategory(e.target.value)} required
                disabled={!category}
                className="input-field bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white disabled:opacity-50">
                <option value="">Choisir</option>
                {categories[category].subcategories.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Description de votre établissement</label>
            <textarea value={description}
              onChange={e => { if (e.target.value.length <= 500) setDescription(e.target.value); }}
              placeholder="Présentez votre établissement, son ambiance, ce qui le rend unique et inclusif..."
              className="input-field bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white resize-y"
              style={{ minHeight: 140 }} />
            <p className="text-xs text-gray-600 text-right mt-1">{description.length} / 500</p>
          </div>
        </div>

        {/* SECTION 2: Coordonnées */}
        <div className="mt-8 pt-8" style={{ borderTop: '1px solid var(--pn-border)' }}>
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">Coordonnées</h2>
          <div className="space-y-4">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-300 mb-1">Adresse</label>
              <input value={address} onChange={e => searchAddress(e.target.value)} required
                className="input-field bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white" />
              {addressSuggestions.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-input max-h-48 overflow-y-auto">
                  {addressSuggestions.map((s: GeoFeature) => (
                    <button key={s.place_name} type="button" onClick={() => selectAddress(s)}
                      className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-200 dark:bg-dark-border/50">
                      {s.place_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Ville</label>
                <input value={city} onChange={e => setCity(e.target.value)} required
                  className="input-field bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Code postal</label>
                <input value={postalCode} onChange={e => setPostalCode(e.target.value)} required
                  pattern="[0-9]{5}" placeholder="75001"
                  className="input-field bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Téléphone</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="04 67 58 22 14"
                  className="input-field bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Site web</label>
                <input type="url" value={website} onChange={e => setWebsite(e.target.value)}
                  placeholder="https://monsite.fr"
                  className="input-field bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: Visuels */}
        <div className="mt-8 pt-8" style={{ borderTop: '1px solid var(--pn-border)' }}>
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">Visuels</h2>
          <div className="space-y-6">
            {/* Logo */}
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-0.5">Logo (format carré 1:1)</p>
              <p className="text-[11px] text-gray-600 mb-3">Affiché en vignette dans les listes et sur la carte.</p>
              {logoDisplay ? (
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full overflow-hidden shrink-0 bg-gray-200 dark:bg-dark-border">
                    <img src={logoDisplay} alt="" className="w-full h-full object-cover" />
                  </div>
                  <label className="text-sm px-4 py-2 rounded-[8px] cursor-pointer transition-colors hover:opacity-80"
                    style={{ background: 'transparent', border: '1px solid var(--pn-border2)', color: '#a0a0b0' }}>
                    Changer
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoSelect} className="hidden" />
                  </label>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 rounded-[10px] cursor-pointer transition-colors hover:border-[#3a3a4a]"
                  style={{ border: '2px dashed var(--pn-border2)', height: 120 }}>
                  <StoreIcon size={24} className="text-gray-600" />
                  <span className="text-[13px] text-gray-500">Cliquez pour ajouter votre logo</span>
                  <span className="text-[11px] text-gray-600">JPG, PNG, WEBP - Max 5MB</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoSelect} className="hidden" />
                </label>
              )}
            </div>

            {/* Banner */}
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-0.5">Bannière (format 16:9)</p>
              <p className="text-[11px] text-gray-600 mb-3">Image principale affichée en haut de votre fiche établissement.</p>
              {bannerDisplay ? (
                <div>
                  <img src={bannerDisplay} alt="" className="w-full rounded-[8px] object-cover mb-2" style={{ aspectRatio: '16/9' }} />
                  <label className="text-sm px-4 py-2 rounded-[8px] cursor-pointer transition-colors hover:opacity-80 inline-block"
                    style={{ background: 'transparent', border: '1px solid var(--pn-border2)', color: '#a0a0b0' }}>
                    Changer la bannière
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleBannerSelect} className="hidden" />
                  </label>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 rounded-[10px] cursor-pointer transition-colors hover:border-[#3a3a4a]"
                  style={{ border: '2px dashed var(--pn-border2)', height: 160 }}>
                  <Camera size={24} className="text-gray-600" />
                  <span className="text-[13px] text-gray-500">Cliquez pour ajouter votre photo principale</span>
                  <span className="text-[11px] text-gray-600">JPG, PNG, WEBP - Max 10MB</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleBannerSelect} className="hidden" />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 4: Opening Hours */}
        <div className="mt-8 pt-8" style={{ borderTop: '1px solid var(--pn-border)' }}>
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock size={16} className="text-gray-400" />
            Horaires d'ouverture
          </h2>
          <div className="space-y-3">
            {DAYS_ORDER.map((day) => {
              const isOpen = openingHours[day] !== null;
              return (
                <div key={day} className="flex items-center gap-3">
                  <label className="flex items-center gap-2 w-28 shrink-0">
                    <input
                      type="checkbox"
                      checked={isOpen}
                      onChange={(e) => {
                        setOpeningHours((prev) => ({
                          ...prev,
                          [day]: e.target.checked ? { open: '09:00', close: '18:00' } : null,
                        }));
                      }}
                      className="rounded border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-gray-300">{DAYS_LABELS[day]}</span>
                  </label>
                  {isOpen && (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={openingHours[day]?.open || '09:00'}
                        onChange={(e) => {
                          setOpeningHours((prev) => ({
                            ...prev,
                            [day]: { open: e.target.value, close: prev[day]?.close || '18:00' },
                          }));
                        }}
                        className="input-field bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm w-28"
                      />
                      <span className="text-gray-500 text-sm">-</span>
                      <input
                        type="time"
                        value={openingHours[day]?.close || '18:00'}
                        onChange={(e) => {
                          setOpeningHours((prev) => ({
                            ...prev,
                            [day]: { open: prev[day]?.open || '09:00', close: e.target.value },
                          }));
                        }}
                        className="input-field bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm w-28"
                      />
                    </div>
                  )}
                  {!isOpen && (
                    <span className="text-sm text-gray-600">Ferme</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 5: Gallery — réservée aux établissements Pro (demande Kevin) */}
        <div className="mt-8 pt-8" style={{ borderTop: '1px solid var(--pn-border)' }}>
          {establishment.is_pro ? (
            <EstablishmentGallerySection
              establishmentId={establishment.id}
              pendingPhotos={pendingPhotos}
              onPendingChange={setPendingPhotos}
            />
          ) : (
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <Camera size={17} style={{ color: '#7B2D8B' }} /> Galerie photo
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(123,45,139,0.15)', color: '#7B2D8B' }}>Pro</span>
              </h2>
              <div className="rounded-card p-5 text-center space-y-2" style={{ background: 'rgba(123,45,139,0.06)', border: '1px solid rgba(123,45,139,0.25)' }}>
                <p className="text-sm text-gray-700 dark:text-gray-300">La galerie photo est réservée aux établissements <strong>Pro</strong>.</p>
                <p className="text-xs text-gray-500">Passez Pro pour présenter vos photos sur votre fiche et attirer plus de visiteurs.</p>
                <a href="/pros/abonnement" className="inline-block text-xs font-semibold px-4 py-2 rounded-input" style={{ background: '#7B2D8B', color: '#fff' }}>Passer Pro</a>
              </div>
            </div>
          )}
        </div>

        {/* Desktop submit button */}
        <div className="hidden lg:block mt-8">
          <button type="submit" disabled={saving}
            className="w-60 py-3 rounded-[8px] text-sm font-semibold text-gray-900 dark:text-white transition-colors hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: '#7B2D8B' }}>
            {saving ? <><LoadingSpinner size={16} /> {uploadProgress || 'Sauvegarde...'}</> : 'Enregistrer les modifications'}
          </button>
        </div>
      </form>

      {/* Mobile sticky submit */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-4 py-4" style={{ background: 'var(--pn-bg2)', borderTop: '1px solid var(--pn-border)' }}>
        <button type="button" onClick={() => {
          const form = document.querySelector('form');
          if (form) form.requestSubmit();
        }} disabled={saving}
          className="w-full py-3 rounded-[8px] text-sm font-semibold text-gray-900 dark:text-white transition-colors hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: '#7B2D8B' }}>
          {saving ? <><LoadingSpinner size={16} /> {uploadProgress || 'Sauvegarde...'}</> : 'Enregistrer les modifications'}
        </button>
      </div>

      {logoCropSrc && (
        <CropModal src={logoCropSrc} crop={logoCrop} zoom={logoZoom} aspect={1} cropShape="round"
          onCropChange={setLogoCrop} onZoomChange={setLogoZoom} onCropComplete={onLogoCropComplete}
          onConfirm={handleLogoConfirm} onCancel={() => setLogoCropSrc(null)} />
      )}

      {bannerCropSrc && (
        <CropModal src={bannerCropSrc} crop={bannerCrop} zoom={bannerZoom} aspect={16 / 9} cropShape="rect"
          onCropChange={setBannerCrop} onZoomChange={setBannerZoom} onCropComplete={onBannerCropComplete}
          onConfirm={handleBannerConfirm} onCancel={() => setBannerCropSrc(null)} />
      )}
    </div>
  );
}

interface CropModalProps {
  src: string;
  crop: { x: number; y: number };
  zoom: number;
  aspect: number;
  cropShape: 'round' | 'rect';
  onCropChange: (c: { x: number; y: number }) => void;
  onZoomChange: (z: number) => void;
  onCropComplete: (area: Area, pixels: Area) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function CropModal({ src, crop, zoom, aspect, cropShape, onCropChange, onZoomChange, onCropComplete, onConfirm, onCancel }: CropModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card w-full max-w-md overflow-hidden">
        <div className="relative w-full aspect-square bg-black">
          <Cropper image={src} crop={crop} zoom={zoom} aspect={aspect} cropShape={cropShape}
            showGrid={false} onCropChange={onCropChange} onZoomChange={onZoomChange} onCropComplete={onCropComplete} />
        </div>
        <div className="px-5 py-3 flex items-center gap-3">
          <ZoomOut size={16} className="text-gray-400 shrink-0" />
          <input type="range" min={1} max={3} step={0.05} value={zoom}
            onChange={e => onZoomChange(Number(e.target.value))} className="flex-1 accent-primary h-1" />
          <ZoomIn size={16} className="text-gray-400 shrink-0" />
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-light-border dark:border-dark-border">
          <button type="button" onClick={onCancel}
            className="flex-1 btn-ghost py-2.5 text-sm flex items-center justify-center gap-2">
            <X size={16} /> Annuler
          </button>
          <button type="button" onClick={onConfirm}
            className="flex-1 btn-primary py-2.5 text-sm flex items-center justify-center gap-2">
            <Check size={16} /> Valider
          </button>
        </div>
      </div>
    </div>
  );
}
