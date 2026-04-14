import { useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import toast from 'react-hot-toast';
import { Lock, ZoomIn, ZoomOut, X, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CATEGORIES, CATEGORY_KEYS } from '../../lib/constants';
import type { CategoryKey, Establishment } from '../../lib/types';
import cropImage from '../../lib/cropImage';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

interface PartnerContext {
  establishment: Establishment;
  reload: () => void;
}

export default function PartnerEstablishment() {
  const { establishment, reload } = useOutletContext<PartnerContext>();

  const [name, setName] = useState(establishment.name);
  const [address, setAddress] = useState(establishment.address);
  const [city, setCity] = useState(establishment.city);
  const [latitude, setLatitude] = useState(String(establishment.latitude));
  const [longitude, setLongitude] = useState(String(establishment.longitude));
  const [category, setCategory] = useState<CategoryKey>(establishment.category);
  const [subcategory, setSubcategory] = useState(establishment.subcategory);
  const [phone, setPhone] = useState(establishment.phone);
  const [website, setWebsite] = useState(establishment.website);
  const [description, setDescription] = useState(establishment.description);
  const [saving, setSaving] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);

  const [logoCropSrc, setLogoCropSrc] = useState<string | null>(null);
  const [logoCrop, setLogoCrop] = useState({ x: 0, y: 0 });
  const [logoZoom, setLogoZoom] = useState(1);
  const [logoCroppedArea, setLogoCroppedArea] = useState<Area | null>(null);
  const [logoProcessing, setLogoProcessing] = useState(false);

  const [bannerCropSrc, setBannerCropSrc] = useState<string | null>(null);
  const [bannerCrop, setBannerCrop] = useState({ x: 0, y: 0 });
  const [bannerZoom, setBannerZoom] = useState(1);
  const [bannerCroppedArea, setBannerCroppedArea] = useState<Area | null>(null);
  const [bannerProcessing, setBannerProcessing] = useState(false);

  const searchAddress = async (query: string) => {
    setAddress(query);
    if (query.length < 3) { setAddressSuggestions([]); return; }
    try {
      const token = import.meta.env.VITE_MAPBOX_TOKEN;
      if (!token) return;
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&country=FR&language=fr&limit=5`);
      const data = await res.json();
      setAddressSuggestions(data.features || []);
    } catch { /* handled */ }
  };

  const selectAddress = (feature: any) => {
    setAddress(feature.place_name);
    setLongitude(String(feature.center[0]));
    setLatitude(String(feature.center[1]));
    const ctx = feature.context || [];
    const cityCtx = ctx.find((c: any) => c.id.startsWith('place'));
    if (cityCtx) setCity(cityCtx.text);
    setAddressSuggestions([]);
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setLogoCropSrc(URL.createObjectURL(file));
  };

  const onLogoCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setLogoCroppedArea(croppedPixels);
  }, []);

  const handleLogoConfirm = async () => {
    if (!logoCropSrc || !logoCroppedArea) return;
    setLogoProcessing(true);
    try {
      const blob = await cropImage(logoCropSrc, logoCroppedArea);
      const path = `${establishment.id}/logo_${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('establishment-logos').upload(path, blob);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('establishment-logos').getPublicUrl(path);
      await supabase.from('establishments').update({ logo_url: urlData.publicUrl }).eq('id', establishment.id);
      toast.success('Logo mis a jour');
      setLogoCropSrc(null);
      reload();
    } catch (err: any) {
      toast.error(err.message || 'Erreur upload logo');
    }
    setLogoProcessing(false);
  };

  const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setBannerCropSrc(URL.createObjectURL(file));
  };

  const onBannerCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setBannerCroppedArea(croppedPixels);
  }, []);

  const handleBannerConfirm = async () => {
    if (!bannerCropSrc || !bannerCroppedArea) return;
    setBannerProcessing(true);
    try {
      const blob = await cropImage(bannerCropSrc, bannerCroppedArea);
      const path = `${establishment.id}/banner_${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('establishment-banners').upload(path, blob);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('establishment-banners').getPublicUrl(path);
      await supabase.from('establishments').update({ banner_url: urlData.publicUrl }).eq('id', establishment.id);
      toast.success('Banniere mise a jour');
      setBannerCropSrc(null);
      reload();
    } catch (err: any) {
      toast.error(err.message || 'Erreur upload banniere');
    }
    setBannerProcessing(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from('establishments').update({
        name, address, city,
        latitude: parseFloat(latitude), longitude: parseFloat(longitude),
        category, subcategory, phone, website, description,
      }).eq('id', establishment.id);
      if (error) throw error;
      toast.success('Modifications enregistrees !');
      reload();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-xl font-bold text-white">Mon etablissement</h1>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Nom</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required className="input-field bg-dark-bg border-dark-border text-white" />
        </div>
        <div className="relative">
          <label className="block text-sm font-medium text-gray-300 mb-1">Adresse</label>
          <input value={address} onChange={(e) => searchAddress(e.target.value)} required className="input-field bg-dark-bg border-dark-border text-white" />
          {addressSuggestions.length > 0 && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-dark-surface border border-dark-border rounded-input max-h-48 overflow-y-auto">
              {addressSuggestions.map((s: any) => (
                <button key={s.id} type="button" onClick={() => selectAddress(s)} className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-dark-border/50">
                  {s.place_name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Categorie</label>
            <select value={category} onChange={(e) => { setCategory(e.target.value as CategoryKey); setSubcategory(''); }} className="input-field bg-dark-bg border-dark-border text-white">
              {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORIES[k].label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Sous-categorie</label>
            <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} required className="input-field bg-dark-bg border-dark-border text-white">
              <option value="">Choisir</option>
              {CATEGORIES[category].subcategories.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Telephone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field bg-dark-bg border-dark-border text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Site web</label>
            <input value={website} onChange={(e) => setWebsite(e.target.value)} className="input-field bg-dark-bg border-dark-border text-white" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Description ({description.length}/500)</label>
          <textarea value={description} onChange={(e) => { if (e.target.value.length <= 500) setDescription(e.target.value); }} rows={4} className="input-field bg-dark-bg border-dark-border text-white resize-none" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Logo</label>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-dark-border overflow-hidden flex items-center justify-center shrink-0">
              {establishment.logo_url ? <img src={establishment.logo_url} alt="" className="w-full h-full object-cover" /> : <span className="text-gray-600 text-lg">{establishment.name.charAt(0)}</span>}
            </div>
            <label className="btn-ghost text-sm py-2 px-4 cursor-pointer">
              Changer
              <input type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
            </label>
          </div>
        </div>

        <div className={!establishment.is_pro ? 'opacity-50 pointer-events-none relative' : ''}>
          {!establishment.is_pro && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <Lock size={20} className="text-gray-500" />
            </div>
          )}
          <label className="block text-sm font-medium text-gray-300 mb-2">Banniere {!establishment.is_pro && '(Pro)'}</label>
          {establishment.banner_url && (
            <img src={establishment.banner_url} alt="" className="w-full h-32 object-cover rounded-card mb-2" />
          )}
          <label className="btn-ghost text-sm py-2 px-4 cursor-pointer inline-block">
            Changer la banniere
            <input type="file" accept="image/*" onChange={handleBannerSelect} className="hidden" />
          </label>
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
          {saving && <LoadingSpinner size={16} />} Enregistrer les modifications
        </button>
      </form>

      {logoCropSrc && (
        <CropModal
          src={logoCropSrc}
          crop={logoCrop}
          zoom={logoZoom}
          aspect={1}
          cropShape="round"
          onCropChange={setLogoCrop}
          onZoomChange={setLogoZoom}
          onCropComplete={onLogoCropComplete}
          onConfirm={handleLogoConfirm}
          onCancel={() => setLogoCropSrc(null)}
          processing={logoProcessing}
        />
      )}

      {bannerCropSrc && (
        <CropModal
          src={bannerCropSrc}
          crop={bannerCrop}
          zoom={bannerZoom}
          aspect={16 / 9}
          cropShape="rect"
          onCropChange={setBannerCrop}
          onZoomChange={setBannerZoom}
          onCropComplete={onBannerCropComplete}
          onConfirm={handleBannerConfirm}
          onCancel={() => setBannerCropSrc(null)}
          processing={bannerProcessing}
        />
      )}
    </div>
  );
}

function CropModal({ src, crop, zoom, aspect, cropShape, onCropChange, onZoomChange, onCropComplete, onConfirm, onCancel, processing }: any) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-dark-surface border border-dark-border rounded-card w-full max-w-md overflow-hidden">
        <div className="relative w-full aspect-square bg-black">
          <Cropper image={src} crop={crop} zoom={zoom} aspect={aspect} cropShape={cropShape} showGrid={false} onCropChange={onCropChange} onZoomChange={onZoomChange} onCropComplete={onCropComplete} />
        </div>
        <div className="px-5 py-3 flex items-center gap-3">
          <ZoomOut size={16} className="text-gray-400 shrink-0" />
          <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => onZoomChange(Number(e.target.value))} className="flex-1 accent-primary h-1" />
          <ZoomIn size={16} className="text-gray-400 shrink-0" />
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-dark-border">
          <button onClick={onCancel} disabled={processing} className="flex-1 btn-ghost py-2.5 text-sm flex items-center justify-center gap-2"><X size={16} /> Annuler</button>
          <button onClick={onConfirm} disabled={processing} className="flex-1 btn-primary py-2.5 text-sm flex items-center justify-center gap-2">
            {processing ? <LoadingSpinner size={16} /> : <Check size={16} />} Valider
          </button>
        </div>
      </div>
    </div>
  );
}
