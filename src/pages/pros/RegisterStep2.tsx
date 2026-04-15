import { useState } from 'react';

const SUBCATEGORIES: Record<string, string[]> = {
  se_loger: ['Maison d\'h\u00f4tes', 'H\u00f4tel', 'Location particuli\u00e8re'],
  shopping: ['V\u00eatements', 'D\u00e9co', 'Art', 'Chaussures', 'Sex-shop', 'Jeux'],
  manger: ['Restaurant', 'Fast-food', 'Brunch', 'Salon de th\u00e9', 'Bar \u00e0 vins'],
  soiree: ['Bar tranquille', 'Bar musical', 'Bo\u00eete de nuit'],
  bien_etre: ['Sauna', 'Massage', 'Esth\u00e9tique'],
  culture: ['Mus\u00e9e', 'Visite guid\u00e9e', 'Concert', 'Cin\u00e9ma', 'Autres'],
};

const CATEGORY_OPTIONS = [
  { value: 'se_loger', label: 'Se loger' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'manger', label: 'Manger' },
  { value: 'soiree', label: 'Soir\u00e9e' },
  { value: 'bien_etre', label: 'Bien-\u00eatre' },
  { value: 'culture', label: 'Culture' },
];

export interface Step2Data {
  name: string;
  category: string;
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

  const handleCategoryChange = (value: string) => {
    onChange({ ...data, category: value, subcategory: '' });
    setErrors((prev) => ({ ...prev, category: '', subcategory: '' }));
  };

  const handleSubcategoryChange = (value: string) => {
    onChange({ ...data, subcategory: value });
    setErrors((prev) => ({ ...prev, subcategory: '' }));
  };

  const inputStyle = (field: string) => ({
    background: '#0a0a0f',
    border: `1px solid ${errors[field] ? '#ef4444' : '#2a2a3a'}`,
  });

  const subcategories = data.category ? SUBCATEGORIES[data.category] || [] : [];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[20px] font-bold text-white">Présentez votre établissement</h2>
        <p className="text-[13px] mt-1" style={{ color: '#a0a0b0' }}>
          Ces informations apparaîtront sur votre fiche dans l'annuaire.
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
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="w-full px-4 py-3 rounded-[10px] text-[14px] outline-none transition-colors focus:border-[#7B2D8B]"
          style={{
            background: '#1a1a24',
            border: `1px solid ${errors.category ? '#ef4444' : data.category ? '#7B2D8B' : '#2a2a3a'}`,
            color: data.category ? '#ffffff' : '#606070',
          }}
        >
          <option value="" disabled>Choisir une catégorie</option>
          {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {errors.category && <p className="text-[12px] text-red-500 mt-1">{errors.category}</p>}
      </div>

      <div>
        <label
          className="block text-[13px] font-medium mb-1.5"
          style={{ color: data.category ? '#c0c0d0' : '#3a3a4a' }}
        >
          Type d'établissement
        </label>
        <select
          value={data.subcategory}
          onChange={(e) => handleSubcategoryChange(e.target.value)}
          disabled={!data.category}
          className="w-full px-4 py-3 rounded-[10px] text-[14px] outline-none transition-colors focus:border-[#7B2D8B]"
          style={{
            background: data.category ? '#1a1a24' : '#111118',
            border: `1px solid ${errors.subcategory ? '#ef4444' : !data.category ? '#1e1e2e' : data.subcategory ? '#7B2D8B' : '#2a2a3a'}`,
            color: !data.category ? '#3a3a4a' : data.subcategory ? '#ffffff' : '#606070',
            cursor: data.category ? 'pointer' : 'not-allowed',
            opacity: data.category ? 1 : 0.5,
          }}
        >
          <option value="" disabled>
            {data.category ? 'Choisir un type' : 'Choisissez d\'abord une catégorie'}
          </option>
          {subcategories.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {errors.subcategory && <p className="text-[12px] text-red-500 mt-1">{errors.subcategory}</p>}
        {!data.category && (
          <p className="text-[11px] mt-1" style={{ color: '#606070' }}>
            Sélectionnez d'abord une catégorie ci-dessus.
          </p>
        )}
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
        <p className="text-[12px] mt-1" style={{ color: '#606070' }}>Différent de votre téléphone personnel si nécessaire.</p>
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
        <label className="block text-[13px] font-medium text-[#c0c0d0] mb-1.5">Décrivez votre établissement</label>
        <textarea
          value={data.description}
          onChange={(e) => { if (e.target.value.length <= 500) set('description', e.target.value); }}
          placeholder="Présentez votre établissement, son ambiance, ce qui le rend unique et inclusif..."
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
