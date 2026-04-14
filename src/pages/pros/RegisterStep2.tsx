import { useState } from 'react';
import type { CategoryKey } from '../../lib/types';
import { CATEGORIES, CATEGORY_KEYS } from '../../lib/constants';

export interface Step2Data {
  name: string;
  category: CategoryKey | '';
  subcategory: string;
  address: string;
  city: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  website: string;
  description: string;
}

interface RegisterStep2Props {
  data: Step2Data;
  onChange: (data: Step2Data) => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function RegisterStep2({ data, onChange, onNext, onPrev }: RegisterStep2Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const set = <K extends keyof Step2Data>(field: K, value: Step2Data[K]) => {
    onChange({ ...data, [field]: value });
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const searchAddress = async (query: string) => {
    set('address', query);
    if (query.length < 3) { setSuggestions([]); return; }
    try {
      const token = import.meta.env.VITE_MAPBOX_TOKEN;
      if (!token) return;
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&country=FR&language=fr&limit=5`
      );
      const json = await res.json();
      setSuggestions(json.features || []);
    } catch { /* skip */ }
  };

  const selectAddress = (feature: any) => {
    const ctx = feature.context || [];
    const cityCtx = ctx.find((c: any) => c.id.startsWith('place'));
    const postCtx = ctx.find((c: any) => c.id.startsWith('postcode'));
    onChange({
      ...data,
      address: feature.place_name,
      longitude: feature.center[0],
      latitude: feature.center[1],
      city: cityCtx?.text || data.city,
      postal_code: postCtx?.text || data.postal_code,
    });
    setSuggestions([]);
    setErrors((p) => ({ ...p, address: '', city: '', postal_code: '' }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!data.name.trim()) errs.name = 'Ce champ est requis.';
    if (!data.category) errs.category = 'Ce champ est requis.';
    if (!data.subcategory) errs.subcategory = 'Ce champ est requis.';
    if (!data.address.trim()) errs.address = 'Ce champ est requis.';
    if (!data.city.trim()) errs.city = 'Ce champ est requis.';
    if (!data.postal_code.trim()) errs.postal_code = 'Ce champ est requis.';
    else if (!/^[0-9]{5}$/.test(data.postal_code.trim())) errs.postal_code = 'Code postal invalide (5 chiffres).';
    if (!data.description.trim()) errs.description = 'Ce champ est requis.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const inputStyle = (field: string) => ({
    background: '#0a0a0f',
    border: `1px solid ${errors[field] ? '#ef4444' : '#2a2a3a'}`,
  });

  const subcategories = data.category ? CATEGORIES[data.category as CategoryKey]?.subcategories || [] : [];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[20px] font-bold text-white">Présente ton établissement</h2>
        <p className="text-[13px] mt-1" style={{ color: '#a0a0b0' }}>
          Ces informations apparaîtront sur ta fiche dans l'annuaire.
        </p>
      </div>

      <div>
        <label className="block text-[13px] font-medium text-[#c0c0d0] mb-1.5">Nom de l'établissement</label>
        <input
          value={data.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Le Cox Bar"
          className="w-full px-4 py-3 rounded-[10px] text-[14px] text-white outline-none transition-colors focus:border-[#7B2D8B]"
          style={inputStyle('name')}
        />
        {errors.name && <p className="text-[12px] text-red-500 mt-1">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-[13px] font-medium text-[#c0c0d0] mb-1.5">Catégorie principale</label>
        <select
          value={data.category}
          onChange={(e) => { set('category', e.target.value as CategoryKey); set('subcategory', ''); }}
          className="w-full px-4 py-3 rounded-[10px] text-[14px] text-white outline-none transition-colors focus:border-[#7B2D8B]"
          style={inputStyle('category')}
        >
          <option value="" disabled>Choisir une catégorie</option>
          {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORIES[k].label}</option>)}
        </select>
        {errors.category && <p className="text-[12px] text-red-500 mt-1">{errors.category}</p>}
      </div>

      <div>
        <label className="block text-[13px] font-medium text-[#c0c0d0] mb-1.5">Type d'établissement</label>
        <select
          value={data.subcategory}
          onChange={(e) => set('subcategory', e.target.value)}
          disabled={!data.category}
          className="w-full px-4 py-3 rounded-[10px] text-[14px] text-white outline-none transition-colors focus:border-[#7B2D8B] disabled:opacity-40"
          style={inputStyle('subcategory')}
        >
          <option value="" disabled>Choisir</option>
          {subcategories.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {errors.subcategory && <p className="text-[12px] text-red-500 mt-1">{errors.subcategory}</p>}
      </div>

      <div className="relative">
        <label className="block text-[13px] font-medium text-[#c0c0d0] mb-1.5">Adresse de l'établissement</label>
        <input
          value={data.address}
          onChange={(e) => searchAddress(e.target.value)}
          placeholder="12 rue de la République, 34000 Montpellier"
          className="w-full px-4 py-3 rounded-[10px] text-[14px] text-white outline-none transition-colors focus:border-[#7B2D8B]"
          style={inputStyle('address')}
        />
        {suggestions.length > 0 && (
          <div
            className="absolute z-20 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-[10px]"
            style={{ background: '#14141e', border: '1px solid #2a2a3a' }}
          >
            {suggestions.map((s: any) => (
              <button
                key={s.id}
                type="button"
                onClick={() => selectAddress(s)}
                className="w-full text-left px-4 py-2.5 text-[13px] text-[#c0c0d0] transition-colors hover:bg-[#1e1e2e]"
              >
                {s.place_name}
              </button>
            ))}
          </div>
        )}
        {errors.address && <p className="text-[12px] text-red-500 mt-1">{errors.address}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[13px] font-medium text-[#c0c0d0] mb-1.5">Ville</label>
          <input
            value={data.city}
            onChange={(e) => set('city', e.target.value)}
            className="w-full px-4 py-3 rounded-[10px] text-[14px] text-white outline-none transition-colors focus:border-[#7B2D8B]"
            style={inputStyle('city')}
          />
          {errors.city && <p className="text-[12px] text-red-500 mt-1">{errors.city}</p>}
        </div>
        <div>
          <label className="block text-[13px] font-medium text-[#c0c0d0] mb-1.5">Code postal</label>
          <input
            value={data.postal_code}
            onChange={(e) => set('postal_code', e.target.value)}
            pattern="[0-9]{5}"
            className="w-full px-4 py-3 rounded-[10px] text-[14px] text-white outline-none transition-colors focus:border-[#7B2D8B]"
            style={inputStyle('postal_code')}
          />
          {errors.postal_code && <p className="text-[12px] text-red-500 mt-1">{errors.postal_code}</p>}
        </div>
      </div>

      <div>
        <label className="block text-[13px] font-medium text-[#c0c0d0] mb-1.5">Téléphone de l'établissement (optionnel)</label>
        <input
          type="tel"
          value={data.phone}
          onChange={(e) => set('phone', e.target.value)}
          placeholder="04 67 58 22 14"
          className="w-full px-4 py-3 rounded-[10px] text-[14px] text-white outline-none transition-colors focus:border-[#7B2D8B]"
          style={{ background: '#0a0a0f', border: '1px solid #2a2a3a' }}
        />
        <p className="text-[12px] mt-1" style={{ color: '#606070' }}>Différent de ton téléphone personnel si nécessaire.</p>
      </div>

      <div>
        <label className="block text-[13px] font-medium text-[#c0c0d0] mb-1.5">Site web (optionnel)</label>
        <input
          type="url"
          value={data.website}
          onChange={(e) => set('website', e.target.value)}
          placeholder="https://monestablissement.fr"
          className="w-full px-4 py-3 rounded-[10px] text-[14px] text-white outline-none transition-colors focus:border-[#7B2D8B]"
          style={{ background: '#0a0a0f', border: '1px solid #2a2a3a' }}
        />
      </div>

      <div>
        <label className="block text-[13px] font-medium text-[#c0c0d0] mb-1.5">Décris ton établissement</label>
        <textarea
          value={data.description}
          onChange={(e) => { if (e.target.value.length <= 500) set('description', e.target.value); }}
          placeholder="Présente ton établissement, son ambiance, ce qui le rend unique et inclusif..."
          className="w-full px-4 py-3 rounded-[10px] text-[14px] text-white outline-none transition-colors focus:border-[#7B2D8B] resize-y"
          style={{ ...inputStyle('description'), minHeight: 120 }}
        />
        <div className="flex justify-between mt-1">
          {errors.description ? <p className="text-[12px] text-red-500">{errors.description}</p> : <span />}
          <p className="text-[12px]" style={{ color: '#606070' }}>{data.description.length} / 500</p>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={onPrev}
          className="flex-1 py-3.5 rounded-[10px] text-[14px] font-medium text-white transition-colors"
          style={{ border: '1px solid #2a2a3a' }}
        >
          &larr; Précédent
        </button>
        <button
          onClick={() => { if (validate()) onNext(); }}
          className="flex-1 py-3.5 rounded-[10px] text-[15px] font-semibold text-white transition-colors"
          style={{ background: '#7B2D8B' }}
        >
          Continuer &rarr;
        </button>
      </div>
    </div>
  );
}
