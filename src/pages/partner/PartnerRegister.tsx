import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { CATEGORIES, CATEGORY_KEYS } from '../../lib/constants';
import type { CategoryKey } from '../../lib/types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function PartnerRegister() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [latitude, setLatitude] = useState('43.6119');
  const [longitude, setLongitude] = useState('3.8767');
  const [category, setCategory] = useState<CategoryKey>('manger');
  const [subcategory, setSubcategory] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        supabase.from('establishments').select('id').eq('owner_id', session.user.id).maybeSingle().then(({ data }) => {
          if (data) navigate('/pros/tableau-de-bord', { replace: true });
          else setStep(2);
        });
      }
    });
  }, []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const searchAddress = async (query: string) => {
    setAddress(query);
    if (query.length < 3) {
      setAddressSuggestions([]);
      return;
    }
    try {
      const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
      if (!key) return;
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&components=country:FR&language=fr&key=${key}`);
      const data = await res.json();
      const features = (data.results || []).slice(0, 5).map((r: any) => ({
        place_name: r.formatted_address,
        center: [r.geometry.location.lng, r.geometry.location.lat],
        context: r.address_components.map((c: any) => ({
          id: c.types.includes('locality') ? 'place.' : c.types.includes('postal_code') ? 'postcode.' : c.types[0] + '.',
          text: c.long_name,
        })),
      }));
      setAddressSuggestions(features);
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

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caracteres.');
      return;
    }
    setSaving(true);
    try {
      const { data: existingUsers } = await supabase.rpc('check_email_exists', { email_input: email }).maybeSingle();
      if (existingUsers) {
        toast.error('Cet email est deja utilise, connectez-vous plutot.');
        setSaving(false);
        return;
      }
    } catch {
      // RPC may not exist, proceed
    }
    setSaving(false);
    setStep(2);
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let userId: string;
      const { data: { session: existingSession } } = await supabase.auth.getSession();

      if (existingSession) {
        userId = existingSession.user.id;
      } else {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: firstName } },
        });
        if (signUpError) throw signUpError;
        if (!signUpData.user) throw new Error('Erreur lors de la creation du compte');
        userId = signUpData.user.id;

        await supabase.from('profiles').upsert({ id: userId, username: firstName });
      }

      const { data: estData, error: estError } = await supabase.from('establishments').insert({
        owner_id: userId,
        name,
        address,
        city,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        category,
        subcategory,
        phone,
        website,
        description,
        is_pro: false,
        is_verified: false,
      }).select('id').single();
      if (estError) throw estError;

      if (logoFile && estData) {
        const ext = logoFile.name.split('.').pop();
        const path = `${estData.id}/logo.${ext}`;
        await supabase.storage.from('establishment-logos').upload(path, logoFile);
        const { data: urlData } = supabase.storage.from('establishment-logos').getPublicUrl(path);
        await supabase.from('establishments').update({ logo_url: urlData.publicUrl }).eq('id', estData.id);
      }

      toast.success('Bienvenue ! Votre etablissement est en cours de verification par notre equipe.');
      navigate('/pros/tableau-de-bord');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la creation');
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-dark-surface border border-dark-border rounded-card p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-bold">
            <span className="text-white">Pass</span>
            <span style={{ color: '#7B2D8B' }}> Navigay</span>
            <span className="text-gray-500 font-normal"> · Espace Partenaire</span>
          </h1>
          <h2 className="text-lg font-semibold text-white mt-4">Referencez votre etablissement</h2>
          <p className="text-sm text-gray-400 mt-1">
            Rejoignez la communaute Pass Navigay et gagnez en visibilite aupres de milliers d'utilisateurs LGBT-friendly.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className={`flex-1 h-1 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-dark-border'}`} />
          <div className={`flex-1 h-1 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-dark-border'}`} />
        </div>
        <p className="text-xs text-gray-500 text-center">Etape {step}/2</p>

        {step === 1 ? (
          <form onSubmit={handleStep1} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Prenom</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="input-field bg-dark-bg border-dark-border text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input-field bg-dark-bg border-dark-border text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Mot de passe (8 caracteres min.)</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="input-field bg-dark-bg border-dark-border text-white" />
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
              {saving && <LoadingSpinner size={16} />} Continuer
            </button>
            <p className="text-center text-sm text-gray-500">
              Vous avez deja un compte ?{' '}
              <Link to="/pros/connexion" className="text-primary hover:underline">Connectez-vous</Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleStep2} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Nom de l'etablissement</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className="input-field bg-dark-bg border-dark-border text-white" />
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-300 mb-1">Adresse</label>
              <input value={address} onChange={(e) => searchAddress(e.target.value)} required className="input-field bg-dark-bg border-dark-border text-white" />
              {addressSuggestions.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-dark-surface border border-dark-border rounded-input max-h-48 overflow-y-auto">
                  {addressSuggestions.map((s: any) => (
                    <button key={s.id} type="button" onClick={() => selectAddress(s)} className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-dark-border/50 transition-colors">
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
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field bg-dark-bg border-dark-border text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Site web</label>
                <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} className="input-field bg-dark-bg border-dark-border text-white" placeholder="https://" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Description ({description.length}/500)</label>
              <textarea value={description} onChange={(e) => { if (e.target.value.length <= 500) setDescription(e.target.value); }} rows={3} className="input-field bg-dark-bg border-dark-border text-white resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Logo</label>
              <div className="flex items-center gap-4">
                {logoPreview && (
                  <img src={logoPreview} alt="" className="w-14 h-14 rounded-full object-cover" />
                )}
                <input type="file" accept="image/*" onChange={handleLogoChange} className="input-field bg-dark-bg border-dark-border text-white text-sm" />
              </div>
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
              {saving && <LoadingSpinner size={16} />} Creer mon compte et mon etablissement
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
